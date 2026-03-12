-- fail_settlement RPC: 정산 실패 처리 (원자적 상태 전이 + 사유 기록 + sold_items 복원)
-- WHY: draft/confirmed → failed 전이 시 사유 기록 + sold_items를 pending으로 복원 (Phase 4 §1.9)
-- HOW: optimistic lock + fail_reason 컬럼 추가 + sold_items 롤백 + 단일 트랜잭션

-- 1) fail_reason 컬럼 추가
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS fail_reason TEXT;

-- 2) RPC 함수
CREATE OR REPLACE FUNCTION fail_settlement(
  p_id UUID,
  p_reason TEXT,
  p_expected_status TEXT
) RETURNS SETOF settlements AS $$
BEGIN
  IF p_expected_status NOT IN ('draft', 'confirmed') THEN
    RAISE EXCEPTION '실패 처리 불가: % 상태에서는 failed로 전이할 수 없습니다', p_expected_status;
  END IF;

  -- 정산 상태를 failed로 전이
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
