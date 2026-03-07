/**
 * Supabase 서버 전용 관리자 클라이언트
 * WHY: RLS 우회가 필요한 서버 사이드 작업
 * HOW: service_role 키로 createClient, auth.autoRefreshToken 비활성화
 * WHERE: API 라우트, 서버 액션에서 import
 */
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '../env'

export function createAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
