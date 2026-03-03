/**
 * 01_detect_orphan_fks.sql -- Phase 0 Preflight: Orphan Foreign Key Detection
 * WHY:  Phase 0 migrations add or enforce FOREIGN KEY constraints. If child
 *       rows reference non-existent parent rows, ALTER TABLE ... ADD CONSTRAINT
 *       will fail. This script surfaces those orphans before we migrate.
 * HOW:  Pure SELECT (read-only). Each section LEFT JOINs the child table to its
 *       parent and returns rows where the parent side is NULL (orphan).
 *       Results are capped at LIMIT 200 per check to keep output manageable.
 * WHERE: Referenced in plan5.md -- Phase 0 Gate Requirements.
 *
 * Usage:  psql $DATABASE_URL -f supabase/preflight/01_detect_orphan_fks.sql
 * Expect: ALL eight queries return 0 rows for a clean Phase Gate pass.
 */

-- ============================================================
-- 1. sold_items.seller_id -> sellers.id
-- ============================================================
SELECT
    'sold_items.seller_id -> sellers.id' AS fk_check,
    c.id          AS child_id,
    c.seller_id   AS orphan_fk_value
FROM public.sold_items c
LEFT JOIN public.sellers p ON p.id = c.seller_id
WHERE c.seller_id IS NOT NULL
  AND p.id IS NULL
LIMIT 200;

-- ============================================================
-- 2. settlement_items.settlement_id -> settlements.id
-- ============================================================
SELECT
    'settlement_items.settlement_id -> settlements.id' AS fk_check,
    c.id              AS child_id,
    c.settlement_id   AS orphan_fk_value
FROM public.settlement_items c
LEFT JOIN public.settlements p ON p.id = c.settlement_id
WHERE c.settlement_id IS NOT NULL
  AND p.id IS NULL
LIMIT 200;

-- ============================================================
-- 3. settlement_items.sold_item_id -> sold_items.id
-- ============================================================
SELECT
    'settlement_items.sold_item_id -> sold_items.id' AS fk_check,
    c.id             AS child_id,
    c.sold_item_id   AS orphan_fk_value
FROM public.settlement_items c
LEFT JOIN public.sold_items p ON p.id = c.sold_item_id
WHERE c.sold_item_id IS NOT NULL
  AND p.id IS NULL
LIMIT 200;

-- ============================================================
-- 4. order_items.order_id -> orders.id
-- ============================================================
SELECT
    'order_items.order_id -> orders.id' AS fk_check,
    c.id         AS child_id,
    c.order_id   AS orphan_fk_value
FROM public.order_items c
LEFT JOIN public.orders p ON p.id = c.order_id
WHERE c.order_id IS NOT NULL
  AND p.id IS NULL
LIMIT 200;

-- ============================================================
-- 5. consignment_requests.seller_id -> sellers.id
-- ============================================================
SELECT
    'consignment_requests.seller_id -> sellers.id' AS fk_check,
    c.id          AS child_id,
    c.seller_id   AS orphan_fk_value
FROM public.consignment_requests c
LEFT JOIN public.sellers p ON p.id = c.seller_id
WHERE c.seller_id IS NOT NULL
  AND p.id IS NULL
LIMIT 200;

-- ============================================================
-- 6. return_shipments.consignment_id -> consignment_requests.id
-- ============================================================
SELECT
    'return_shipments.consignment_id -> consignment_requests.id' AS fk_check,
    c.id               AS child_id,
    c.consignment_id   AS orphan_fk_value
FROM public.return_shipments c
LEFT JOIN public.consignment_requests p ON p.id = c.consignment_id
WHERE c.consignment_id IS NOT NULL
  AND p.id IS NULL
LIMIT 200;

-- ============================================================
-- 7. settlement_queue.seller_id -> sellers.id
-- ============================================================
SELECT
    'settlement_queue.seller_id -> sellers.id' AS fk_check,
    c.id          AS child_id,
    c.seller_id   AS orphan_fk_value
FROM public.settlement_queue c
LEFT JOIN public.sellers p ON p.id = c.seller_id
WHERE c.seller_id IS NOT NULL
  AND p.id IS NULL
LIMIT 200;

-- ============================================================
-- 8. st_products.consignment_id -> consignment_requests.id (if FK exists)
-- ============================================================
SELECT
    'st_products.consignment_id -> consignment_requests.id' AS fk_check,
    c.id               AS child_id,
    c.consignment_id   AS orphan_fk_value
FROM public.st_products c
LEFT JOIN public.consignment_requests p ON p.id = c.consignment_id
WHERE c.consignment_id IS NOT NULL
  AND p.id IS NULL
LIMIT 200;
