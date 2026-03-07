/**
 * Supabase 브라우저 클라이언트
 * WHY: 클라이언트 사이드에서 Supabase 접근
 * HOW: createClient()로 싱글턴 생성
 * WHERE: 클라이언트 컴포넌트에서 import
 */
import { createClient as supabaseCreateClient } from '@supabase/supabase-js'

export function createClient() {
  return supabaseCreateClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
