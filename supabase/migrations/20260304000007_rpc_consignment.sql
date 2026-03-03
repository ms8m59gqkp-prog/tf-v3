-- 20260304000007_rpc_consignment.sql
-- V2 실측: complete_consignment RPC 미존재, 신규 생성
-- 멱등성: CREATE OR REPLACE FUNCTION 사용 → 재실행 안전
-- WHY: 위탁 완료 처리 시 4단계를 원자적으로 실행 (상태 검증 → 상품 등록 → 주문 생성 → 상태 완료)
--      Rev.2와 동일 로직. Step 2에서 product_number UNIQUE 위반 시 명확한 에러 메시지 추가
-- HOW: 4단계 원자적 처리 (plpgsql 트랜잭션 내)
--      Step 1: consignment_requests 'approved' 상태 검증 + FOR UPDATE 잠금
--      Step 2: st_products INSERT (UNIQUE 위반 → 명확한 에러)
--      Step 3: order 데이터 제공 시 order + order_items 생성
--      Step 4: consignment_requests status → 'completed'
-- WHERE: plan5.md §3.1.5 (007_rpc_consignment.sql)
-- APPLY: db push
--
-- TODO: V2 소스 대조 필요
-- TODO: Confirm against V2 source via \df+ complete_consignment
--       이 함수는 V2 DB에서 추출한 원본과 대조 검증이 필요합니다.
--       아래는 plan5.md 명세 기반 재구성입니다.

CREATE OR REPLACE FUNCTION complete_consignment(
  p_consignment_id uuid,
  p_product_number text,
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
BEGIN
  -- Step 1: Validate consignment exists in 'approved' status (FOR UPDATE lock)
  SELECT * INTO v_consignment
    FROM consignment_requests
    WHERE id = p_consignment_id
      AND status = 'approved'
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '위탁 요청을 찾을 수 없거나 approved 상태가 아닙니다 (id: %)', p_consignment_id;
  END IF;

  -- Step 2: Insert product into st_products (UNIQUE violation → clear error)
  BEGIN
    INSERT INTO st_products (
      product_number, brand, category,
      condition, size, color, measurements,
      consignment_id
    ) VALUES (
      p_product_number, p_brand, p_category,
      p_condition, p_size, p_color, p_measurements,
      p_consignment_id
    )
    RETURNING id INTO v_product_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION '상품번호가 이미 존재합니다: % (st_products.product_number UNIQUE 위반)', p_product_number;
  END;

  -- Step 3: Create order if order data provided
  IF p_order_number IS NOT NULL THEN
    INSERT INTO orders (order_number, customer_name, phone, status)
    VALUES (p_order_number, p_customer_name, p_customer_phone, 'RECEIVED')
    RETURNING id INTO v_order_id;

    INSERT INTO order_items (order_id, product_number)
    VALUES (v_order_id, p_product_number);
  END IF;

  -- Step 4: Update consignment_requests status to 'completed'
  UPDATE consignment_requests
    SET status = 'completed',
        updated_at = now()
    WHERE id = p_consignment_id;

  RETURN v_product_id;
END;
$$ LANGUAGE plpgsql;
