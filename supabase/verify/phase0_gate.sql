-- phase0_gate.sql
-- WHY: Phase 0 완료 전 모든 DB 변경사항이 올바르게 적용되었는지 검증
--      14개 항목 전체 PASS 필수 — 하나라도 FAIL 시 Phase 0 미통과
-- HOW: 각 항목을 순서대로 실행하고 기대 결과와 비교
--      자동 실행 가능한 쿼리(1~5, 9~10, 13)는 SQL로 제공
--      수동 검증 항목(6~8, 11~12, 14)은 실행 가이드로 제공
-- WHERE: plan5.md §3.2
-- APPLY: psql 또는 Supabase SQL Editor에서 실행
--
-- ▸ V2 실측 반영 (2026-03-04)
--   - GATE 1: CHECK 7값은 V2에 이미 존재 → 바로 PASS
--   - GATE 2: UNIQUE 5건 중 3건은 V2 기존, 2건만 신규 추가
--     (기존: uq_settlement_queue_match, uq_sellers_phone, uq_sellers_code)
--     (신규: uq_return_consignment, uq_st_products_number)
--   - GATE 13: V2 orders "Allow all" 정책(qual=true) → 010에서 DROP 처리됨
--   - 모든 gate 쿼리는 V2 기존 + 신규 합계로 판정하도록 조정

-- ============================================================================
-- GATE 1: ConsignmentStatus CHECK 7값 확인
-- 기대: 1행 반환 (consignment_requests_status_check)
-- V2 실측: 이미 존재 → 바로 PASS
-- ============================================================================
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'consignment_requests'::regclass
  AND contype = 'c'
  AND conname = 'consignment_requests_status_check';
-- PASS 조건: definition에 7값 모두 포함
--   'pending','received','inspecting','approved','on_hold','rejected','completed'
-- V2 실측: 이미 존재하므로 마이그레이션 전/후 모두 1행 반환

-- ============================================================================
-- GATE 2: UNIQUE 제약 5건 확인 (V2 기존 3 + 신규 2 = 5)
-- 기대: 5행 반환
-- V2 실측: uq_settlement_queue_match, uq_sellers_phone, uq_sellers_code는
--          V2에 이미 존재. uq_return_consignment, uq_st_products_number만 신규.
-- ============================================================================
SELECT conname, conrelid::regclass AS table_name
FROM pg_constraint
WHERE contype = 'u'
  AND conname IN (
    'uq_settlement_queue_match',
    'sellers_phone_key',
    'sellers_seller_code_key',
    'uq_return_consignment',
    'st_products_product_number_key'
  )
ORDER BY conname;
-- PASS 조건: 정확히 5행 (기존 3 + 신규 2)

-- ============================================================================
-- GATE 3: 인덱스 5건 생성 확인
-- 기대: 5행 반환 (003_performance_indexes.sql 인덱스)
-- ============================================================================
SELECT indexname, tablename
FROM pg_indexes
WHERE indexname IN (
  'idx_sold_items_seller_settlement',
  'idx_orders_status',
  'idx_sales_records_match_status',
  'idx_settlement_queue_seller_id',
  'idx_consignment_seller'
)
ORDER BY indexname;
-- PASS 조건: 정확히 5행

-- ============================================================================
-- GATE 4: RLS 2개 테이블 활성화 확인
-- 기대: 2행 반환 (consignment_requests, orders)
-- V2 실측: orders RLS는 이미 활성화됨. consignment_requests도 확인.
-- ============================================================================
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true
  AND tablename IN ('consignment_requests', 'orders')
ORDER BY tablename;
-- PASS 조건: 정확히 2행 (consignment_requests, orders)

-- ============================================================================
-- GATE 5: RPC 3개 생성 확인
-- 기대: 3행 반환
-- ============================================================================
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
  AND routine_name IN (
    'create_settlement_with_items',
    'create_order_with_items',
    'complete_consignment'
  )
ORDER BY routine_name;
-- PASS 조건: 정확히 3행

-- ============================================================================
-- GATE 6: RPC 빈 배열 테스트 (수동 실행)
-- 기대: 각 RPC가 빈 배열 입력 시 에러 발생, 정상 입력 시 uuid 반환
-- ============================================================================
-- 테스트 6-1: create_settlement_with_items 빈 배열 → 에러
-- SELECT create_settlement_with_items(
--   gen_random_uuid(), '2026-01-01', '2026-01-31',
--   10000, 0.1, 1000, 9000,
--   ARRAY[]::uuid[]
-- );
-- 기대: ERROR '정산 항목이 비어있습니다 (sold_item_ids가 빈 배열)'

-- 테스트 6-2: create_order_with_items 빈 배열 → 에러
-- SELECT create_order_with_items(
--   'TEST-001', '테스트', '010-0000-0000', 'RECEIVED',
--   '[]'::jsonb
-- );
-- 기대: ERROR '주문 아이템이 비어있습니다'

-- 테스트 6-3: create_order_with_items product_number 누락 → 에러
-- SELECT create_order_with_items(
--   'TEST-002', '테스트', '010-0000-0000', 'RECEIVED',
--   '[{"brand":"TEST"}]'::jsonb
-- );
-- 기대: ERROR '주문 아이템에 product_number가 누락되었습니다'

-- PASS 조건: 3개 테스트 모두 예상 에러 메시지 반환

-- ============================================================================
-- GATE 7: RPC 동시 실행 테스트 (2-session 수동 테스트)
-- 기대: 2개 세션에서 동일 sold_items FOR UPDATE → 1개만 성공
-- ============================================================================
-- 테스트 절차:
-- 1. 세션 A: BEGIN;
--    SELECT create_settlement_with_items(
--      <seller_id>, '2026-01-01', '2026-01-31',
--      10000, 0.1, 1000, 9000,
--      ARRAY[<sold_item_id>]::uuid[]
--    );
--    -- COMMIT하지 말고 대기
--
-- 2. 세션 B: (동일 sold_item_id로 호출)
--    SELECT create_settlement_with_items(
--      <seller_id>, '2026-01-01', '2026-01-31',
--      10000, 0.1, 1000, 9000,
--      ARRAY[<sold_item_id>]::uuid[]
--    );
--    -- 세션 B는 세션 A의 FOR UPDATE 잠금으로 대기 상태
--
-- 3. 세션 A: COMMIT;
-- 4. 세션 B: '잠금 실패' 에러 반환 (이미 'settled' 상태)
--
-- PASS 조건: 세션 B가 에러 반환 (동일 sold_item 이중 정산 방지)

-- ============================================================================
-- GATE 8: 기존 중복 데이터 0건 확인 (Preflight 00 재실행)
-- 기대: 모든 UNIQUE 대상 컬럼에서 중복 0건
-- ============================================================================
-- preflight/에 있는 중복 탐지 쿼리를 재실행하여 0건 확인
-- 참조: supabase/preflight/ 디렉토리의 중복 탐지 SQL
--
-- 빠른 확인용 집계:
SELECT 'settlement_queue.match_id' AS target,
       COUNT(*) AS duplicate_groups
FROM (
  SELECT match_id FROM settlement_queue
  GROUP BY match_id HAVING COUNT(*) > 1
) sub
UNION ALL
SELECT 'sellers.phone',
       COUNT(*)
FROM (
  SELECT phone FROM sellers
  GROUP BY phone HAVING COUNT(*) > 1
) sub
UNION ALL
SELECT 'sellers.seller_code',
       COUNT(*)
FROM (
  SELECT seller_code FROM sellers
  GROUP BY seller_code HAVING COUNT(*) > 1
) sub
UNION ALL
SELECT 'return_shipments.consignment_id',
       COUNT(*)
FROM (
  SELECT consignment_id FROM return_shipments
  GROUP BY consignment_id HAVING COUNT(*) > 1
) sub
UNION ALL
SELECT 'st_products.product_number',
       COUNT(*)
FROM (
  SELECT product_number FROM st_products
  GROUP BY product_number HAVING COUNT(*) > 1
) sub;
-- PASS 조건: 모든 duplicate_groups = 0

-- ============================================================================
-- GATE 9: upload_session_id 컬럼 확인
-- 기대: 1행 반환 (data_type = 'uuid')
-- V2 실측: 컬럼 없었음 → 008 마이그레이션 후 1행 반환
-- ============================================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sales_records'
  AND column_name = 'upload_session_id';
-- PASS 조건: 1행, data_type = 'uuid'

-- ============================================================================
-- GATE 10: _batch_progress 테이블 확인
-- 기대: 9행 반환 (9개 컬럼)
-- V2 실측: 테이블 없었음 → 009 마이그레이션 후 9행 반환
-- ============================================================================
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = '_batch_progress'
ORDER BY ordinal_position;
-- PASS 조건: 정확히 9개 컬럼 (id, batch_id, total, completed, failed, failed_ids, status, created_at, updated_at)

-- ============================================================================
-- GATE 11: Preflight 스냅샷 존재 확인 (파일 시스템 체크)
-- ============================================================================
-- 확인 방법: ls supabase/preflight/
-- 또는: 프로젝트 루트에서 파일 존재 여부 확인
-- PASS 조건: Preflight 중복/고아 FK 탐지 쿼리 실행 결과 스냅샷 파일 존재
--            (승인 전에는 정리 SQL 실행 금지)

-- ============================================================================
-- GATE 12: RLS 실측 테스트 (수동 검증)
-- ============================================================================
-- 테스트 12-1: anon (토큰 없음)으로 orders 조회 → 0 row
-- curl <SUPABASE_URL>/rest/v1/orders \
--   -H "apikey: <ANON_KEY>" \
--   -H "Authorization: Bearer <ANON_KEY>"
-- 기대: [] (빈 배열) 또는 403

-- 테스트 12-2: anon (토큰 일치)으로 orders 조회 → 해당 row만
-- curl <SUPABASE_URL>/rest/v1/orders \
--   -H "apikey: <ANON_KEY>" \
--   -H "Authorization: Bearer <ANON_KEY>" \
--   -H "x-hold-token: <VALID_TOKEN>"
-- 기대: hold_token이 일치하는 row만 반환

-- 테스트 12-3: anon update 시 토큰 불일치 또는 상태 불일치 → 0 row
-- curl -X PATCH <SUPABASE_URL>/rest/v1/orders?id=eq.<ORDER_ID> \
--   -H "apikey: <ANON_KEY>" \
--   -H "Authorization: Bearer <ANON_KEY>" \
--   -H "x-hold-token: WRONG_TOKEN" \
--   -d '{"status":"HOLD"}'
-- 기대: 0 row updated 또는 403

-- 테스트 12-4: consignment_requests anon (토큰 없음) 조회 → 0 row
-- curl <SUPABASE_URL>/rest/v1/consignment_requests \
--   -H "apikey: <ANON_KEY>" \
--   -H "Authorization: Bearer <ANON_KEY>"
-- 기대: [] (빈 배열) 또는 403

-- PASS 조건: 4개 테스트 모두 기대 결과와 일치
-- 전환 판정: 실측 3회 중 1회라도 current_setting 파싱 실패 시
--            RLS 방식 폐기 → Route 내 service_role 검증 방식 채택

-- ============================================================================
-- GATE 13: orders 테이블 USING(true) 정책 0건 확인
-- 기대: 0행 반환
-- V2 실측: "Allow all" (qual=true) 정책 존재 → 010 마이그레이션에서 DROP 처리
-- 주의: orders 테이블에 한정하여 검사 (다른 테이블의 정당한 정책 오탐 방지)
-- ============================================================================
SELECT policyname, tablename, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'orders'
  AND qual::text = 'true';
-- PASS 조건: 0행 (orders에 USING(true) 정책이 없어야 함)
-- 010에서 "Allow all" DROP + 토큰 기반 정책 CREATE 완료 후 0행

-- ============================================================================
-- GATE 14: RPC 원자성 검증 (수동 테스트)
-- 기대: create_order_with_items 중간 실패 시 전체 롤백
-- ============================================================================
-- 테스트 절차:
-- 1. 유효한 첫 번째 아이템 + product_number NULL인 두 번째 아이템으로 호출
-- SELECT create_order_with_items(
--   'ROLLBACK-TEST-001', '롤백테스트', '010-0000-0000', 'RECEIVED',
--   '[
--     {"product_number":"PN-VALID-001","brand":"TEST"},
--     {"brand":"NO-PN"}
--   ]'::jsonb
-- );
-- 기대: ERROR '주문 아이템에 product_number가 누락되었습니다'
--
-- 2. 롤백 확인: orders 테이블에 'ROLLBACK-TEST-001' 없음
-- SELECT * FROM orders WHERE order_number = 'ROLLBACK-TEST-001';
-- 기대: 0행 (전체 롤백됨)
--
-- 3. order_items에도 'PN-VALID-001' 관련 row 없음
-- SELECT * FROM order_items WHERE product_number = 'PN-VALID-001';
-- 기대: 0행 (전체 롤백됨)
--
-- PASS 조건: 에러 발생 + orders/order_items 모두 롤백 확인
-- 참조: deep-checklist.md §3.3 원자성

-- ============================================================================
-- Phase 0 게이트 총평
-- ============================================================================
-- 자동 검증 항목 (SQL 실행): GATE 1, 2, 3, 4, 5, 8, 9, 10, 13
-- 수동 검증 항목 (가이드 참조): GATE 6, 7, 11, 12, 14
-- 전체 14개 항목 PASS 필수
-- Ralph Loop L3 적용: 동시성 3 / RLS 3 / 운영 2 시나리오 + 3연속 PASS 확보 후 Phase 1 진행
--
-- V2 실측 기반 기대 동작:
--   GATE 1: V2에 CHECK 이미 존재 → 마이그레이션 전/후 모두 PASS
--   GATE 2: V2 기존 3건 + 신규 2건 = 5건 → PASS
--   GATE 4: V2 orders RLS 이미 활성화 → consignment_requests만 신규 확인
--   GATE 13: V2 "Allow all" → 010에서 DROP → PASS
