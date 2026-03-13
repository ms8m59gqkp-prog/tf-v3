-- hold_token UNIQUE 제약 추가
-- WHY: 중복 토큰 방지 (보안 — 타인 주문 접근 차단)
-- HOW: 기존 일반 INDEX 삭제 → UNIQUE INDEX 생성

DROP INDEX IF EXISTS idx_orders_hold_token;
CREATE UNIQUE INDEX IF NOT EXISTS orders_hold_token_key
  ON public.orders USING btree (hold_token) WHERE (hold_token IS NOT NULL);
