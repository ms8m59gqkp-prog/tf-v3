-- =============================================================================
-- 05_triggers.sql — Tokyo V3 Triggers
-- Source: V2 production backup (v2_triggers.txt) — 4 public schema triggers
-- Prerequisite: update_updated_at() function must exist (see 04_functions.sql)
-- DELTA-7: orders_updated_at was missing from V3 migration 014
-- =============================================================================

-- ---------------------------------------------------------------------------
-- orders — DELTA-7: was missing from V3 migration 014
-- ---------------------------------------------------------------------------
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- sellers
-- ---------------------------------------------------------------------------
CREATE TRIGGER sellers_updated_at BEFORE UPDATE ON public.sellers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- st_products
-- ---------------------------------------------------------------------------
CREATE TRIGGER st_products_updated_at BEFORE UPDATE ON public.st_products FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- consignment_requests
-- ---------------------------------------------------------------------------
CREATE TRIGGER consignment_requests_updated_at BEFORE UPDATE ON public.consignment_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
