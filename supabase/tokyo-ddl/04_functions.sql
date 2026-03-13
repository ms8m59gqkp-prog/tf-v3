-- ============================================================
-- Tokyo DDL: 04_functions.sql
-- Total: 13 functions
-- Generated: 2026-03-05
-- ============================================================

-- ============================================================
-- Function: update_updated_at
-- Source: V3 migration 014 (20260304000014_updated_at_triggers.sql)
-- DELTA: N/A
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Function: create_order_with_items
-- Source: V2 original
-- DELTA: N/A
-- ============================================================
CREATE OR REPLACE FUNCTION create_order_with_items(
  p_order_number text,
  p_customer_name text,
  p_customer_phone text,
  p_status text,
  p_items jsonb
) RETURNS uuid
  LANGUAGE plpgsql
AS $function$
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
$function$;

-- ============================================================
-- Function: create_settlement_with_items
-- Source: V3 migration 012 (20260304000012_fix_rpc_settlement_v2.sql)
-- DELTA: DELTA-2 (V2 bugs: period_start→settlement_period_start, 'pending'→'draft', etc.)
-- ============================================================
CREATE OR REPLACE FUNCTION create_settlement_with_items(
  p_seller_id uuid,
  p_period_start date,
  p_period_end date,
  p_total_sales numeric,
  p_commission_rate numeric,
  p_commission_amount numeric,
  p_settlement_amount numeric,
  p_sold_item_ids uuid[],
  p_return_deduction numeric DEFAULT 0
) RETURNS uuid AS $$
DECLARE
  v_settlement_id uuid;
  v_locked_count int;
  v_expected_count int;
BEGIN
  v_expected_count := COALESCE(array_length(p_sold_item_ids, 1), 0);
  IF v_expected_count = 0 THEN
    RAISE EXCEPTION '정산 항목이 비어있습니다';
  END IF;

  SELECT COUNT(*) INTO v_locked_count
    FROM sold_items
    WHERE id = ANY(p_sold_item_ids)
      AND settlement_status = 'pending'
    FOR UPDATE;

  IF v_locked_count != v_expected_count THEN
    RAISE EXCEPTION '잠금 실패: 예상 %건 중 %건만 pending', v_expected_count, v_locked_count;
  END IF;

  INSERT INTO settlements (
    seller_id, settlement_period_start, settlement_period_end,
    total_sales, commission_rate, commission_amount, settlement_amount,
    return_deduction, item_count, status
  ) VALUES (
    p_seller_id, p_period_start, p_period_end,
    p_total_sales, p_commission_rate, p_commission_amount, p_settlement_amount,
    COALESCE(p_return_deduction, 0), v_expected_count, 'draft'
  ) RETURNING id INTO v_settlement_id;

  INSERT INTO settlement_items (settlement_id, sold_item_id)
    SELECT v_settlement_id, unnest(p_sold_item_ids);

  UPDATE sold_items
    SET settlement_status = 'settled'
    WHERE id = ANY(p_sold_item_ids);

  RETURN v_settlement_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Function: complete_consignment
-- Source: V3 migration 013 (20260304000013_fix_rpc_consignment_v2.sql)
-- DELTA: DELTA-3 (V2 bugs: missing columns, condition→product_condition, status, etc.)
-- ============================================================
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

-- ============================================================
-- Function: generate_product_number
-- Source: V3 migration 019 (20260304000019_replace_generate_product_number.sql)
-- 13자리 숫자: YYMMDD(검수일) + 랜덤2자리 + 셀러코드5자리
-- ============================================================
CREATE OR REPLACE FUNCTION generate_product_number(p_seller_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_seller_code TEXT;
  v_date TEXT;
  v_random TEXT;
  v_product_number TEXT;
  v_exists BOOLEAN;
  v_attempts INT := 0;
BEGIN
  -- Step 1: 셀러코드 조회 (5자리 숫자)
  SELECT seller_code INTO v_seller_code
  FROM sellers WHERE id = p_seller_id;

  IF v_seller_code IS NULL THEN
    RAISE EXCEPTION '셀러를 찾을 수 없습니다: %', p_seller_id;
  END IF;

  -- Step 2: 검수완료일 = 현재 날짜 (YYMMDD)
  v_date := to_char(now(), 'YYMMDD');

  -- Step 3: 랜덤 2자리 숫자 + 셀러코드 조합, 중복 시 재시도
  PERFORM pg_advisory_xact_lock(hashtext('gen_prod_num_' || v_seller_code));

  LOOP
    v_random := LPAD((floor(random() * 100))::INT::TEXT, 2, '0');
    v_product_number := v_date || v_random || v_seller_code;

    SELECT EXISTS(SELECT 1 FROM st_products WHERE product_number = v_product_number) INTO v_exists;
    EXIT WHEN NOT v_exists;

    v_attempts := v_attempts + 1;
    IF v_attempts > 100 THEN
      RAISE EXCEPTION '고유 상품번호 생성 실패 (100회 시도 초과)';
    END IF;
  END LOOP;

  RETURN v_product_number;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION generate_product_number(UUID) TO authenticated, service_role;

-- ============================================================
-- Function: generate_seller_code
-- Source: V3 migration 018 (20260304000018_rpc_generate_seller_code.sql)
-- 5자리 숫자: hash(이름+전화+주소) 기반 랜덤 고유값
-- ============================================================
CREATE OR REPLACE FUNCTION generate_seller_code(
  p_name TEXT,
  p_phone TEXT,
  p_address TEXT DEFAULT ''
)
RETURNS TEXT AS $$
DECLARE
  v_input TEXT;
  v_hash TEXT;
  v_code TEXT;
  v_exists BOOLEAN;
  v_attempts INT := 0;
BEGIN
  v_input := p_name || p_phone || COALESCE(p_address, '');

  LOOP
    v_hash := encode(digest(v_input || v_attempts::TEXT, 'sha256'), 'hex');
    v_code := LPAD((ABS(('x' || left(v_hash, 8))::BIT(32)::INT) % 100000)::TEXT, 5, '0');

    SELECT EXISTS(SELECT 1 FROM sellers WHERE seller_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;

    v_attempts := v_attempts + 1;
    IF v_attempts > 1000 THEN
      RAISE EXCEPTION '고유 셀러코드 생성 실패 (1000회 시도 초과)';
    END IF;
  END LOOP;

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION generate_seller_code(TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ============================================================
-- Function: find_brand
-- Source: V2 original
-- DELTA: DELTA-6
-- ============================================================
CREATE OR REPLACE FUNCTION find_brand(search_term text)
RETURNS TABLE(official_name text, alias text)
  LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT ba.official_name, ba.alias
  FROM brand_aliases ba
  WHERE ba.alias ILIKE '%' || search_term || '%'
     OR ba.official_name ILIKE '%' || search_term || '%'
  ORDER BY
    -- 정확한 매칭 우선
    CASE WHEN ba.alias ILIKE search_term THEN 0
         WHEN ba.official_name ILIKE search_term THEN 0
         ELSE 1 END,
    ba.official_name
  LIMIT 10;
END;
$function$;

-- ============================================================
-- Function: generate_order_number
-- Source: V2 original
-- DELTA: DELTA-6
-- ============================================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text
  LANGUAGE plpgsql
AS $function$
DECLARE
  num TEXT;
BEGIN
  LOOP
    num := TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE order_number = num);
  END LOOP;
  RETURN num;
END;
$function$;

-- ============================================================
-- Function: get_commission_rate
-- Source: V2 original
-- DELTA: DELTA-6
-- ============================================================
CREATE OR REPLACE FUNCTION get_commission_rate(p_seller_id uuid)
RETURNS numeric
  LANGUAGE plpgsql
AS $function$
DECLARE
  v_individual_rate DECIMAL;
  v_tier TEXT;
BEGIN
  SELECT commission_rate, seller_tier
  INTO v_individual_rate, v_tier
  FROM sellers WHERE id = p_seller_id;

  -- 개별 수수료율이 설정되어 있으면 우선
  IF v_individual_rate IS NOT NULL AND v_individual_rate > 0 THEN
    RETURN v_individual_rate;
  END IF;

  -- 등급별 기본 수수료율
  CASE v_tier
    WHEN 'general' THEN RETURN 0.25;
    WHEN 'employee' THEN RETURN 0.20;
    WHEN 'vip' THEN RETURN 0.20;
    ELSE RETURN 0.25;
  END CASE;
END;
$function$;

-- ============================================================
-- Function: pgp_sym_decrypt_text
-- Source: V2 original
-- DELTA: DELTA-6, DELTA-10
-- ============================================================
CREATE OR REPLACE FUNCTION pgp_sym_decrypt_text(cipher_text text, encryption_key text)
RETURNS text
  LANGUAGE sql
AS $function$
  SELECT pgp_sym_decrypt(decode(cipher_text, 'base64'), encryption_key);
$function$;

-- ============================================================
-- Function: pgp_sym_encrypt_text
-- Source: V2 original
-- DELTA: DELTA-6, DELTA-10
-- ============================================================
CREATE OR REPLACE FUNCTION pgp_sym_encrypt_text(plain_text text, encryption_key text)
RETURNS text
  LANGUAGE sql
AS $function$
  SELECT encode(pgp_sym_encrypt(plain_text, encryption_key), 'base64');
$function$;

-- ============================================================
-- Function: increment_batch_completed
-- Source: V3 batch processing
-- Atomically increments completed count for a batch
-- ============================================================
CREATE OR REPLACE FUNCTION increment_batch_completed(p_batch_id TEXT)
RETURNS void
  LANGUAGE plpgsql
AS $function$
DECLARE
  v_row_count INT;
BEGIN
  IF p_batch_id IS NULL OR p_batch_id = '' THEN
    RAISE EXCEPTION '배치 ID가 유효하지 않습니다';
  END IF;

  UPDATE _batch_progress
    SET completed = completed + 1,
        updated_at = now()
    WHERE batch_id = p_batch_id;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  IF v_row_count = 0 THEN
    RAISE EXCEPTION '배치를 찾을 수 없습니다: %', p_batch_id;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION increment_batch_completed(TEXT) TO service_role;

-- ============================================================
-- Function: increment_batch_failed
-- Source: V3 batch processing
-- Atomically increments failed count and appends failed_id
-- ============================================================
CREATE OR REPLACE FUNCTION increment_batch_failed(p_batch_id TEXT, p_failed_id TEXT)
RETURNS void
  LANGUAGE plpgsql
AS $function$
DECLARE
  v_row_count INT;
BEGIN
  IF p_batch_id IS NULL OR p_batch_id = '' THEN
    RAISE EXCEPTION '배치 ID가 유효하지 않습니다';
  END IF;

  UPDATE _batch_progress
    SET failed = failed + 1,
        failed_ids = failed_ids || jsonb_build_array(p_failed_id),
        updated_at = now()
    WHERE batch_id = p_batch_id;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  IF v_row_count = 0 THEN
    RAISE EXCEPTION '배치를 찾을 수 없습니다: %', p_batch_id;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION increment_batch_failed(TEXT, TEXT) TO service_role;

-- ============================================================
-- Function: check_consignment_duplicates
-- Source: V3 bulk consignment processing
-- Exact (seller_id, product_name) pair matching via JSONB input
-- ============================================================
CREATE OR REPLACE FUNCTION check_consignment_duplicates(p_pairs jsonb)
RETURNS TABLE(seller_id uuid, product_name text)
  LANGUAGE plpgsql
  STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT cr.seller_id, cr.product_name
  FROM consignment_requests cr
  WHERE (cr.seller_id, cr.product_name) IN (
    SELECT (p->>'seller_id')::uuid, p->>'product_name'
    FROM jsonb_array_elements(p_pairs) AS p
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION check_consignment_duplicates(jsonb) TO service_role;

-- ============================================================
-- Function: fail_settlement
-- Source: V3 migration 020 (20260304000020_rpc_fail_settlement.sql)
-- Phase 4 §1.9: 정산 실패 처리 (원자적 상태 전이 + 사유 기록 + sold_items 복원)
-- ============================================================
CREATE OR REPLACE FUNCTION fail_settlement(
  p_id UUID,
  p_reason TEXT,
  p_expected_status TEXT
) RETURNS SETOF settlements AS $$
BEGIN
  IF p_expected_status NOT IN ('draft', 'confirmed') THEN
    RAISE EXCEPTION '실패 처리 불가: % 상태에서는 failed로 전이할 수 없습니다', p_expected_status;
  END IF;

  RETURN QUERY
    UPDATE settlements
    SET status = 'failed',
        fail_reason = p_reason
    WHERE id = p_id
      AND status = p_expected_status
    RETURNING *;

  IF NOT FOUND THEN
    RAISE EXCEPTION '실패 처리 불가: ID % (expected: %)', p_id, p_expected_status;
  END IF;

  -- sold_items를 pending으로 복원 (재정산 가능하도록)
  UPDATE sold_items
    SET settlement_status = 'pending'
    WHERE id IN (
      SELECT sold_item_id FROM settlement_items WHERE settlement_id = p_id
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION fail_settlement(UUID, TEXT, TEXT) TO service_role;
