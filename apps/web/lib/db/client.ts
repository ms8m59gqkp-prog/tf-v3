/**
 * DB 클라이언트 re-export — 리포지토리 전용 진입점
 * WHY: repo가 supabase 경로 직접 참조 방지
 * HOW: createAdminClient 팩토리 re-export
 * WHERE: lib/db/repositories/*.repo.ts에서 import
 */

export { createAdminClient } from '@/lib/supabase/admin'
