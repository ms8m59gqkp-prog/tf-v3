-- G6-4: 토큰 만료 컬럼 추가
-- WHY: adjustment_token / hold_token에 만료 시점이 없어 무기한 유효 → 보안 취약
-- HOW: nullable TIMESTAMPTZ 컬럼 2개 추가 (기존 데이터는 NULL → 만료 없음으로 처리)

ALTER TABLE consignment_requests
  ADD COLUMN IF NOT EXISTS adjustment_token_expires_at TIMESTAMPTZ;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS hold_token_expires_at TIMESTAMPTZ;
