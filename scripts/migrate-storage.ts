/**
 * V2→V3 Storage 마이그레이션 스크립트 (일회성)
 * WHY: 로컬 /uploads/ 파일을 Supabase Storage로 이관
 * HOW: 5소스 수집 → 파일 업로드 → DB URL 업데이트, 3단계 상태 머신
 * WHERE: 로컬 개발 머신에서 `npx tsx scripts/migrate-storage.ts`
 *
 * 사전 준비: V2 서버에서 tar -czf uploads.tar.gz /uploads/ → 로컬 해제
 * 환경변수: V2_UPLOADS_PATH=/path/to/extracted/uploads
 *
 * ⚠️ LEGACY PATH NOTICE:
 * V2 DB의 /uploads/... 경로에서 prefix만 제거하여 Storage 상대경로로 변환
 * 마이그레이션 후 resolveStorageUrl()이 런타임에 올바른 URL을 생성함 (path.ts SSOT)
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as nodePath from 'path'

// --- 환경변수 검증 ---
const missing: string[] = []
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL')
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
if (!process.env.V2_UPLOADS_PATH) missing.push('V2_UPLOADS_PATH (tar 해제 경로, 예: /home/user/uploads)')

if (missing.length > 0) {
  console.error('[migrate] 누락된 환경변수:')
  for (const m of missing) console.error(`  - ${m}`)
  console.error('\n사용 예: V2_UPLOADS_PATH=/path/to/uploads npx tsx scripts/migrate-storage.ts')
  process.exit(1)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const V2_PATH = process.env.V2_UPLOADS_PATH!
const BUCKET = 'photos'

if (!fs.existsSync(V2_PATH)) {
  console.error(`[migrate] V2_UPLOADS_PATH 경로가 존재하지 않습니다: ${V2_PATH}`)
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface CheckpointRow {
  local_path: string
  source_table: string
  source_id: string
  storage_path: string
  status: string
}

// --- 복합 PK WHERE 헬퍼 ---
function matchRow(row: CheckpointRow) {
  return db.from('_migration_checkpoint')
    .eq('local_path', row.local_path)
    .eq('source_table', row.source_table)
    .eq('source_id', row.source_id)
}

async function collectSources(): Promise<number> {
  console.log('[migrate] 소스 수집 시작...')
  let total = 0

  // 소스 1: st_products.photos (jsonb 배열)
  const { data: products } = await db
    .from('st_products')
    .select('id, photos')
    .not('photos', 'is', null)
  let s1 = 0
  for (const p of products ?? []) {
    const paths: string[] = typeof p.photos === 'string' ? JSON.parse(p.photos) : p.photos
    for (const filePath of paths) {
      if (!filePath.includes('/uploads/')) continue
      await upsertCheckpoint(filePath, 'st_products', p.id, filePath.replace('/uploads/', ''))
      s1++
    }
  }
  console.log(`[migrate]   소스1 st_products.photos: ${s1}건`)
  total += s1

  // 소스 2+3: photos.file_url, edited_url
  const { data: photos } = await db
    .from('photos')
    .select('id, file_url, edited_url')
  let s2 = 0
  for (const p of photos ?? []) {
    if (p.file_url?.startsWith('/uploads/')) {
      await upsertCheckpoint(p.file_url, 'photos', p.id, p.file_url.replace('/uploads/', ''))
      s2++
    }
    if (p.edited_url?.startsWith('/uploads/')) {
      await upsertCheckpoint(p.edited_url, 'photos', p.id, p.edited_url.replace('/uploads/', ''))
      s2++
    }
  }
  console.log(`[migrate]   소스2+3 photos.file_url/edited_url: ${s2}건`)
  total += s2

  // 소스 4: photo_uploads.file_url
  const { data: uploads } = await db
    .from('photo_uploads')
    .select('id, file_url')
  let s4 = 0
  for (const u of uploads ?? []) {
    if (u.file_url?.startsWith('/uploads/')) {
      await upsertCheckpoint(u.file_url, 'photo_uploads', u.id, u.file_url.replace('/uploads/', ''))
      s4++
    }
  }
  console.log(`[migrate]   소스4 photo_uploads.file_url: ${s4}건`)
  total += s4

  // 소스 5: consignment_requests.inspection_image
  const { data: consignments } = await db
    .from('consignment_requests')
    .select('id, inspection_image')
  let s5 = 0
  for (const c of consignments ?? []) {
    if (c.inspection_image?.startsWith('/uploads/')) {
      await upsertCheckpoint(c.inspection_image, 'consignment_requests', c.id, c.inspection_image.replace('/uploads/', ''))
      s5++
    }
  }
  console.log(`[migrate]   소스5 consignment_requests.inspection_image: ${s5}건`)
  total += s5

  console.log(`[migrate] 소스 수집 완료: 총 ${total}건`)
  return total
}

async function upsertCheckpoint(localPath: string, table: string, id: string, storagePath: string): Promise<void> {
  await db.from('_migration_checkpoint').upsert({
    local_path: localPath,
    source_table: table,
    source_id: id,
    storage_path: storagePath,
    status: 'pending',
  }, { onConflict: 'local_path,source_table,source_id', ignoreDuplicates: true })
}

async function uploadFiles(): Promise<void> {
  const { data: pending } = await db
    .from('_migration_checkpoint')
    .select('*')
    .eq('status', 'pending')

  const total = pending?.length ?? 0
  console.log(`[migrate] 업로드 대상: ${total}건`)
  if (total === 0) return

  let uploaded = 0
  let skipped = 0
  let errors = 0
  for (const row of (pending ?? []) as CheckpointRow[]) {
    const localFile = nodePath.join(V2_PATH, row.local_path.replace('/uploads/', ''))
    if (!fs.existsSync(localFile)) {
      await matchRow(row).update({
        status: 'file_missing',
        error_message: `파일 없음: ${localFile}`,
        updated_at: new Date().toISOString(),
      })
      skipped++
      continue
    }

    const buffer = fs.readFileSync(localFile)
    const { error } = await db.storage.from(BUCKET).upload(row.storage_path, buffer, { upsert: true })
    if (error) {
      const isQuotaError = error.message.includes('quota')
        || error.message.includes('limit')
        || error.message.includes('413')
      await matchRow(row).update({
        status: 'error',
        error_message: error.message,
        updated_at: new Date().toISOString(),
      })
      errors++
      console.error('[migrate] 업로드 실패:', row.storage_path, error.message)
      if (isQuotaError) {
        console.error('[migrate] 스토리지 쿼터 초과 — 업로드 중단. 플랜 업그레이드 후 재실행')
        break
      }
      continue
    }

    await matchRow(row).update({
      status: 'uploaded',
      updated_at: new Date().toISOString(),
    })
    uploaded++

    if ((uploaded + skipped + errors) % 100 === 0) {
      console.log(`[migrate]   진행: ${uploaded + skipped + errors}/${total} (성공 ${uploaded}, 스킵 ${skipped}, 에러 ${errors})`)
    }
  }

  console.log(`[migrate] 업로드 완료: 성공 ${uploaded}, 스킵 ${skipped}, 에러 ${errors}`)
}

async function updateDbUrls(): Promise<void> {
  const { data: uploaded } = await db
    .from('_migration_checkpoint')
    .select('*')
    .eq('status', 'uploaded')

  const total = uploaded?.length ?? 0
  console.log(`[migrate] DB URL 업데이트 대상: ${total}건`)
  if (total === 0) return

  let updated = 0
  for (const row of (uploaded ?? []) as CheckpointRow[]) {
    const storagePath = row.storage_path

    if (row.source_table === 'st_products') {
      const { data: product } = await db
        .from('st_products')
        .select('photos')
        .eq('id', row.source_id)
        .single()
      if (product) {
        const oldPaths: string[] = typeof product.photos === 'string'
          ? JSON.parse(product.photos) : product.photos
        const newPaths = oldPaths.map((p: string) =>
          p === row.local_path ? storagePath : p,
        )
        await db.from('st_products').update({ photos: newPaths }).eq('id', row.source_id)
      }
    } else if (row.source_table === 'photos') {
      const { data: photo } = await db
        .from('photos')
        .select('file_url, edited_url')
        .eq('id', row.source_id)
        .single()
      if (photo) {
        if (photo.file_url === row.local_path) {
          await db.from('photos').update({ file_url: storagePath }).eq('id', row.source_id)
        }
        if (photo.edited_url === row.local_path) {
          await db.from('photos').update({ edited_url: storagePath }).eq('id', row.source_id)
        }
      }
    } else if (row.source_table === 'photo_uploads') {
      await db.from('photo_uploads').update({ file_url: storagePath }).eq('id', row.source_id)
    } else if (row.source_table === 'consignment_requests') {
      await db.from('consignment_requests').update({ inspection_image: storagePath }).eq('id', row.source_id)
    }

    await matchRow(row).update({
      status: 'url_updated',
      updated_at: new Date().toISOString(),
    })
    updated++
  }

  console.log(`[migrate] DB URL 업데이트 완료: ${updated}건`)
}

async function printSummary(startTime: number): Promise<void> {
  const { data } = await db
    .from('_migration_checkpoint')
    .select('status, error_message')

  const total = data?.length ?? 0
  const counts = { pending: 0, uploaded: 0, url_updated: 0, file_missing: 0, error: 0 }
  for (const r of data ?? []) {
    counts[r.status as keyof typeof counts]++
  }
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log('\n========== 마이그레이션 결과 ==========')
  console.log(`총 대상:      ${total}건`)
  console.log(`완료:         ${counts.url_updated}건`)
  console.log(`업로드만 완료: ${counts.uploaded}건`)
  console.log(`미처리:       ${counts.pending}건`)
  console.log(`파일 누락:    ${counts.file_missing}건`)
  console.log(`에러:         ${counts.error}건`)
  console.log(`소요 시간:    ${elapsed}초`)

  if (counts.pending > 0 || counts.uploaded > 0) {
    console.log('\n⚠ 미완료 건이 있습니다. 스크립트를 재실행하세요.')
  }
  if (counts.error > 0) {
    console.log('⚠ 에러 상세: SELECT * FROM _migration_checkpoint WHERE status = \'error\'')
  }
  console.log('=======================================\n')
}

async function main(): Promise<void> {
  const startTime = Date.now()
  console.log('[migrate] Storage 마이그레이션 시작')
  await collectSources()
  await uploadFiles()
  await updateDbUrls()
  await printSummary(startTime)
  console.log('[migrate] 완료')
}

main().catch(e => {
  console.error('[migrate] 치명적 오류:', e)
  process.exit(1)
})
