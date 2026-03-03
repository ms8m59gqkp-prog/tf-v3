-- 20260304000010_public_orders_rls.sql
-- WHY: orders_anon_read USING(true)는 orders 전체 읽기를 허용해 과잉 (SEC/OPS 보강)
--      Public hold 기능이 요구하는 "해당 row만" 접근하도록 토큰 기반으로 제한
-- HOW: hold_token 컬럼 추가 → 기존 USING(true) 정책 제거 → 토큰 일치 row만 허용
--      current_setting('request.headers', true)::json->>'x-hold-token'으로 요청 헤더 기반 검증
-- WHERE: plan5.md §3.1.8
-- APPLY: supabase db execute (CONCURRENTLY 인덱스는 트랜잭션 밖에서 실행 필요)
--
-- ▸ V2 실측 반영 (2026-03-04)
--   - orders 테이블에 hold_token 컬럼 없음 → 추가 필요
--   - orders 기존 RLS: 활성화됨, 정책 "Allow all" (qual=true, with_check=true)
--   - "Allow all" 정책을 명시적으로 DROP 후 토큰 기반 정책으로 교체
--   - 기존 컬럼 19개: id, order_number, customer_name, phone, address,
--     postal_code, visit_date, arrival_date, box_qty, total_estimated,
--     commission, final_payout, status, created_at, updated_at,
--     seller_type, purchase_source, custom_commission_rate
--   - 모든 DDL에 IF NOT EXISTS / IF EXISTS로 멱등성 보장

-- 1) Public hold 기능을 위한 토큰 컬럼(1회성/랜덤) 추가 (이미 있으면 스킵)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS hold_token text;

-- 2) 부분 인덱스 (CONCURRENTLY는 트랜잭션 밖에서 실행, IF NOT EXISTS로 멱등성)
CREATE INDEX IF NOT EXISTS idx_orders_hold_token
  ON orders(hold_token)
  WHERE hold_token IS NOT NULL;

-- 3) RLS 활성화 (이미 활성화되어 있어도 에러 없음 — 멱등)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 4) V2 기존 "Allow all" 정책 명시적 제거
--    V2 실측: "Allow all" (qual=true, with_check=true) 정책 존재 확인
DROP POLICY IF EXISTS "Allow all" ON orders;

-- 5) 기존 토큰 기반 정책도 제거 (재실행 시 멱등성 보장)
DROP POLICY IF EXISTS orders_anon_read ON orders;
DROP POLICY IF EXISTS orders_anon_update ON orders;

-- 6) 토큰 일치 row만 허용하는 정책 생성
--    Supabase(PostgREST)에서 request header를 RLS에 전달하는 방식은
--    환경에 따라 다르므로, 표준화된 함수/세팅을 프로젝트에서 1개로 확정해야 한다.
--    아래는 "요청 헤더 기반 토큰 전달"을 전제로 한 구현이다.
CREATE POLICY orders_anon_read ON orders
  FOR SELECT TO anon
  USING (
    hold_token IS NOT NULL
    AND hold_token = current_setting('request.headers', true)::json->>'x-hold-token'
  );

CREATE POLICY orders_anon_update ON orders
  FOR UPDATE TO anon
  USING (
    hold_token IS NOT NULL
    AND hold_token = current_setting('request.headers', true)::json->>'x-hold-token'
    AND status = 'IMAGE_COMPLETE'
  );
