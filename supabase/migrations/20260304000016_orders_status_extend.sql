-- 20260304000016_orders_status_extend.sql
-- WHY: V2 CHECK 8값에 CONFIRMED, CANCELLED 추가 (V3 운영 필수)
-- HOW: DROP + ADD CHECK constraint
-- WHERE: orders.status 컬럼
-- APPLY: db push

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
ADD CONSTRAINT orders_status_check
CHECK (status IN (
  'APPLIED', 'SHIPPING', 'COLLECTED', 'INSPECTED',
  'PRICE_ADJUSTING', 'RE_INSPECTED', 'IMAGE_PREPARING', 'IMAGE_COMPLETE',
  'CONFIRMED', 'CANCELLED'
));
