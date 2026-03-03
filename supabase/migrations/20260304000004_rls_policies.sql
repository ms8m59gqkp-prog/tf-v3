-- 20260304000004_rls_policies.sql
-- WHY: anon client가 RLS 없이 전체 테이블 접근 가능 (SEC-05)
-- HOW: DO 블록 내 정책 존재 여부 확인 → 없는 것만 추가
-- WHERE: plan5.md §3.1.4
-- APPLY: db push
--
-- [V2 실측 반영] 2026-03-04
-- consignment_requests RLS        → 이미 활성화 → 멱등성 처리
-- admin_all_consignment 정책      → 이미 존재 → 스킵
-- service_all_consignment 정책    → 이미 존재 → 스킵
-- consignment_anon_read (anon 토큰 기반 읽기) → 없음 → 추가만 필요

-- RLS 활성화 (이미 활성화되어 있으면 PostgreSQL이 무시, 에러 없음)
ALTER TABLE consignment_requests ENABLE ROW LEVEL SECURITY;

-- anon 토큰 기반 읽기 정책만 추가 (없는 경우에만)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'consignment_requests'
       AND policyname = 'consignment_anon_read'
  ) THEN
    RAISE NOTICE '[004] consignment_anon_read 정책 없음 → 생성';
    CREATE POLICY consignment_anon_read ON consignment_requests
      FOR SELECT TO anon
      USING (
        adjustment_token IS NOT NULL
        AND adjustment_token = current_setting('request.headers', true)::json->>'x-adjustment-token'
      );
  ELSE
    RAISE NOTICE '[004] consignment_anon_read 정책 이미 존재 → 스킵';
  END IF;
END $$;

-- [Rev.5-F1] orders RLS 정책은 §3.1.8(토큰 기반)으로 일원화.
-- USING(true)는 architecture-spec.md "USING(true) 없음" 및 phase-checklists FAIL 조건에 위배.
-- orders RLS는 아래 §3.1.8의 010_public_orders_rls.sql에서만 정의한다.
