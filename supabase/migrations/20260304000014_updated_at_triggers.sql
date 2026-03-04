-- 20260304000014_updated_at_triggers.sql
-- WHY: V2에 존재하는 update_updated_at() 트리거 함수 + 3개 트리거가 V3 Phase 0에 누락
--      일반 UPDATE 쿼리에서 updated_at이 갱신되지 않는 문제 해소
-- HOW: CREATE OR REPLACE 트리거 함수 + IF NOT EXISTS로 멱등 트리거 생성
-- WHERE: phase0-v2-audit-report.md FIX-3 (H-5 해소)
-- APPLY: db push

-- 트리거 함수 (V2 계승)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3개 테이블에 트리거 부착 (멱등성)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sellers_updated_at') THEN
    CREATE TRIGGER sellers_updated_at BEFORE UPDATE ON sellers
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'st_products_updated_at') THEN
    CREATE TRIGGER st_products_updated_at BEFORE UPDATE ON st_products
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'consignment_requests_updated_at') THEN
    CREATE TRIGGER consignment_requests_updated_at BEFORE UPDATE ON consignment_requests
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;
