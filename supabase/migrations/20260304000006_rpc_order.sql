-- 20260304000006_rpc_order.sql
-- V2 실측: create_order_with_items RPC 미존재, 신규 생성
-- 멱등성: CREATE OR REPLACE FUNCTION 사용 → 재실행 안전
-- WHY: 주문 생성 시 order + order_items를 원자적으로 insert 보장
--      빈 아이템 배열 및 product_number 누락 엣지 케이스 방어
-- HOW: jsonb_array_length 검증 → order insert → items loop insert (product_number NULL 체크)
-- WHERE: plan5.md §3.1.5 (006_rpc_order.sql)
-- APPLY: db push

CREATE OR REPLACE FUNCTION create_order_with_items(
  p_order_number text,
  p_customer_name text,
  p_customer_phone text,
  p_status text,
  p_items jsonb
) RETURNS uuid AS $$
DECLARE
  v_order_id uuid;
  v_item jsonb;
  v_items_count int;
BEGIN
  v_items_count := jsonb_array_length(p_items);
  IF v_items_count = 0 THEN
    RAISE EXCEPTION '주문 아이템이 비어있습니다';
  END IF;

  INSERT INTO orders (order_number, customer_name, phone, status)
  VALUES (p_order_number, p_customer_name, p_customer_phone, p_status)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF v_item->>'product_number' IS NULL THEN
      RAISE EXCEPTION '주문 아이템에 product_number가 누락되었습니다';
    END IF;

    INSERT INTO order_items (
      order_id, product_number, brand, model, category,
      condition, size, measurements, inspection_status, customer_agreed
    ) VALUES (
      v_order_id,
      v_item->>'product_number',
      v_item->>'brand',
      COALESCE(v_item->>'model', ''),
      v_item->>'category',
      v_item->>'condition',
      v_item->>'size',
      (v_item->'measurements')::jsonb,
      COALESCE(v_item->>'inspection_status', 'pending'),
      COALESCE((v_item->>'customer_agreed')::boolean, false)
    );
  END LOOP;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;
