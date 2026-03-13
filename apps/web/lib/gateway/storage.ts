/**
 * Supabase Storage 게이트웨이 (L0 Infrastructure)
 * WHY: architecture-spec 4.2 — 서비스에서 Supabase SDK/fs/fetch 직접 호출 금지
 * HOW: createAdminClient().storage 래핑 + 이미지 다운로드 + upsert 모드
 * WHERE: photo-edit.service.ts, migrate-storage.ts에서 import
 */
import * as fs from 'fs'
import * as nodePath from 'path'
import { createAdminClient } from '../supabase/admin'
import { AppError } from '../errors'
import { PHOTO_STORAGE_MODE, PHOTO_BASE_URL } from '../env'

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024 // 50MB (Supabase Free 한도)
const ALLOWED_BUCKETS = new Set(['photos'])

/** 버킷 allowlist 검증 */
function validateBucket(bucket: string): void {
  if (!ALLOWED_BUCKETS.has(bucket)) {
    throw new AppError('VALIDATION', `허용되지 않은 버킷입니다: ${bucket}`)
  }
}

/** Path Traversal 방어: ../ 제거, 절대경로 차단, 특수문자 필터 */
function sanitizePath(inputPath: string): string {
  // URL 인코딩 우회 방어 (%2e%2f → ../)
  const decoded = decodeURIComponent(inputPath)
  const cleaned = decoded.replace(/\0/g, '')
  if (/[<>:"|?*\x00-\x1f]/.test(cleaned)) {
    throw new AppError('VALIDATION', '잘못된 파일명입니다')
  }
  // posix.normalize로 OS 무관하게 일관된 경로 정규화
  const normalized = nodePath.posix.normalize(cleaned)
  if (normalized.startsWith('..') || nodePath.isAbsolute(normalized)) {
    throw new AppError('VALIDATION', '잘못된 경로입니다')
  }
  return normalized
}

/**
 * 파일 업로드 → 공개 URL 반환
 * @param bucket 버킷 이름 (예: 'photos')
 * @param storagePath Storage 상대경로 (예: 'products/P001/front.jpg')
 * @param file 파일 바이너리
 */
export async function upload(bucket: string, storagePath: string, file: Buffer): Promise<string> {
  validateBucket(bucket)
  const safePath = sanitizePath(storagePath)
  if (file.length === 0) {
    throw new AppError('VALIDATION', 'Storage 업로드 실패: 빈 파일(0바이트)')
  }
  if (file.length > MAX_UPLOAD_BYTES) {
    throw new AppError('VALIDATION', 'Storage 업로드 실패: 파일 크기 초과')
  }
  const client = createAdminClient()
  const { error } = await client.storage.from(bucket).upload(safePath, file, { upsert: true })
  if (error) {
    console.error('[storage] 업로드 실패:', safePath, error.message)
    throw new AppError('INTERNAL', 'Storage 업로드에 실패했습니다')
  }
  return client.storage.from(bucket).getPublicUrl(safePath).data.publicUrl
}

/**
 * 공개 URL 조회 (업로드 없이 URL만 필요할 때)
 */
export function getPublicUrl(bucket: string, path: string): string {
  validateBucket(bucket)
  return createAdminClient().storage.from(bucket).getPublicUrl(path).data.publicUrl
}

/**
 * 파일 삭제
 * @param paths 삭제할 Storage 상대경로 배열
 */
export async function remove(bucket: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  validateBucket(bucket)
  const safePaths = paths.map(sanitizePath)
  const { error } = await createAdminClient().storage.from(bucket).remove(safePaths)
  if (error) {
    console.error('[storage] 삭제 실패:', error.message)
    throw new AppError('INTERNAL', 'Storage 삭제에 실패했습니다')
  }
}

/**
 * 이미지 바이너리 다운로드 (SSRF 방어 포함)
 * legacy 모드: 로컬 파일 읽기 (safeBase 기반 Path Traversal 방어)
 * supabase 모드: PHOTO_BASE_URL 도메인 allowlist 검증 후 fetch
 */
export async function downloadImageBuffer(url: string): Promise<Buffer> {
  if (PHOTO_STORAGE_MODE === 'legacy') {
    const safeBase = nodePath.resolve(process.cwd(), 'public', 'uploads')
    const relativePath = url.startsWith('/uploads/') ? url.slice('/uploads/'.length) : url
    const normalized = nodePath.normalize(relativePath)
    if (normalized.startsWith('..') || nodePath.isAbsolute(normalized)) {
      throw new AppError('VALIDATION', '잘못된 파일 경로입니다')
    }
    const filePath = nodePath.join(safeBase, normalized)
    if (!filePath.startsWith(safeBase)) {
      throw new AppError('VALIDATION', '접근 권한이 없습니다')
    }
    if (!fs.existsSync(filePath)) throw new AppError('NOT_FOUND', `로컬 파일 없음: ${filePath}`)
    return fs.readFileSync(filePath)
  }

  // SSRF 방어: PHOTO_BASE_URL 도메인만 허용
  if (!PHOTO_BASE_URL) {
    throw new AppError('VALIDATION', 'PHOTO_BASE_URL이 설정되지 않았습니다')
  }
  const parsed = new URL(url)
  const allowedHost = new URL(PHOTO_BASE_URL).hostname
  if (parsed.hostname !== allowedHost) {
    throw new AppError('VALIDATION', '허용되지 않은 이미지 URL입니다')
  }
  const res = await fetch(url)
  if (!res.ok) throw new AppError('INTERNAL', `원본 다운로드 실패: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}
