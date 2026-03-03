-- 20260304000008_upload_session_id.sql
-- WHY: V2에서 DELETE .eq('match_status', 'unmatched') → 동시 관리자 업로드 시 상대 데이터 삭제 (v5 DAT-09)
--      세션 기반 삭제로 자기 업로드 데이터만 정리 가능하게 변경 (R4-01)
-- HOW: sales_records에 upload_session_id 컬럼 추가 + 부분 인덱스
--      기존 데이터: upload_session_id = NULL (마이그레이션 영향 없음)
--      V3부터 모든 업로드에 세션 ID 발급
-- WHERE: plan5.md §3.1.6
-- APPLY: supabase db execute (CONCURRENTLY 인덱스는 트랜잭션 밖에서 실행 필요)
--
-- ▸ V2 실측 반영 (2026-03-04)
--   - sales_records에 upload_session_id 컬럼 없음 → 추가 필요 확인
--   - 기존 컬럼 18개: id, sale_date, buyer_name, naver_order_no, brand,
--     product_name, product_code, product_number, original_price, discount_rate,
--     sale_amount, quantity, final_amount, is_consignment, consignment_seller,
--     match_status, upload_batch, created_at
--   - IF NOT EXISTS로 멱등성 보장 (재실행 안전)

-- 1) upload_session_id 컬럼 추가 (이미 있으면 스킵)
ALTER TABLE sales_records ADD COLUMN IF NOT EXISTS upload_session_id uuid;

-- 2) 부분 인덱스 (CONCURRENTLY는 트랜잭션 밖에서 실행, IF NOT EXISTS로 멱등성)
CREATE INDEX IF NOT EXISTS idx_sales_records_session
  ON sales_records(upload_session_id)
  WHERE upload_session_id IS NOT NULL;
