/**
 * 00_detect_duplicates.sql -- Phase 0 Preflight: Duplicate Detection
 * WHY:  Phase 0 migrations add UNIQUE constraints to 5 columns. If duplicates
 *       exist the ALTER TABLE will fail with a unique-violation error.
 *       Running this BEFORE the migration lets us fix data first.
 * HOW:  Pure SELECT (read-only). Each section groups by the target column and
 *       returns rows where COUNT(*) > 1.
 * WHERE: Referenced in plan5.md -- Phase 0 Gate Requirements.
 *
 * Usage:  psql $DATABASE_URL -f supabase/preflight/00_detect_duplicates.sql
 * Expect: ALL five queries return 0 rows for a clean Phase Gate pass.
 */

-- ============================================================
-- 1. settlement_queue(match_id) -- planned UNIQUE constraint
-- ============================================================
SELECT
    'settlement_queue.match_id' AS target,
    match_id                    AS duplicate_value,
    COUNT(*)                    AS cnt
FROM public.settlement_queue
WHERE match_id IS NOT NULL
GROUP BY match_id
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- ============================================================
-- 2. sellers(phone) -- planned UNIQUE constraint
-- ============================================================
SELECT
    'sellers.phone' AS target,
    phone           AS duplicate_value,
    COUNT(*)        AS cnt
FROM public.sellers
WHERE phone IS NOT NULL
GROUP BY phone
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- ============================================================
-- 3. sellers(seller_code) -- planned UNIQUE constraint
-- ============================================================
SELECT
    'sellers.seller_code' AS target,
    seller_code            AS duplicate_value,
    COUNT(*)               AS cnt
FROM public.sellers
WHERE seller_code IS NOT NULL
GROUP BY seller_code
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- ============================================================
-- 4. return_shipments(consignment_id) -- planned UNIQUE constraint
-- ============================================================
SELECT
    'return_shipments.consignment_id' AS target,
    consignment_id                     AS duplicate_value,
    COUNT(*)                           AS cnt
FROM public.return_shipments
WHERE consignment_id IS NOT NULL
GROUP BY consignment_id
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- ============================================================
-- 5. st_products(product_number) -- planned UNIQUE constraint
-- ============================================================
SELECT
    'st_products.product_number' AS target,
    product_number                AS duplicate_value,
    COUNT(*)                      AS cnt
FROM public.st_products
WHERE product_number IS NOT NULL
GROUP BY product_number
HAVING COUNT(*) > 1
ORDER BY cnt DESC;
