-- 20260304000019_replace_generate_product_number.sql
-- WHY: 상품번호 체계 변경 — CT-{CODE}-{SEQ} → 12자리 숫자 (YYMMDD + 랜덤2자리 + 셀러코드4자리)
-- HOW: CREATE OR REPLACE (signature 동일: p_seller_id UUID → RETURNS TEXT)
-- WHERE: 위탁 승인 시 상품번호 생성
-- APPLY: db push

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
  -- Step 1: 셀러코드 조회 (4자리 숫자)
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
