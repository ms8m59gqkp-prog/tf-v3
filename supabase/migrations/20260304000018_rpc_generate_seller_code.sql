-- 20260304000018_rpc_generate_seller_code.sql
-- WHY: 셀러코드를 이름+전화+주소 기반 5자리 숫자 랜덤 고유값으로 생성
-- HOW: hash(name+phone+address) → 5자리 숫자 (00000~99999), 충돌 시 재해싱 (최대 1000회)
-- WHERE: 셀러 등록 API
-- APPLY: db push

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
    -- 입력값 + 시도 횟수를 결합해 해싱 (충돌 시 다른 결과)
    v_hash := encode(digest(v_input || v_attempts::TEXT, 'sha256'), 'hex');
    -- 해시 앞 8자리(hex)를 정수로 변환 후 10000으로 나눈 나머지 → 4자리 숫자
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
