/**
 * Supabase anon 클라이언트 (Public API용, RLS 적용)
 * WHY: Public 엔드포인트는 RLS 적용 필수 — anon key만 사용
 * HOW: SUPABASE_ANON_KEY로 createClient 초기화
 * WHERE: Public API 라우트 및 클라이언트 컴포넌트에서 사용
 */

import { createClient } from '@supabase/supabase-js'
import { PUBLIC_ENV } from '@/lib/env'

/**
 * 공개 권한 Supabase 클라이언트 생성 (RLS 적용됨)
 * anon key는 NEXT_PUBLIC_* 이므로 빌드 타임 안전
 */
export function createAnonClient() {
  return createClient(
    PUBLIC_ENV.SUPABASE_URL,
    PUBLIC_ENV.SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  )
}
