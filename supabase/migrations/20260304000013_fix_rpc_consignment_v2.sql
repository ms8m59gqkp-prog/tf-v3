-- 20260304000013_fix_rpc_consignment_v2.sql
-- WHY: RPC 007의 V2 DB 불일치 5건(C-3~C-7) + 데이터 무결성 2건(H-1, H-2) 해소
--      - consignment_id 컬럼 미존재, condition→product_condition, product_name/sale_price NOT NULL 누락
--      - 'RECEIVED'→'APPLIED' V2 CHECK 준수, seller_id 정산 연결
-- HOW: CREATE OR REPLACE로 함수 전체 재정의 + 파라미터 3개 추가 (DEFAULT)
-- WHERE: phase0-v2-audit-report.md FIX-2 (C-3~C-7, H-1, H-2 해소)
-- APPLY: db push

CREATE OR REPLACE FUNCTION complete_consignment(
  p_consignment_id uuid,
  p_product_number text,
  p_product_name text DEFAULT NULL,
  p_sale_price integer DEFAULT 0,
  p_seller_id uuid DEFAULT NULL,
  p_brand text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_condition text DEFAULT NULL,
  p_size text DEFAULT NULL,
  p_color text DEFAULT NULL,
  p_measurements jsonb DEFAULT NULL,
  p_order_number text DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_consignment record;
  v_product_id uuid;
  v_order_id uuid;
  v_actual_seller_id uuid;
  v_actual_product_name text;
BEGIN
  -- Step 1: Validate consignment
  SELECT * INTO v_consignment
    FROM consignment_requests
    WHERE id = p_consignment_id AND status = 'approved'
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '위탁 요청을 찾을 수 없거나 approved 상태가 아닙니다 (id: %)', p_consignment_id;
  END IF;

  -- seller_id: 파라미터 > consignment_requests.seller_id
  v_actual_seller_id := COALESCE(p_seller_id, v_consignment.seller_id);
  -- product_name: 파라미터 > consignment_requests.product_name
  v_actual_product_name := COALESCE(p_product_name, v_consignment.product_name);

  -- Step 2: Insert st_products (V2 컬럼명 사용)
  BEGIN
    INSERT INTO st_products (
      product_number, product_name, seller_id, sale_price,
      product_type, is_active, photo_status, smartstore_status,
      brand, category, product_condition, size, color, measurements,
      consignment_date
    ) VALUES (
      p_product_number, v_actual_product_name, v_actual_seller_id, p_sale_price,
      'consignment', true, 'pending', 'draft',
      p_brand, p_category, p_condition, p_size, p_color, p_measurements,
      CURRENT_DATE
    )
    RETURNING id INTO v_product_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION '상품번호가 이미 존재합니다: %', p_product_number;
  END;

  -- Step 3: Create order if data provided
  IF p_order_number IS NOT NULL THEN
    INSERT INTO orders (order_number, customer_name, phone, status)
    VALUES (p_order_number, p_customer_name, p_customer_phone, 'APPLIED')
    RETURNING id INTO v_order_id;

    INSERT INTO order_items (order_id, product_number, brand, model, condition)
    VALUES (v_order_id, p_product_number, COALESCE(p_brand, ''), COALESCE(v_actual_product_name, ''), COALESCE(p_condition, 'N'));
  END IF;

  -- Step 4: Update consignment status + link product
  UPDATE consignment_requests
    SET status = 'completed',
        product_id = v_product_id,
        inspected_at = now(),
        updated_at = now()
    WHERE id = p_consignment_id;

  RETURN v_product_id;
END;
$$ LANGUAGE plpgsql;
