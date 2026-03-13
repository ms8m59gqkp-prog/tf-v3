/**
 * 인프라 핑 리포지토리 (L0 Infrastructure)
 * WHY: infra-check.service.ts의 DB/Storage 직접 호출 방지
 * HOW: createAdminClient 래핑 — 최소 쿼리로 연결 확인
 * WHERE: infra-check.service.ts에서 import
 */
import { createAdminClient } from '../../supabase/admin'

interface PingResult {
  ok: boolean
  error?: string
}

export async function ping(): Promise<PingResult> {
  const client = createAdminClient()
  const { error } = await client.from('sellers').select('id').limit(1)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function pingStorage(): Promise<PingResult> {
  const client = createAdminClient()
  const { error } = await client.storage.listBuckets()
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
