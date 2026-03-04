-- 20260304000015_rpc_generate_product_number.sql
-- WHY: V2 generate_product_number RPC가 V3 Phase 0에 누락. 위탁 승인 시 상품번호 생성에 필수.
-- HOW: sellers.seller_code 기반 순번 채번 (CT-{SELLER_CODE}-{SEQ:3})
-- WHERE: 위탁 승인 API (PATCH /api/admin/consignments/[id], status=approved)
-- APPLY: db push

CREATE OR REPLACE FUNCTION generate_product_number(p_seller_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_seller_code TEXT;
  v_next_seq INTEGER;
  v_product_number TEXT;
BEGIN
  -- Step 1: 셀러 코드 조회
  SELECT seller_code INTO v_seller_code
  FROM sellers WHERE id = p_seller_id;

  IF v_seller_code IS NULL THEN
    RAISE EXCEPTION '셀러를 찾을 수 없습니다: %', p_seller_id;
  END IF;

  -- Step 2: 해당 셀러의 현재 최대 순번 조회 + 1
  -- pg_advisory_xact_lock으로 동시성 보호 (같은 셀러에 대한 동시 호출 시 직렬화)
  PERFORM pg_advisory_xact_lock(hashtext('gen_prod_num_' || v_seller_code));

  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(product_number, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO v_next_seq
  FROM st_products
  WHERE product_number LIKE 'CT-' || v_seller_code || '-%';

  -- Step 3: 형식 조립 (CT-{SELLER_CODE}-{SEQ:3})
  v_product_number := 'CT-' || v_seller_code || '-' || LPAD(v_next_seq::TEXT, 3, '0');

  RETURN v_product_number;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION generate_product_number(UUID) TO authenticated, service_role;
