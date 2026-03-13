-- =============================================================================
-- 20260313000024_rls_hardening_rpc_fix.sql
-- C-1: USING(true) RLS 정책을 role 기반 정책으로 교체 (보안 강화)
-- C-2: create_settlement_with_items RPC에 p_return_deduction 파라미터 추가 (런타임 버그 수정)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- C-1: RLS 정책 강화 — USING(true) 쓰기 정책 5건 제거 후 service_role/admin 패턴으로 교체
-- WHY: USING(true)는 모든 역할(anon 포함)에 쓰기 권한을 부여하므로 보안 취약점
-- NOTE: public SELECT 정책(참조 데이터 읽기용)은 유지
-- ---------------------------------------------------------------------------

-- 1. market_prices: "Allow service write market_prices" → service_role + admin
DROP POLICY IF EXISTS "Allow service write market_prices" ON public.market_prices;

CREATE POLICY "service_all_market_prices" ON public.market_prices
  FOR ALL TO public
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_market_prices" ON public.market_prices
  FOR ALL TO public
  USING ((auth.jwt() ->> 'role') = 'admin');

-- 2. order_items: "Allow all" → service_role + admin
DROP POLICY IF EXISTS "Allow all" ON public.order_items;

CREATE POLICY "service_all_order_items" ON public.order_items
  FOR ALL TO public
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_order_items" ON public.order_items
  FOR ALL TO public
  USING ((auth.jwt() ->> 'role') = 'admin');

-- 3. photo_uploads: "Allow all" → service_role + admin
DROP POLICY IF EXISTS "Allow all" ON public.photo_uploads;

CREATE POLICY "service_all_photo_uploads" ON public.photo_uploads
  FOR ALL TO public
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_photo_uploads" ON public.photo_uploads
  FOR ALL TO public
  USING ((auth.jwt() ->> 'role') = 'admin');

-- 4. photos: "Allow all" → service_role + admin
DROP POLICY IF EXISTS "Allow all" ON public.photos;

CREATE POLICY "service_all_photos" ON public.photos
  FOR ALL TO public
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_photos" ON public.photos
  FOR ALL TO public
  USING ((auth.jwt() ->> 'role') = 'admin');

-- 5. price_references: "Allow service write price_references" → service_role + admin
DROP POLICY IF EXISTS "Allow service write price_references" ON public.price_references;

CREATE POLICY "service_all_price_references" ON public.price_references
  FOR ALL TO public
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_price_references" ON public.price_references
  FOR ALL TO public
  USING ((auth.jwt() ->> 'role') = 'admin');

-- ---------------------------------------------------------------------------
-- C-2: create_settlement_with_items RPC — p_return_deduction 파라미터 추가
-- WHY: settlement-status.repo.ts가 p_return_deduction을 전달하지만 RPC가 수신하지 않아
--      런타임에 "unexpected parameter" 에러 발생
-- FIX: p_return_deduction numeric DEFAULT 0 추가 + INSERT에 return_deduction 컬럼 포함
-- ---------------------------------------------------------------------------

-- 기존 함수 시그니처를 DROP 후 재생성 (파라미터 변경이므로 CREATE OR REPLACE 불가)
DROP FUNCTION IF EXISTS create_settlement_with_items(uuid, date, date, numeric, numeric, numeric, numeric, uuid[]);

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

  -- 비관적 잠금: pending 상태인 항목만 잠금 후 개수 검증
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
