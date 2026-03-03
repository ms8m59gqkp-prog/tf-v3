/**
 * 02_check_consignment_status_values.sql -- Phase 0 Preflight: Status Value Audit
 * WHY:  Phase 0 migration adds a CHECK constraint on consignment_requests.status
 *       allowing only a defined set of values. If the table already contains
 *       values outside that set, ALTER TABLE ... ADD CONSTRAINT will fail.
 *       This script inventories every distinct status value so we can remediate
 *       unexpected ones before migrating.
 * HOW:  Pure SELECT (read-only). Three queries:
 *       1) Distinct status values with row counts.
 *       2) Expected values cross-check (pending, received, inspecting,
 *          approved, rejected, on_hold, completed).
 *       3) Unexpected values flagged explicitly.
 * WHERE: Referenced in plan5.md -- Phase 0 Gate Requirements.
 *
 * Usage:  psql $DATABASE_URL -f supabase/preflight/02_check_consignment_status_values.sql
 * Expect: Query 3 returns 0 rows for a clean Phase Gate pass.
 */

-- ============================================================
-- 1. All distinct status values with row counts
-- ============================================================
SELECT
    status,
    COUNT(*) AS row_count
FROM public.consignment_requests
GROUP BY status
ORDER BY row_count DESC;

-- ============================================================
-- 2. Cross-check against expected values
--    Current production set : pending, received, inspecting, approved, rejected
--    New CHECK will add     : on_hold, completed
--    Full allowed set (7)   : listed below
-- ============================================================
SELECT
    v.expected_status,
    COALESCE(cr.row_count, 0) AS row_count,
    CASE
        WHEN cr.row_count IS NULL THEN 'NOT PRESENT (ok)'
        ELSE 'PRESENT'
    END AS presence
FROM (
    VALUES
        ('pending'),
        ('received'),
        ('inspecting'),
        ('approved'),
        ('rejected'),
        ('on_hold'),
        ('completed')
) AS v(expected_status)
LEFT JOIN (
    SELECT status, COUNT(*) AS row_count
    FROM public.consignment_requests
    GROUP BY status
) cr ON cr.status = v.expected_status
ORDER BY v.expected_status;

-- ============================================================
-- 3. Flag unexpected values (MUST be 0 rows for Phase Gate)
--    Any row here means the CHECK constraint will reject it.
-- ============================================================
SELECT
    'UNEXPECTED STATUS' AS flag,
    status              AS unexpected_value,
    COUNT(*)            AS row_count
FROM public.consignment_requests
WHERE status NOT IN (
    'pending',
    'received',
    'inspecting',
    'approved',
    'rejected',
    'on_hold',
    'completed'
)
GROUP BY status
ORDER BY row_count DESC;
