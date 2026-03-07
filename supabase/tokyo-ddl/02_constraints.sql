/**
 * Tokyo V3 통합 DDL — 02. Constraints (FK + UNIQUE + CHECK)
 * WHY: FK는 테이블 생성 후 추가해야 순서 무관 / CHECK+UNIQUE 분리로 가독성 확보
 * HOW: v2_constraints.txt 98건 중 PK 제외 → FK 23건 + UNIQUE 20건 + CHECK 29건 + DELTA-1 1건
 * WHERE: FK 누락 → 참조 무결성 미보장 / CHECK 누락 → 잘못된 값 INSERT 허용
 */

-- ============================================================
-- SECTION 1: FOREIGN KEY CONSTRAINTS (23건)
-- ============================================================

-- consignment_requests (2 FK)
ALTER TABLE consignment_requests
  ADD CONSTRAINT consignment_requests_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES st_products(id);

ALTER TABLE consignment_requests
  ADD CONSTRAINT consignment_requests_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES sellers(id);

-- mismatches (2 FK)
ALTER TABLE mismatches
  ADD CONSTRAINT mismatches_upload_id_fkey
  FOREIGN KEY (upload_id) REFERENCES excel_uploads(id);

ALTER TABLE mismatches
  ADD CONSTRAINT mismatches_db_seller_id_fkey
  FOREIGN KEY (db_seller_id) REFERENCES sellers(id);

-- notification_logs (2 FK)
ALTER TABLE notification_logs
  ADD CONSTRAINT notification_logs_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES sellers(id);

ALTER TABLE notification_logs
  ADD CONSTRAINT notification_logs_consignment_id_fkey
  FOREIGN KEY (consignment_id) REFERENCES consignment_requests(id);

-- order_items (1 FK)
ALTER TABLE order_items
  ADD CONSTRAINT order_items_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- photo_uploads (1 FK)
ALTER TABLE photo_uploads
  ADD CONSTRAINT photo_uploads_order_item_id_fkey
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE SET NULL;

-- photos (1 FK)
ALTER TABLE photos
  ADD CONSTRAINT photos_order_item_id_fkey
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE;

-- return_shipments (1 FK)
ALTER TABLE return_shipments
  ADD CONSTRAINT return_shipments_consignment_id_fkey
  FOREIGN KEY (consignment_id) REFERENCES consignment_requests(id);

-- sales_ledger (1 FK)
ALTER TABLE sales_ledger
  ADD CONSTRAINT sales_ledger_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES sellers(id);

-- settlement_items (2 FK)
ALTER TABLE settlement_items
  ADD CONSTRAINT settlement_items_sold_item_id_fkey
  FOREIGN KEY (sold_item_id) REFERENCES sold_items(id);

ALTER TABLE settlement_items
  ADD CONSTRAINT settlement_items_settlement_id_fkey
  FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE CASCADE;

-- settlement_matches (2 FK)
ALTER TABLE settlement_matches
  ADD CONSTRAINT settlement_matches_sales_record_id_fkey
  FOREIGN KEY (sales_record_id) REFERENCES sales_records(id) ON DELETE CASCADE;

ALTER TABLE settlement_matches
  ADD CONSTRAINT settlement_matches_naver_settlement_id_fkey
  FOREIGN KEY (naver_settlement_id) REFERENCES naver_settlements(id) ON DELETE CASCADE;

-- settlement_queue (3 FK)
ALTER TABLE settlement_queue
  ADD CONSTRAINT settlement_queue_settlement_id_fkey
  FOREIGN KEY (settlement_id) REFERENCES settlements(id);

ALTER TABLE settlement_queue
  ADD CONSTRAINT settlement_queue_match_id_fkey
  FOREIGN KEY (match_id) REFERENCES settlement_matches(id) ON DELETE CASCADE;

ALTER TABLE settlement_queue
  ADD CONSTRAINT settlement_queue_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES sellers(id);

-- settlements (1 FK)
ALTER TABLE settlements
  ADD CONSTRAINT settlements_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES sellers(id);

-- sold_items (2 FK)
ALTER TABLE sold_items
  ADD CONSTRAINT sold_items_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES sellers(id);

ALTER TABLE sold_items
  ADD CONSTRAINT sold_items_settlement_id_fkey
  FOREIGN KEY (settlement_id) REFERENCES settlements(id);

-- st_products (2 FK)
ALTER TABLE st_products
  ADD CONSTRAINT st_products_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES sellers(id);

ALTER TABLE st_products
  ADD CONSTRAINT st_products_sales_record_id_fkey
  FOREIGN KEY (sales_record_id) REFERENCES sales_records(id);


-- ============================================================
-- SECTION 2: UNIQUE CONSTRAINTS (20건)
-- ============================================================

ALTER TABLE _batch_progress
  ADD CONSTRAINT _batch_progress_batch_id_key UNIQUE (batch_id);

ALTER TABLE brand_aliases
  ADD CONSTRAINT brand_aliases_official_name_alias_key UNIQUE (official_name, alias);

ALTER TABLE consignment_requests
  ADD CONSTRAINT uq_consignment_seller_product UNIQUE (seller_id, product_name);

ALTER TABLE consignment_requests
  ADD CONSTRAINT consignment_requests_adjustment_token_key UNIQUE (adjustment_token);

ALTER TABLE market_prices
  ADD CONSTRAINT market_prices_source_url_key UNIQUE (source_url);

ALTER TABLE order_items
  ADD CONSTRAINT order_items_product_id_key UNIQUE (product_number);

ALTER TABLE orders
  ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);

ALTER TABLE price_estimate_cache
  ADD CONSTRAINT price_estimate_cache_cache_key_key UNIQUE (cache_key);

ALTER TABLE return_shipments
  ADD CONSTRAINT uq_return_consignment UNIQUE (consignment_id);

ALTER TABLE sales_ledger
  ADD CONSTRAINT sales_ledger_order_id_product_code_sale_type_key UNIQUE (order_id, product_code, sale_type);

ALTER TABLE sales_ledger
  ADD CONSTRAINT sales_ledger_product_order_unique UNIQUE (product_order_id, sale_type);

ALTER TABLE sellers
  ADD CONSTRAINT sellers_seller_code_key UNIQUE (seller_code);

ALTER TABLE sellers
  ADD CONSTRAINT sellers_phone_key UNIQUE (phone);

ALTER TABLE settlement_items
  ADD CONSTRAINT settlement_items_settlement_id_sold_item_id_key UNIQUE (settlement_id, sold_item_id);

ALTER TABLE settlement_matches
  ADD CONSTRAINT settlement_matches_naver_settlement_id_key UNIQUE (naver_settlement_id);

ALTER TABLE settlement_matches
  ADD CONSTRAINT settlement_matches_sales_record_id_key UNIQUE (sales_record_id);

ALTER TABLE settlement_queue
  ADD CONSTRAINT uq_settlement_queue_match UNIQUE (match_id);

ALTER TABLE sold_items
  ADD CONSTRAINT sold_items_product_order_id_key UNIQUE (product_order_id);

ALTER TABLE st_products
  ADD CONSTRAINT st_products_product_number_key UNIQUE (product_number);

ALTER TABLE st_products
  ADD CONSTRAINT st_products_legacy_code_key UNIQUE (legacy_code);


-- ============================================================
-- SECTION 3: CHECK CONSTRAINTS (29건 V2 + 1건 DELTA-1)
-- ============================================================

-- _batch_progress
ALTER TABLE _batch_progress
  ADD CONSTRAINT _batch_progress_status_check
  CHECK (status IN ('running', 'completed', 'partial', 'failed'));

-- consignment_requests (3 CHECK)
ALTER TABLE consignment_requests
  ADD CONSTRAINT consignment_requests_source_check
  CHECK (source IN ('naver_form', 'employee', 'manual', 'direct'));

ALTER TABLE consignment_requests
  ADD CONSTRAINT consignment_requests_status_check
  CHECK (status IN ('pending', 'inspecting', 'on_hold', 'approved', 'rejected', 'received', 'completed'));

ALTER TABLE consignment_requests
  ADD CONSTRAINT consignment_requests_seller_response_check
  CHECK (seller_response IS NULL OR seller_response IN ('accepted', 'counter', 'cancelled'));

-- excel_uploads (2 CHECK)
ALTER TABLE excel_uploads
  ADD CONSTRAINT excel_uploads_status_check
  CHECK (status IN ('processing', 'completed', 'failed'));

ALTER TABLE excel_uploads
  ADD CONSTRAINT excel_uploads_upload_type_check
  CHECK (upload_type IN ('smart_store_sales', 'smart_store_confirm', 'naver_form', 'legacy_products'));

-- mismatches
ALTER TABLE mismatches
  ADD CONSTRAINT mismatches_mismatch_type_check
  CHECK (mismatch_type IN ('seller_mismatch', 'product_not_found', 'seller_not_found'));

-- naver_settlements
ALTER TABLE naver_settlements
  ADD CONSTRAINT naver_settlements_match_status_check
  CHECK (match_status IN ('unmatched', 'auto_matched', 'manual_matched'));

-- notification_logs
ALTER TABLE notification_logs
  ADD CONSTRAINT notification_logs_status_check
  CHECK (status IN ('pending', 'sent', 'failed'));

-- order_items
ALTER TABLE order_items
  ADD CONSTRAINT order_items_inspection_status_check
  CHECK (inspection_status IN ('pending', 'completed', 'hold'));

-- orders (1 V2 CHECK + DELTA-1)
ALTER TABLE orders
  ADD CONSTRAINT orders_seller_type_check
  CHECK (seller_type IN ('general', 'employee', 'vip'));

-- DELTA-1: V3 마이그레이션 016에서 추가 (V2에 미존재)
ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'APPLIED', 'SHIPPING', 'COLLECTED', 'INSPECTED',
    'PRICE_ADJUSTING', 'RE_INSPECTED', 'IMAGE_PREPARING', 'IMAGE_COMPLETE',
    'CONFIRMED', 'CANCELLED'
  ));

-- return_shipments (2 CHECK)
ALTER TABLE return_shipments
  ADD CONSTRAINT return_shipments_trigger_type_check
  CHECK (trigger_type IN ('rejected', 'hold_cancelled'));

ALTER TABLE return_shipments
  ADD CONSTRAINT return_shipments_status_check
  CHECK (status IN ('pending', 'requested', 'manual', 'in_transit', 'delivered', 'failed'));

-- sales_ledger (3 CHECK)
ALTER TABLE sales_ledger
  ADD CONSTRAINT sales_ledger_channel_check
  CHECK (channel IN ('smart_store', 'self_mall'));

ALTER TABLE sales_ledger
  ADD CONSTRAINT sales_ledger_sale_type_check
  CHECK (sale_type IN ('normal', 'return'));

ALTER TABLE sales_ledger
  ADD CONSTRAINT sales_ledger_product_type_check
  CHECK (product_type IN ('consignment', 'inventory'));

-- sales_records
ALTER TABLE sales_records
  ADD CONSTRAINT sales_records_match_status_check
  CHECK (match_status IN ('unmatched', 'auto_matched', 'manual_matched'));

-- sellers (3 CHECK)
ALTER TABLE sellers
  ADD CONSTRAINT sellers_status_check
  CHECK (status IN ('pending', 'active', 'inactive', 'suspended', 'expired'));

ALTER TABLE sellers
  ADD CONSTRAINT sellers_seller_tier_check
  CHECK (seller_tier IN ('general', 'employee', 'vip'));

ALTER TABLE sellers
  ADD CONSTRAINT sellers_channel_type_check
  CHECK (channel_type IN ('half_size', 'full_size', 'both'));

-- settlement_matches
ALTER TABLE settlement_matches
  ADD CONSTRAINT settlement_matches_match_type_check
  CHECK (match_type IN ('auto', 'manual'));

-- settlement_queue
ALTER TABLE settlement_queue
  ADD CONSTRAINT settlement_queue_queue_status_check
  CHECK (queue_status IN ('pending', 'confirmed', 'paid'));

-- settlements
ALTER TABLE settlements
  ADD CONSTRAINT settlements_status_check
  CHECK (status IN ('draft', 'confirmed', 'paid', 'failed'));

-- sold_items (2 CHECK)
ALTER TABLE sold_items
  ADD CONSTRAINT sold_items_channel_check
  CHECK (channel IN ('smart_store', 'self_mall'));

ALTER TABLE sold_items
  ADD CONSTRAINT sold_items_settlement_status_check
  CHECK (settlement_status IN ('pending', 'calculated', 'settled', 'returned'));

-- st_products (4 CHECK)
ALTER TABLE st_products
  ADD CONSTRAINT st_products_retail_price_source_check
  CHECK (retail_price_source IN ('naver_estimate', 'manual', 'desired_price'));

ALTER TABLE st_products
  ADD CONSTRAINT st_products_photo_status_check
  CHECK (photo_status IN ('pending', 'shooting', 'editing', 'completed'));

ALTER TABLE st_products
  ADD CONSTRAINT st_products_smartstore_status_check
  CHECK (smartstore_status IN ('draft', 'ready', 'uploaded', 'selling'));

ALTER TABLE st_products
  ADD CONSTRAINT st_products_product_type_check
  CHECK (product_type IN ('consignment', 'inventory'));
