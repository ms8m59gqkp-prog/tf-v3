-- =============================================================================
-- 06_rls.sql — Tokyo V3 Row Level Security
-- Source: V2 production backup (v2_rls.txt) — 34 policies on 17 tables
-- Section 1: Enable RLS on all 26 tables
-- Section 2: Existing 34 V2 policies
-- Section 3: New defense-in-depth policies for 9 policyless tables
-- =============================================================================

-- ===========================================================================
-- SECTION 1: Enable RLS on all 26 tables
-- ===========================================================================
ALTER TABLE public._batch_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excel_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mismatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.naver_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_estimate_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_synonyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sold_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.st_products ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- SECTION 2: Existing V2 RLS policies (34 policies)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- consignment_requests (3 policies)
-- ---------------------------------------------------------------------------
CREATE POLICY "service_all_consignment" ON public.consignment_requests
  FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));

CREATE POLICY "admin_all_consignment" ON public.consignment_requests
  FOR ALL TO public
  USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));

CREATE POLICY "consignment_anon_read" ON public.consignment_requests
  FOR SELECT TO anon
  USING (((adjustment_token IS NOT NULL) AND (adjustment_token = ((current_setting('request.headers'::text, true))::json ->> 'x-adjustment-token'::text))));

-- ---------------------------------------------------------------------------
-- excel_uploads (2 policies)
-- ---------------------------------------------------------------------------
CREATE POLICY "admin_all_uploads" ON public.excel_uploads
  FOR ALL TO public
  USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));

CREATE POLICY "service_all_uploads" ON public.excel_uploads
  FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));

-- ---------------------------------------------------------------------------
-- market_prices (3 policies)
-- ---------------------------------------------------------------------------
CREATE POLICY "service_all_market_prices" ON public.market_prices
  FOR ALL TO public
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_market_prices" ON public.market_prices
  FOR ALL TO public
  USING ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Allow public read market_prices" ON public.market_prices
  FOR SELECT TO public
  USING (true);

-- ---------------------------------------------------------------------------
-- mismatches (2 policies)
-- ---------------------------------------------------------------------------
CREATE POLICY "service_all_mismatches" ON public.mismatches
  FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));

CREATE POLICY "admin_all_mismatches" ON public.mismatches
  FOR ALL TO public
  USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));

-- ---------------------------------------------------------------------------
-- order_items (2 policies)
-- ---------------------------------------------------------------------------
CREATE POLICY "service_all_order_items" ON public.order_items
  FOR ALL TO public
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_order_items" ON public.order_items
  FOR ALL TO public
  USING ((auth.jwt() ->> 'role') = 'admin');

-- ---------------------------------------------------------------------------
-- orders (2 policies)
-- ---------------------------------------------------------------------------
CREATE POLICY "orders_anon_update" ON public.orders
  FOR UPDATE TO anon
  USING (((hold_token IS NOT NULL) AND (hold_token = ((current_setting('request.headers'::text, true))::json ->> 'x-hold-token'::text)) AND (status = 'IMAGE_COMPLETE'::text)));

CREATE POLICY "orders_anon_read" ON public.orders
  FOR SELECT TO anon
  USING (((hold_token IS NOT NULL) AND (hold_token = ((current_setting('request.headers'::text, true))::json ->> 'x-hold-token'::text))));

-- ---------------------------------------------------------------------------
-- photo_uploads (2 policies)
-- ---------------------------------------------------------------------------
CREATE POLICY "service_all_photo_uploads" ON public.photo_uploads
  FOR ALL TO public
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_photo_uploads" ON public.photo_uploads
  FOR ALL TO public
  USING ((auth.jwt() ->> 'role') = 'admin');

-- ---------------------------------------------------------------------------
-- photos (2 policies)
-- ---------------------------------------------------------------------------
CREATE POLICY "service_all_photos" ON public.photos
  FOR ALL TO public
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_photos" ON public.photos
  FOR ALL TO public
  USING ((auth.jwt() ->> 'role') = 'admin');

-- ---------------------------------------------------------------------------
-- price_estimate_cache (1 policy)
-- ---------------------------------------------------------------------------
CREATE POLICY "service role full access" ON public.price_estimate_cache
  FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));

-- ---------------------------------------------------------------------------
-- price_references (3 policies)
-- ---------------------------------------------------------------------------
CREATE POLICY "service_all_price_references" ON public.price_references
  FOR ALL TO public
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_price_references" ON public.price_references
  FOR ALL TO public
  USING ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Allow public read price_references" ON public.price_references
  FOR SELECT TO public
  USING (true);

-- ---------------------------------------------------------------------------
-- sales_ledger (2 policies)
-- ---------------------------------------------------------------------------
CREATE POLICY "admin_all_ledger" ON public.sales_ledger
  FOR ALL TO public
  USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));

CREATE POLICY "service_all_ledger" ON public.sales_ledger
  FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));

-- ---------------------------------------------------------------------------
-- search_synonyms (1 policy)
-- ---------------------------------------------------------------------------
CREATE POLICY "search_synonyms_read" ON public.search_synonyms
  FOR SELECT TO anon
  USING (true);

-- ---------------------------------------------------------------------------
-- sellers (3 policies)
-- ---------------------------------------------------------------------------
CREATE POLICY "service_all_sellers" ON public.sellers
  FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));

CREATE POLICY "seller_read_own" ON public.sellers
  FOR SELECT TO public
  USING ((id = auth.uid()));

CREATE POLICY "admin_all_sellers" ON public.sellers
  FOR ALL TO public
  USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));

-- ---------------------------------------------------------------------------
-- settlement_items (2 policies)
-- ---------------------------------------------------------------------------
CREATE POLICY "admin_all_si" ON public.settlement_items
  FOR ALL TO public
  USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));

CREATE POLICY "service_all_si" ON public.settlement_items
  FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));

-- ---------------------------------------------------------------------------
-- settlements (3 policies)
-- ---------------------------------------------------------------------------
CREATE POLICY "service_all_settlements" ON public.settlements
  FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));

CREATE POLICY "seller_read_own_settlements" ON public.settlements
  FOR SELECT TO public
  USING ((seller_id = auth.uid()));

CREATE POLICY "admin_all_settlements" ON public.settlements
  FOR ALL TO public
  USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));

-- ---------------------------------------------------------------------------
-- sold_items (3 policies)
-- ---------------------------------------------------------------------------
CREATE POLICY "admin_all_sold" ON public.sold_items
  FOR ALL TO public
  USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));

CREATE POLICY "seller_read_own_sold" ON public.sold_items
  FOR SELECT TO public
  USING ((seller_id = auth.uid()));

CREATE POLICY "service_all_sold" ON public.sold_items
  FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));

-- ---------------------------------------------------------------------------
-- st_products (3 policies)
-- ---------------------------------------------------------------------------
CREATE POLICY "service_all_st_products" ON public.st_products
  FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));

CREATE POLICY "seller_read_own_products" ON public.st_products
  FOR SELECT TO public
  USING ((seller_id = auth.uid()));

CREATE POLICY "admin_all_st_products" ON public.st_products
  FOR ALL TO public
  USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));

-- ===========================================================================
-- SECTION 3: New defense-in-depth policies for 9 policyless tables
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- _batch_progress
-- ---------------------------------------------------------------------------
CREATE POLICY "service_all_batch_progress" ON public._batch_progress
  FOR ALL TO public
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_batch_progress" ON public._batch_progress
  FOR ALL TO public
  USING ((auth.jwt() ->> 'role') = 'admin');

-- ---------------------------------------------------------------------------
-- brand_aliases
-- ---------------------------------------------------------------------------
CREATE POLICY "service_all_brand_aliases" ON public.brand_aliases
  FOR ALL TO public
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_brand_aliases" ON public.brand_aliases
  FOR ALL TO public
  USING ((auth.jwt() ->> 'role') = 'admin');

-- ---------------------------------------------------------------------------
-- naver_settlements
-- ---------------------------------------------------------------------------
CREATE POLICY "service_all_naver_settlements" ON public.naver_settlements
  FOR ALL TO public
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_naver_settlements" ON public.naver_settlements
  FOR ALL TO public
  USING ((auth.jwt() ->> 'role') = 'admin');

-- ---------------------------------------------------------------------------
-- notification_logs
-- ---------------------------------------------------------------------------
CREATE POLICY "service_all_notification_logs" ON public.notification_logs
  FOR ALL TO public
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_notification_logs" ON public.notification_logs
  FOR ALL TO public
  USING ((auth.jwt() ->> 'role') = 'admin');

-- ---------------------------------------------------------------------------
-- return_shipments
-- ---------------------------------------------------------------------------
CREATE POLICY "service_all_return_shipments" ON public.return_shipments
  FOR ALL TO public
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_return_shipments" ON public.return_shipments
  FOR ALL TO public
  USING ((auth.jwt() ->> 'role') = 'admin');

-- ---------------------------------------------------------------------------
-- sales_records
-- ---------------------------------------------------------------------------
CREATE POLICY "service_all_sales_records" ON public.sales_records
  FOR ALL TO public
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_sales_records" ON public.sales_records
  FOR ALL TO public
  USING ((auth.jwt() ->> 'role') = 'admin');

-- ---------------------------------------------------------------------------
-- settlement_audit_log
-- ---------------------------------------------------------------------------
CREATE POLICY "service_all_settlement_audit_log" ON public.settlement_audit_log
  FOR ALL TO public
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_settlement_audit_log" ON public.settlement_audit_log
  FOR ALL TO public
  USING ((auth.jwt() ->> 'role') = 'admin');

-- ---------------------------------------------------------------------------
-- settlement_matches
-- ---------------------------------------------------------------------------
CREATE POLICY "service_all_settlement_matches" ON public.settlement_matches
  FOR ALL TO public
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_settlement_matches" ON public.settlement_matches
  FOR ALL TO public
  USING ((auth.jwt() ->> 'role') = 'admin');

-- ---------------------------------------------------------------------------
-- settlement_queue
-- ---------------------------------------------------------------------------
CREATE POLICY "service_all_settlement_queue" ON public.settlement_queue
  FOR ALL TO public
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_settlement_queue" ON public.settlement_queue
  FOR ALL TO public
  USING ((auth.jwt() ->> 'role') = 'admin');
