-- 20260304000003_performance_indexes.sql
-- WHY: RPC FOR UPDATE가 인덱스 없이 풀스캔 → 타임아웃 (SIM-08)
-- HOW: IF NOT EXISTS로 멱등성 보장
-- WHERE: plan5.md §3.1.3
-- APPLY: db push (CONCURRENTLY 제거 — 트랜잭션 블록 내 실행 호환)
--
-- [V2 실측 반영] 2026-03-04
-- idx_orders_status              → 이미 존재 → IF NOT EXISTS로 스킵
-- idx_sales_records_match_status → 이미 존재 → IF NOT EXISTS로 스킵
-- idx_settlement_queue_seller_id → 이미 존재 → IF NOT EXISTS로 스킵
-- idx_consignment_seller         → 이미 존재 (idx_consignment_seller) → IF NOT EXISTS로 스킵
-- idx_sold_items_seller_settlement → 없음 → 추가 필요
--
-- NOTE: CONCURRENTLY는 트랜잭션 블록 내에서 사용 불가.
--       supabase db push는 트랜잭션 내 실행이므로 CONCURRENTLY 제거.
--       운영 환경에서 무중단 적용이 필요하면 supabase db execute --file 사용.

CREATE INDEX IF NOT EXISTS idx_sold_items_seller_settlement
  ON sold_items(seller_id, settlement_status);

CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders(status);

CREATE INDEX IF NOT EXISTS idx_sales_records_match_status
  ON sales_records(match_status);

CREATE INDEX IF NOT EXISTS idx_settlement_queue_seller_id
  ON settlement_queue(seller_id);

CREATE INDEX IF NOT EXISTS idx_consignment_seller
  ON consignment_requests(seller_id, status);
