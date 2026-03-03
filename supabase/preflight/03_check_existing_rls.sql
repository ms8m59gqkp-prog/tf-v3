/**
 * 03_check_existing_rls.sql -- Phase 0 Preflight: RLS & Security Baseline Audit
 * WHY:  Before Phase 0 migration applies new RLS policies and RPCs, we need a
 *       baseline snapshot of what already exists. Specifically:
 *       - Tables with RLS already enabled (avoid double-enable errors).
 *       - Existing policies (avoid naming collisions, detect overly permissive
 *         USING(true) policies that MUST be 0 for Phase Gate).
 *       - Existing RPCs in public schema (avoid function name collisions).
 *       - Existing CHECK constraints on consignment_requests (avoid duplicates).
 * HOW:  Pure SELECT (read-only) against pg_catalog and information_schema.
 * WHERE: Referenced in plan5.md -- Phase 0 Gate Requirements.
 *
 * Usage:  psql $DATABASE_URL -f supabase/preflight/03_check_existing_rls.sql
 * Expect: Section 3 (USING(true) policies) returns 0 rows for Phase Gate pass.
 */

-- ============================================================
-- 1. Tables with RLS enabled (pg_tables.rowsecurity = true)
-- ============================================================
SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_catalog.pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true
ORDER BY tablename;

-- ============================================================
-- 2. All existing RLS policies on public tables
-- ============================================================
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================
-- 3. USING(true) policies -- MUST be 0 rows for Phase Gate
--    These are overly permissive and must be replaced with
--    proper role-based policies before migration proceeds.
-- ============================================================
SELECT
    'USING(true) POLICY' AS flag,
    schemaname,
    tablename,
    policyname,
    roles,
    cmd,
    qual
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND qual = 'true'
ORDER BY tablename, policyname;

-- ============================================================
-- 4. Existing RPCs (functions) in public schema
-- ============================================================
SELECT
    routine_name,
    routine_type,
    data_type   AS return_type,
    external_language
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- ============================================================
-- 5. Existing CHECK constraints on consignment_requests
-- ============================================================
SELECT
    tc.constraint_name,
    tc.table_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
    ON cc.constraint_name = tc.constraint_name
   AND cc.constraint_schema = tc.constraint_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'consignment_requests'
  AND tc.constraint_type = 'CHECK'
ORDER BY tc.constraint_name;
