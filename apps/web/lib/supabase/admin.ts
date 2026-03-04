/**
 * Supabase service_role 클라이언트 (관리자 API용)
 * WHY: 관리자 라우트는 RLS 우회 필요 — service_role 키 사용
 * HOW: SUPABASE_SERVICE_ROLE_KEY로 createClient 초기화 (팩토리 함수)
 * WHERE: lib/db/ 리포지토리 및 admin API 라우트에서 사용
 */

import { createClient } from '@supabase/supabase-js'
import { requireEnv, PUBLIC_ENV } from '@/lib/env'

/**
 * 관리자 권한 Supabase 클라이언트 생성
 * 팩토리 함수로 호출 시점에 환경변수 검증 — module-level 싱글톤 금지
 */
export function createAdminClient() {
  return createClient(
    PUBLIC_ENV.SUPABASE_URL,
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } }
  )
}
