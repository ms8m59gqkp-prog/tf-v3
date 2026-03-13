-- =============================================================================
-- 03_indexes.sql — Tokyo V3 Indexes
-- Source: V2 production backup (v2_indexes.txt) — 129 indexes total
-- Skipped: *_pkey indexes (created by PRIMARY KEY in 01_tables.sql)
-- DELTA-5: idx_consignment_seller upgraded to composite (seller_id + status)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- _batch_progress
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS _batch_progress_batch_id_key ON public._batch_progress USING btree (batch_id);

-- ---------------------------------------------------------------------------
-- brand_aliases
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_brand_aliases_official ON public.brand_aliases USING btree (official_name);
CREATE INDEX IF NOT EXISTS idx_brand_aliases_alias ON public.brand_aliases USING btree (alias);
CREATE UNIQUE INDEX IF NOT EXISTS brand_aliases_official_name_alias_key ON public.brand_aliases USING btree (official_name, alias);

-- ---------------------------------------------------------------------------
-- consignment_requests
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS consignment_requests_adjustment_token_key ON public.consignment_requests USING btree (adjustment_token);
CREATE UNIQUE INDEX IF NOT EXISTS uq_consignment_seller_product ON public.consignment_requests USING btree (seller_id, product_name);
CREATE INDEX IF NOT EXISTS idx_consignment_status ON public.consignment_requests USING btree (status);

-- DELTA-5: composite index (V2: seller_id only → V3: seller_id + status)
CREATE INDEX IF NOT EXISTS idx_consignment_seller ON public.consignment_requests USING btree (seller_id, status);

-- ---------------------------------------------------------------------------
-- excel_uploads
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_uploads_type ON public.excel_uploads USING btree (upload_type);
CREATE INDEX IF NOT EXISTS idx_uploads_status ON public.excel_uploads USING btree (status);

-- ---------------------------------------------------------------------------
-- market_prices
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_market_prices_brand ON public.market_prices USING btree (brand);
CREATE UNIQUE INDEX IF NOT EXISTS market_prices_source_url_key ON public.market_prices USING btree (source_url);
CREATE INDEX IF NOT EXISTS idx_market_prices_created ON public.market_prices USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_prices_source ON public.market_prices USING btree (source);
CREATE INDEX IF NOT EXISTS idx_market_prices_brand_type ON public.market_prices USING btree (brand, category);

-- ---------------------------------------------------------------------------
-- mismatches
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_mismatch_upload ON public.mismatches USING btree (upload_id);
CREATE INDEX IF NOT EXISTS idx_mismatch_resolved ON public.mismatches USING btree (resolved);

-- ---------------------------------------------------------------------------
-- naver_settlements
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_naver_settlements_product_order_no ON public.naver_settlements USING btree (product_order_no);
CREATE INDEX IF NOT EXISTS idx_naver_settlements_buyer_name ON public.naver_settlements USING btree (buyer_name);
CREATE INDEX IF NOT EXISTS idx_naver_settlements_settle_base_date ON public.naver_settlements USING btree (settle_base_date);
CREATE INDEX IF NOT EXISTS idx_naver_settlements_match_status ON public.naver_settlements USING btree (match_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_naver_settlements_dedup ON public.naver_settlements USING btree (product_order_no) WHERE (product_order_no IS NOT NULL);

-- ---------------------------------------------------------------------------
-- notification_logs
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notification_logs_consignment ON public.notification_logs USING btree (consignment_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_seller ON public.notification_logs USING btree (seller_id);

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items USING btree (product_number);
CREATE UNIQUE INDEX IF NOT EXISTS order_items_product_id_key ON public.order_items USING btree (product_number);

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders USING btree (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS orders_hold_token_key ON public.orders USING btree (hold_token) WHERE (hold_token IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key ON public.orders USING btree (order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders USING btree (status);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders USING btree (order_number);

-- ---------------------------------------------------------------------------
-- photo_uploads
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_photo_uploads_is_matched ON public.photo_uploads USING btree (is_matched);

-- ---------------------------------------------------------------------------
-- photos
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_photos_order_item_id ON public.photos USING btree (order_item_id);

-- ---------------------------------------------------------------------------
-- price_estimate_cache
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS price_estimate_cache_cache_key_key ON public.price_estimate_cache USING btree (cache_key);
CREATE INDEX IF NOT EXISTS idx_price_cache_key ON public.price_estimate_cache USING btree (cache_key);
CREATE INDEX IF NOT EXISTS idx_price_cache_expires ON public.price_estimate_cache USING btree (expires_at);

-- ---------------------------------------------------------------------------
-- price_references
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_price_refs_brand ON public.price_references USING btree (brand);
CREATE INDEX IF NOT EXISTS idx_price_refs_brand_lower ON public.price_references USING btree (lower(brand));

-- ---------------------------------------------------------------------------
-- return_shipments
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_return_shipments_consignment ON public.return_shipments USING btree (consignment_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_return_consignment ON public.return_shipments USING btree (consignment_id);

-- ---------------------------------------------------------------------------
-- sales_ledger
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ledger_sold_at ON public.sales_ledger USING btree (sold_at);
CREATE UNIQUE INDEX IF NOT EXISTS sales_ledger_order_id_product_code_sale_type_key ON public.sales_ledger USING btree (order_id, product_code, sale_type);
CREATE INDEX IF NOT EXISTS idx_ledger_order ON public.sales_ledger USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_ledger_seller ON public.sales_ledger USING btree (seller_id);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON public.sales_ledger USING btree (product_type);
CREATE INDEX IF NOT EXISTS idx_ledger_product_order ON public.sales_ledger USING btree (product_order_id);
CREATE INDEX IF NOT EXISTS idx_ledger_naver ON public.sales_ledger USING btree (naver_product_id);
CREATE UNIQUE INDEX IF NOT EXISTS sales_ledger_product_order_unique ON public.sales_ledger USING btree (product_order_id, sale_type);

-- ---------------------------------------------------------------------------
-- sales_records
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sales_records_naver_order_no ON public.sales_records USING btree (naver_order_no);
CREATE INDEX IF NOT EXISTS idx_sales_records_sale_date ON public.sales_records USING btree (sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_records_session ON public.sales_records USING btree (upload_session_id) WHERE (upload_session_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_records_dedup ON public.sales_records USING btree (sale_date, naver_order_no, buyer_name, product_name) WHERE (naver_order_no IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_sales_records_match_status ON public.sales_records USING btree (match_status);
CREATE INDEX IF NOT EXISTS idx_sales_records_is_consignment ON public.sales_records USING btree (is_consignment);

-- ---------------------------------------------------------------------------
-- search_synonyms
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_search_synonyms_canonical ON public.search_synonyms USING btree (canonical);
CREATE INDEX IF NOT EXISTS idx_search_synonyms_synonym ON public.search_synonyms USING btree (lower(synonym));

-- ---------------------------------------------------------------------------
-- sellers
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sellers_tagging ON public.sellers USING btree (tagging_code);
CREATE INDEX IF NOT EXISTS idx_sellers_phone ON public.sellers USING btree (phone);
CREATE INDEX IF NOT EXISTS idx_sellers_status ON public.sellers USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS sellers_phone_key ON public.sellers USING btree (phone);
CREATE UNIQUE INDEX IF NOT EXISTS sellers_seller_code_key ON public.sellers USING btree (seller_code);
CREATE INDEX IF NOT EXISTS idx_sellers_name ON public.sellers USING btree (name);
CREATE INDEX IF NOT EXISTS idx_sellers_tier ON public.sellers USING btree (seller_tier);

-- ---------------------------------------------------------------------------
-- settlement_audit_log
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.settlement_audit_log USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.settlement_audit_log USING btree (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.settlement_audit_log USING btree (action);

-- ---------------------------------------------------------------------------
-- settlement_items
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS settlement_items_settlement_id_sold_item_id_key ON public.settlement_items USING btree (settlement_id, sold_item_id);
CREATE INDEX IF NOT EXISTS idx_si_sold ON public.settlement_items USING btree (sold_item_id);
CREATE INDEX IF NOT EXISTS idx_si_settlement ON public.settlement_items USING btree (settlement_id);

-- ---------------------------------------------------------------------------
-- settlement_matches
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS settlement_matches_sales_record_id_key ON public.settlement_matches USING btree (sales_record_id);
CREATE INDEX IF NOT EXISTS idx_settlement_matches_naver_settlement_id ON public.settlement_matches USING btree (naver_settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_matches_sales_record_id ON public.settlement_matches USING btree (sales_record_id);
CREATE UNIQUE INDEX IF NOT EXISTS settlement_matches_naver_settlement_id_key ON public.settlement_matches USING btree (naver_settlement_id);

-- ---------------------------------------------------------------------------
-- settlement_queue
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_settlement_queue_queue_status ON public.settlement_queue USING btree (queue_status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_settlement_queue_match ON public.settlement_queue USING btree (match_id);
CREATE INDEX IF NOT EXISTS idx_settlement_queue_settle_base_date ON public.settlement_queue USING btree (settle_base_date);
CREATE INDEX IF NOT EXISTS idx_settlement_queue_seller_id ON public.settlement_queue USING btree (seller_id);

-- ---------------------------------------------------------------------------
-- settlements
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_settlements_seller ON public.settlements USING btree (seller_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON public.settlements USING btree (status);
CREATE INDEX IF NOT EXISTS idx_settlements_period ON public.settlements USING btree (settlement_period_start, settlement_period_end);

-- ---------------------------------------------------------------------------
-- sold_items
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sold_status ON public.sold_items USING btree (settlement_status);
CREATE INDEX IF NOT EXISTS idx_sold_at ON public.sold_items USING btree (sold_at);
CREATE INDEX IF NOT EXISTS idx_sold_confirmed ON public.sold_items USING btree (purchase_confirmed);
CREATE INDEX IF NOT EXISTS idx_sold_product ON public.sold_items USING btree (product_number);
CREATE INDEX IF NOT EXISTS idx_sold_product_order ON public.sold_items USING btree (product_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS sold_items_product_order_id_key ON public.sold_items USING btree (product_order_id);
CREATE INDEX IF NOT EXISTS idx_sold_items_seller_settlement ON public.sold_items USING btree (seller_id, settlement_status);
CREATE INDEX IF NOT EXISTS idx_sold_seller ON public.sold_items USING btree (seller_id);

-- ---------------------------------------------------------------------------
-- st_products
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_st_products_sold_at ON public.st_products USING btree (sold_at);
CREATE INDEX IF NOT EXISTS idx_st_products_smartstore_status ON public.st_products USING btree (smartstore_status);
CREATE INDEX IF NOT EXISTS idx_st_products_category ON public.st_products USING btree (category);
CREATE INDEX IF NOT EXISTS idx_st_products_name ON public.st_products USING btree (product_name);
CREATE INDEX IF NOT EXISTS idx_st_products_type ON public.st_products USING btree (product_type);
CREATE INDEX IF NOT EXISTS idx_st_products_legacy ON public.st_products USING btree (legacy_code);
CREATE INDEX IF NOT EXISTS idx_st_products_seller ON public.st_products USING btree (seller_id);
CREATE UNIQUE INDEX IF NOT EXISTS st_products_legacy_code_key ON public.st_products USING btree (legacy_code);
CREATE UNIQUE INDEX IF NOT EXISTS st_products_product_number_key ON public.st_products USING btree (product_number);
CREATE INDEX IF NOT EXISTS idx_st_products_brand ON public.st_products USING btree (brand);
CREATE INDEX IF NOT EXISTS idx_st_products_naver ON public.st_products USING btree (naver_product_id);
CREATE INDEX IF NOT EXISTS idx_st_products_seller_id ON public.st_products USING btree (seller_id);
CREATE INDEX IF NOT EXISTS idx_st_products_photo_status ON public.st_products USING btree (photo_status);
