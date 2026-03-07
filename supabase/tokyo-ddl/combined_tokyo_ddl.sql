/**
 * Tokyo V3 통합 DDL — 00. Extensions & Sequences
 * WHY: DELTA-8 (uuid-ossp), DELTA-9 (시퀀스 2건), DELTA-10 (pgcrypto)
 * HOW: 테이블 생성 전 반드시 실행 — 9개 테이블 PK DEFAULT + 2개 bigint PK + 암호화 함수 의존
 * WHERE: 에러 시 → 해당 테이블 INSERT에서 "function does not exist" 에러
 */

-- ============================================================
-- DELTA-8: uuid-ossp (9개 테이블 PK DEFAULT: extensions.uuid_generate_v4())
-- 대상: consignment_requests, excel_uploads, mismatches, sales_ledger,
--       sellers, settlement_items, settlements, sold_items, st_products
-- ============================================================
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ============================================================
-- DELTA-10: pgcrypto (pgp_sym_encrypt_text, pgp_sym_decrypt_text 함수 의존)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- DELTA-9: 시퀀스 (비-UUID PK 2건: price_references, search_synonyms)
-- CREATE TABLE에서 BIGSERIAL 대신 nextval 직접 참조하므로 선행 생성 필요
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS price_references_id_seq;
CREATE SEQUENCE IF NOT EXISTS search_synonyms_id_seq;

-- ========================================

/**
 * Tokyo V3 통합 DDL — 01. Tables (26개, 389 컬럼)
 * WHY: V2 Mumbai 26개 테이블을 Tokyo에 그대로 재현
 * HOW: v2_columns.txt 389행 → CREATE TABLE + PRIMARY KEY (FK/UNIQUE/CHECK는 02_constraints.sql)
 * WHERE: 컬럼 누락 시 PostgREST select 에러, DEFAULT 누락 시 INSERT 에러
 */

-- ============================================================
-- 1. _batch_progress (9 columns)
-- ============================================================
CREATE TABLE _batch_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  batch_id TEXT NOT NULL,
  total INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  failed_ids JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- ============================================================
-- 2. brand_aliases (5 columns)
-- ============================================================
CREATE TABLE brand_aliases (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  official_name TEXT NOT NULL,
  alias TEXT NOT NULL,
  country TEXT,
  category TEXT DEFAULT 'classic'::text,
  PRIMARY KEY (id)
);

-- ============================================================
-- 3. consignment_requests (28 columns)
-- ============================================================
CREATE TABLE consignment_requests (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  seller_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  desired_price INTEGER NOT NULL,
  product_condition TEXT NOT NULL,
  status TEXT DEFAULT 'pending'::text,
  approved_at TIMESTAMPTZ,
  product_id UUID,
  source TEXT DEFAULT 'naver_form'::text,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  image_url TEXT,
  applied_at TIMESTAMPTZ,
  employee_purchase_date TEXT,
  privacy_consent TEXT,
  product_number TEXT,
  received_at TIMESTAMPTZ,
  inspected_at TIMESTAMPTZ,
  measurements JSONB,
  item_type TEXT,
  inspection_image TEXT,
  adjustment_token TEXT,
  adjustment_price INTEGER,
  seller_response TEXT,
  seller_counter_price INTEGER,
  origin TEXT,
  composition TEXT,
  PRIMARY KEY (id)
);

-- ============================================================
-- 4. excel_uploads (15 columns)
-- ============================================================
CREATE TABLE excel_uploads (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  upload_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT,
  uploaded_by UUID,
  row_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  error_details JSONB DEFAULT '[]'::jsonb,
  consignment_count INTEGER DEFAULT 0,
  inventory_count INTEGER DEFAULT 0,
  return_count INTEGER DEFAULT 0,
  mismatch_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing'::text,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- ============================================================
-- 5. market_prices (19 columns)
-- ============================================================
CREATE TABLE market_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  brand TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL,
  size TEXT,
  condition TEXT,
  material TEXT,
  color TEXT,
  measurements JSONB DEFAULT '{}'::jsonb,
  description TEXT,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_date DATE,
  image_paths TEXT[] DEFAULT '{}'::text[],
  raw_title TEXT,
  raw_content TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  product_name TEXT,
  PRIMARY KEY (id)
);

-- ============================================================
-- 6. mismatches (15 columns)
-- ============================================================
CREATE TABLE mismatches (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  upload_id UUID,
  product_order_id TEXT,
  order_id TEXT,
  product_name TEXT NOT NULL,
  product_code TEXT,
  excel_seller_name TEXT,
  db_seller_name TEXT,
  db_seller_id UUID,
  mismatch_type TEXT NOT NULL,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- ============================================================
-- 7. naver_settlements (13 columns)
-- ============================================================
CREATE TABLE naver_settlements (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  order_no TEXT,
  product_order_no TEXT,
  category TEXT,
  product_name TEXT,
  buyer_name TEXT,
  settle_base_date DATE,
  settle_scheduled_date DATE,
  settle_amount INTEGER,
  settle_status TEXT,
  match_status TEXT DEFAULT 'unmatched'::text,
  upload_batch TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- ============================================================
-- 8. notification_logs (10 columns)
-- ============================================================
CREATE TABLE notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  consignment_id UUID,
  seller_id UUID,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'sms'::text,
  status TEXT NOT NULL DEFAULT 'pending'::text,
  api_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- ============================================================
-- 9. order_items (23 columns)
-- ============================================================
CREATE TABLE order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  product_number TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  category TEXT,
  condition TEXT,
  estimated_price INTEGER DEFAULT 0,
  final_price INTEGER,
  status TEXT DEFAULT 'PENDING'::text,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  customer_price INTEGER DEFAULT 0,
  size TEXT,
  inspection_status TEXT NOT NULL DEFAULT 'pending'::text,
  item_type TEXT,
  measurements JSONB,
  hold_adjusted_price INTEGER,
  hold_reason TEXT,
  hold_photo_url TEXT,
  hold_date TIMESTAMPTZ,
  customer_agreed BOOLEAN NOT NULL DEFAULT false,
  customer_agreed_at TIMESTAMPTZ,
  PRIMARY KEY (id)
);

-- ============================================================
-- 10. orders (19 columns)
-- ============================================================
CREATE TABLE orders (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  postal_code TEXT,
  visit_date DATE,
  arrival_date DATE,
  box_qty INTEGER DEFAULT 1,
  total_estimated INTEGER DEFAULT 0,
  commission INTEGER DEFAULT 0,
  final_payout INTEGER DEFAULT 0,
  status TEXT DEFAULT 'APPLIED'::text,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  seller_type TEXT NOT NULL DEFAULT 'general'::text,
  purchase_source TEXT,
  custom_commission_rate NUMERIC(5,4),
  hold_token TEXT,
  PRIMARY KEY (id)
);

-- ============================================================
-- 11. photo_uploads (8 columns)
-- ============================================================
CREATE TABLE photo_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by TEXT DEFAULT 'admin'::text,
  is_matched BOOLEAN DEFAULT false,
  order_item_id UUID,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- ============================================================
-- 12. photos (9 columns)
-- ============================================================
CREATE TABLE photos (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  shot_type TEXT DEFAULT 'main'::text,
  is_edited BOOLEAN DEFAULT false,
  edited_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- ============================================================
-- 13. price_estimate_cache (10 columns)
-- ============================================================
CREATE TABLE price_estimate_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL,
  brand TEXT NOT NULL,
  product_name TEXT NOT NULL,
  retail_price INTEGER,
  confidence NUMERIC(3,2),
  sources JSONB,
  reasoning TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + '7 days'::interval),
  PRIMARY KEY (id)
);

-- ============================================================
-- 14. price_references (10 columns) — DELTA-9: bigint + sequence
-- ============================================================
CREATE TABLE price_references (
  id BIGINT NOT NULL DEFAULT nextval('price_references_id_seq'::regclass),
  brand TEXT NOT NULL,
  product_name TEXT NOT NULL,
  size TEXT,
  original_price INTEGER NOT NULL,
  final_price INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  main_image TEXT,
  extra_images TEXT[] DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER SEQUENCE price_references_id_seq OWNED BY price_references.id;

-- ============================================================
-- 15. return_shipments (19 columns)
-- ============================================================
CREATE TABLE return_shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  consignment_id UUID NOT NULL,
  trigger_type TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_phone TEXT NOT NULL,
  sender_zipcode TEXT NOT NULL,
  sender_address TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  recipient_zipcode TEXT,
  recipient_address TEXT NOT NULL,
  courier_code TEXT NOT NULL DEFAULT 'CJGLS'::text,
  tracking_number TEXT,
  payment_type TEXT NOT NULL DEFAULT 'prepaid'::text,
  status TEXT NOT NULL DEFAULT 'pending'::text,
  api_response JSONB,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- ============================================================
-- 16. sales_ledger (23 columns)
-- ============================================================
CREATE TABLE sales_ledger (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  order_id TEXT NOT NULL,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  sale_price INTEGER NOT NULL,
  sale_type TEXT DEFAULT 'normal'::text,
  product_type TEXT DEFAULT 'inventory'::text,
  seller_id UUID,
  seller_name TEXT,
  buyer_name TEXT,
  purchase_confirmed BOOLEAN DEFAULT false,
  purchase_confirmed_at DATE,
  return_order_id TEXT,
  sold_at DATE NOT NULL,
  channel TEXT DEFAULT 'smart_store'::text,
  source_file TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  product_order_id TEXT,
  naver_product_id TEXT,
  discount INTEGER DEFAULT 0,
  final_amount INTEGER,
  naver_settlement INTEGER,
  PRIMARY KEY (id)
);

-- ============================================================
-- 17. sales_records (19 columns)
-- ============================================================
CREATE TABLE sales_records (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  sale_date DATE NOT NULL,
  buyer_name TEXT,
  naver_order_no TEXT,
  brand TEXT,
  product_name TEXT,
  product_code TEXT,
  product_number TEXT,
  original_price INTEGER,
  discount_rate NUMERIC(5,4),
  sale_amount INTEGER,
  quantity INTEGER DEFAULT 1,
  final_amount INTEGER,
  is_consignment BOOLEAN DEFAULT false,
  consignment_seller TEXT,
  match_status TEXT DEFAULT 'unmatched'::text,
  upload_batch TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  upload_session_id UUID,
  PRIMARY KEY (id)
);

-- ============================================================
-- 18. search_synonyms (5 columns) — DELTA-9: bigint + sequence
-- ============================================================
CREATE TABLE search_synonyms (
  id BIGINT NOT NULL DEFAULT nextval('search_synonyms_id_seq'::regclass),
  canonical TEXT NOT NULL,
  synonym TEXT NOT NULL,
  category_group TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER SEQUENCE search_synonyms_id_seq OWNED BY search_synonyms.id;

-- ============================================================
-- 19. sellers (24 columns)
-- ============================================================
CREATE TABLE sellers (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  seller_code TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  id_card_number TEXT,
  id_card_verified BOOLEAN DEFAULT false,
  id_card_file_url TEXT,
  bank_name TEXT,
  bank_account TEXT,
  bank_holder TEXT,
  bank_verified BOOLEAN DEFAULT false,
  commission_rate NUMERIC,
  contract_start DATE,
  contract_end DATE,
  channel_type TEXT DEFAULT 'half_size'::text,
  status TEXT DEFAULT 'pending'::text,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  seller_tier TEXT DEFAULT 'general'::text,
  tagging_code TEXT,
  nickname TEXT,
  marketing_consent BOOLEAN DEFAULT false,
  marketing_consent_at TIMESTAMPTZ,
  PRIMARY KEY (id)
);

-- ============================================================
-- 20. settlement_audit_log (9 columns)
-- ============================================================
CREATE TABLE settlement_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value TEXT,
  new_value TEXT,
  detail TEXT,
  performed_by TEXT DEFAULT 'system'::text,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- ============================================================
-- 21. settlement_items (3 columns)
-- ============================================================
CREATE TABLE settlement_items (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  settlement_id UUID NOT NULL,
  sold_item_id UUID NOT NULL,
  PRIMARY KEY (id)
);

-- ============================================================
-- 22. settlement_matches (8 columns)
-- ============================================================
CREATE TABLE settlement_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  sales_record_id UUID,
  naver_settlement_id UUID,
  match_type TEXT NOT NULL,
  match_score NUMERIC(5,4),
  match_reason TEXT,
  matched_by TEXT DEFAULT 'system'::text,
  matched_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- ============================================================
-- 23. settlement_queue (14 columns)
-- ============================================================
CREATE TABLE settlement_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  match_id UUID,
  seller_id UUID,
  seller_name TEXT NOT NULL,
  product_name TEXT,
  product_number TEXT,
  sale_amount INTEGER,
  commission_rate NUMERIC(5,4),
  commission_amount INTEGER,
  payout_amount INTEGER,
  settle_base_date DATE,
  queue_status TEXT DEFAULT 'pending'::text,
  settlement_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- ============================================================
-- 24. settlements (16 columns)
-- ============================================================
CREATE TABLE settlements (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  seller_id UUID NOT NULL,
  settlement_period_start DATE NOT NULL,
  settlement_period_end DATE NOT NULL,
  total_sales INTEGER NOT NULL DEFAULT 0,
  commission_rate NUMERIC NOT NULL,
  commission_amount INTEGER NOT NULL DEFAULT 0,
  return_deduction INTEGER NOT NULL DEFAULT 0,
  settlement_amount INTEGER NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'draft'::text,
  paid_at TIMESTAMPTZ,
  paid_by TEXT,
  transfer_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  PRIMARY KEY (id)
);

-- ============================================================
-- 25. sold_items (20 columns)
-- ============================================================
CREATE TABLE sold_items (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  seller_id UUID NOT NULL,
  channel TEXT DEFAULT 'smart_store'::text,
  order_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_number TEXT,
  quantity INTEGER NOT NULL,
  sale_price INTEGER NOT NULL,
  shipping_fee INTEGER DEFAULT 0,
  sold_at DATE NOT NULL,
  purchase_confirmed BOOLEAN DEFAULT false,
  purchase_confirmed_at DATE,
  settlement_status TEXT DEFAULT 'pending'::text,
  settlement_id UUID,
  return_processed BOOLEAN DEFAULT false,
  source_file TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  product_order_id TEXT,
  naver_product_id TEXT,
  product_code TEXT,
  PRIMARY KEY (id)
);

-- ============================================================
-- 26. st_products (36 columns)
-- ============================================================
CREATE TABLE st_products (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  product_number TEXT,
  legacy_code TEXT,
  product_name TEXT NOT NULL,
  seller_id UUID,
  sale_price INTEGER NOT NULL,
  product_type TEXT DEFAULT 'consignment'::text,
  is_active BOOLEAN DEFAULT true,
  smart_store_registered BOOLEAN DEFAULT false,
  consignment_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  brand TEXT,
  size TEXT,
  origin TEXT,
  material TEXT,
  measurements JSONB DEFAULT '{}'::jsonb,
  naver_product_id TEXT,
  seller_payment INTEGER,
  product_condition TEXT,
  unsellable_reason TEXT,
  sold_at DATE,
  sold_amount INTEGER,
  sales_record_id UUID,
  buyer_name TEXT,
  reference_image TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  photo_status TEXT DEFAULT 'pending'::text,
  smartstore_status TEXT DEFAULT 'draft'::text,
  smartstore_data JSONB,
  composition TEXT,
  category TEXT,
  retail_price INTEGER,
  retail_price_source TEXT,
  retail_price_confidence NUMERIC(3,2),
  color TEXT,
  PRIMARY KEY (id)
);

-- ========================================

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

-- ========================================

-- =============================================================================
-- 03_indexes.sql — Tokyo V3 Indexes
-- Source: V2 production backup (v2_indexes.txt) — 129 indexes total
-- Skipped: *_pkey indexes (created by PRIMARY KEY in 01_tables.sql)
-- DELTA-5: idx_consignment_seller upgraded to composite (seller_id + status)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- _batch_progress
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX _batch_progress_batch_id_key ON public._batch_progress USING btree (batch_id);

-- ---------------------------------------------------------------------------
-- brand_aliases
-- ---------------------------------------------------------------------------
CREATE INDEX idx_brand_aliases_official ON public.brand_aliases USING btree (official_name);
CREATE INDEX idx_brand_aliases_alias ON public.brand_aliases USING btree (alias);
CREATE UNIQUE INDEX brand_aliases_official_name_alias_key ON public.brand_aliases USING btree (official_name, alias);

-- ---------------------------------------------------------------------------
-- consignment_requests
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX consignment_requests_adjustment_token_key ON public.consignment_requests USING btree (adjustment_token);
CREATE UNIQUE INDEX uq_consignment_seller_product ON public.consignment_requests USING btree (seller_id, product_name);
CREATE INDEX idx_consignment_status ON public.consignment_requests USING btree (status);

-- DELTA-5: composite index (V2: seller_id only → V3: seller_id + status)
CREATE INDEX idx_consignment_seller ON public.consignment_requests USING btree (seller_id, status);

-- ---------------------------------------------------------------------------
-- excel_uploads
-- ---------------------------------------------------------------------------
CREATE INDEX idx_uploads_type ON public.excel_uploads USING btree (upload_type);
CREATE INDEX idx_uploads_status ON public.excel_uploads USING btree (status);

-- ---------------------------------------------------------------------------
-- market_prices
-- ---------------------------------------------------------------------------
CREATE INDEX idx_market_prices_brand ON public.market_prices USING btree (brand);
CREATE UNIQUE INDEX market_prices_source_url_key ON public.market_prices USING btree (source_url);
CREATE INDEX idx_market_prices_created ON public.market_prices USING btree (created_at DESC);
CREATE INDEX idx_market_prices_source ON public.market_prices USING btree (source);
CREATE INDEX idx_market_prices_brand_type ON public.market_prices USING btree (brand, category);

-- ---------------------------------------------------------------------------
-- mismatches
-- ---------------------------------------------------------------------------
CREATE INDEX idx_mismatch_upload ON public.mismatches USING btree (upload_id);
CREATE INDEX idx_mismatch_resolved ON public.mismatches USING btree (resolved);

-- ---------------------------------------------------------------------------
-- naver_settlements
-- ---------------------------------------------------------------------------
CREATE INDEX idx_naver_settlements_product_order_no ON public.naver_settlements USING btree (product_order_no);
CREATE INDEX idx_naver_settlements_buyer_name ON public.naver_settlements USING btree (buyer_name);
CREATE INDEX idx_naver_settlements_settle_base_date ON public.naver_settlements USING btree (settle_base_date);
CREATE INDEX idx_naver_settlements_match_status ON public.naver_settlements USING btree (match_status);
CREATE UNIQUE INDEX idx_naver_settlements_dedup ON public.naver_settlements USING btree (product_order_no) WHERE (product_order_no IS NOT NULL);

-- ---------------------------------------------------------------------------
-- notification_logs
-- ---------------------------------------------------------------------------
CREATE INDEX idx_notification_logs_consignment ON public.notification_logs USING btree (consignment_id);
CREATE INDEX idx_notification_logs_seller ON public.notification_logs USING btree (seller_id);

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);
CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items USING btree (product_number);
CREATE UNIQUE INDEX order_items_product_id_key ON public.order_items USING btree (product_number);

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC);
CREATE INDEX idx_orders_hold_token ON public.orders USING btree (hold_token) WHERE (hold_token IS NOT NULL);
CREATE UNIQUE INDEX orders_order_number_key ON public.orders USING btree (order_number);
CREATE INDEX idx_orders_status ON public.orders USING btree (status);
CREATE INDEX idx_orders_order_number ON public.orders USING btree (order_number);

-- ---------------------------------------------------------------------------
-- photo_uploads
-- ---------------------------------------------------------------------------
CREATE INDEX idx_photo_uploads_is_matched ON public.photo_uploads USING btree (is_matched);

-- ---------------------------------------------------------------------------
-- photos
-- ---------------------------------------------------------------------------
CREATE INDEX idx_photos_order_item_id ON public.photos USING btree (order_item_id);

-- ---------------------------------------------------------------------------
-- price_estimate_cache
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX price_estimate_cache_cache_key_key ON public.price_estimate_cache USING btree (cache_key);
CREATE INDEX idx_price_cache_key ON public.price_estimate_cache USING btree (cache_key);
CREATE INDEX idx_price_cache_expires ON public.price_estimate_cache USING btree (expires_at);

-- ---------------------------------------------------------------------------
-- price_references
-- ---------------------------------------------------------------------------
CREATE INDEX idx_price_refs_brand ON public.price_references USING btree (brand);
CREATE INDEX idx_price_refs_brand_lower ON public.price_references USING btree (lower(brand));

-- ---------------------------------------------------------------------------
-- return_shipments
-- ---------------------------------------------------------------------------
CREATE INDEX idx_return_shipments_consignment ON public.return_shipments USING btree (consignment_id);
CREATE UNIQUE INDEX uq_return_consignment ON public.return_shipments USING btree (consignment_id);

-- ---------------------------------------------------------------------------
-- sales_ledger
-- ---------------------------------------------------------------------------
CREATE INDEX idx_ledger_sold_at ON public.sales_ledger USING btree (sold_at);
CREATE UNIQUE INDEX sales_ledger_order_id_product_code_sale_type_key ON public.sales_ledger USING btree (order_id, product_code, sale_type);
CREATE INDEX idx_ledger_order ON public.sales_ledger USING btree (order_id);
CREATE INDEX idx_ledger_seller ON public.sales_ledger USING btree (seller_id);
CREATE INDEX idx_ledger_type ON public.sales_ledger USING btree (product_type);
CREATE INDEX idx_ledger_product_order ON public.sales_ledger USING btree (product_order_id);
CREATE INDEX idx_ledger_naver ON public.sales_ledger USING btree (naver_product_id);
CREATE UNIQUE INDEX sales_ledger_product_order_unique ON public.sales_ledger USING btree (product_order_id, sale_type);

-- ---------------------------------------------------------------------------
-- sales_records
-- ---------------------------------------------------------------------------
CREATE INDEX idx_sales_records_naver_order_no ON public.sales_records USING btree (naver_order_no);
CREATE INDEX idx_sales_records_sale_date ON public.sales_records USING btree (sale_date);
CREATE INDEX idx_sales_records_session ON public.sales_records USING btree (upload_session_id) WHERE (upload_session_id IS NOT NULL);
CREATE UNIQUE INDEX idx_sales_records_dedup ON public.sales_records USING btree (sale_date, naver_order_no, buyer_name, product_name) WHERE (naver_order_no IS NOT NULL);
CREATE INDEX idx_sales_records_match_status ON public.sales_records USING btree (match_status);
CREATE INDEX idx_sales_records_is_consignment ON public.sales_records USING btree (is_consignment);

-- ---------------------------------------------------------------------------
-- search_synonyms
-- ---------------------------------------------------------------------------
CREATE INDEX idx_search_synonyms_canonical ON public.search_synonyms USING btree (canonical);
CREATE INDEX idx_search_synonyms_synonym ON public.search_synonyms USING btree (lower(synonym));

-- ---------------------------------------------------------------------------
-- sellers
-- ---------------------------------------------------------------------------
CREATE INDEX idx_sellers_tagging ON public.sellers USING btree (tagging_code);
CREATE INDEX idx_sellers_phone ON public.sellers USING btree (phone);
CREATE INDEX idx_sellers_status ON public.sellers USING btree (status);
CREATE UNIQUE INDEX sellers_phone_key ON public.sellers USING btree (phone);
CREATE UNIQUE INDEX sellers_seller_code_key ON public.sellers USING btree (seller_code);
CREATE INDEX idx_sellers_name ON public.sellers USING btree (name);
CREATE INDEX idx_sellers_tier ON public.sellers USING btree (seller_tier);

-- ---------------------------------------------------------------------------
-- settlement_audit_log
-- ---------------------------------------------------------------------------
CREATE INDEX idx_audit_log_created_at ON public.settlement_audit_log USING btree (created_at DESC);
CREATE INDEX idx_audit_log_entity ON public.settlement_audit_log USING btree (entity_type, entity_id);
CREATE INDEX idx_audit_log_action ON public.settlement_audit_log USING btree (action);

-- ---------------------------------------------------------------------------
-- settlement_items
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX settlement_items_settlement_id_sold_item_id_key ON public.settlement_items USING btree (settlement_id, sold_item_id);
CREATE INDEX idx_si_sold ON public.settlement_items USING btree (sold_item_id);
CREATE INDEX idx_si_settlement ON public.settlement_items USING btree (settlement_id);

-- ---------------------------------------------------------------------------
-- settlement_matches
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX settlement_matches_sales_record_id_key ON public.settlement_matches USING btree (sales_record_id);
CREATE INDEX idx_settlement_matches_naver_settlement_id ON public.settlement_matches USING btree (naver_settlement_id);
CREATE INDEX idx_settlement_matches_sales_record_id ON public.settlement_matches USING btree (sales_record_id);
CREATE UNIQUE INDEX settlement_matches_naver_settlement_id_key ON public.settlement_matches USING btree (naver_settlement_id);

-- ---------------------------------------------------------------------------
-- settlement_queue
-- ---------------------------------------------------------------------------
CREATE INDEX idx_settlement_queue_queue_status ON public.settlement_queue USING btree (queue_status);
CREATE UNIQUE INDEX uq_settlement_queue_match ON public.settlement_queue USING btree (match_id);
CREATE INDEX idx_settlement_queue_settle_base_date ON public.settlement_queue USING btree (settle_base_date);
CREATE INDEX idx_settlement_queue_seller_id ON public.settlement_queue USING btree (seller_id);

-- ---------------------------------------------------------------------------
-- settlements
-- ---------------------------------------------------------------------------
CREATE INDEX idx_settlements_seller ON public.settlements USING btree (seller_id);
CREATE INDEX idx_settlements_status ON public.settlements USING btree (status);
CREATE INDEX idx_settlements_period ON public.settlements USING btree (settlement_period_start, settlement_period_end);

-- ---------------------------------------------------------------------------
-- sold_items
-- ---------------------------------------------------------------------------
CREATE INDEX idx_sold_status ON public.sold_items USING btree (settlement_status);
CREATE INDEX idx_sold_at ON public.sold_items USING btree (sold_at);
CREATE INDEX idx_sold_confirmed ON public.sold_items USING btree (purchase_confirmed);
CREATE INDEX idx_sold_product ON public.sold_items USING btree (product_number);
CREATE INDEX idx_sold_product_order ON public.sold_items USING btree (product_order_id);
CREATE UNIQUE INDEX sold_items_product_order_id_key ON public.sold_items USING btree (product_order_id);
CREATE INDEX idx_sold_items_seller_settlement ON public.sold_items USING btree (seller_id, settlement_status);
CREATE INDEX idx_sold_seller ON public.sold_items USING btree (seller_id);

-- ---------------------------------------------------------------------------
-- st_products
-- ---------------------------------------------------------------------------
CREATE INDEX idx_st_products_sold_at ON public.st_products USING btree (sold_at);
CREATE INDEX idx_st_products_smartstore_status ON public.st_products USING btree (smartstore_status);
CREATE INDEX idx_st_products_category ON public.st_products USING btree (category);
CREATE INDEX idx_st_products_name ON public.st_products USING btree (product_name);
CREATE INDEX idx_st_products_type ON public.st_products USING btree (product_type);
CREATE INDEX idx_st_products_legacy ON public.st_products USING btree (legacy_code);
CREATE INDEX idx_st_products_seller ON public.st_products USING btree (seller_id);
CREATE UNIQUE INDEX st_products_legacy_code_key ON public.st_products USING btree (legacy_code);
CREATE UNIQUE INDEX st_products_product_number_key ON public.st_products USING btree (product_number);
CREATE INDEX idx_st_products_brand ON public.st_products USING btree (brand);
CREATE INDEX idx_st_products_naver ON public.st_products USING btree (naver_product_id);
CREATE INDEX idx_st_products_seller_id ON public.st_products USING btree (seller_id);
CREATE INDEX idx_st_products_photo_status ON public.st_products USING btree (photo_status);

-- ========================================

-- ============================================================
-- Tokyo DDL: 04_functions.sql
-- Total: 10 functions
-- Generated: 2026-03-05
-- ============================================================

-- ============================================================
-- Function: update_updated_at
-- Source: V3 migration 014 (20260304000014_updated_at_triggers.sql)
-- DELTA: N/A
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Function: create_order_with_items
-- Source: V2 original
-- DELTA: N/A
-- ============================================================
CREATE OR REPLACE FUNCTION create_order_with_items(
  p_order_number text,
  p_customer_name text,
  p_customer_phone text,
  p_status text,
  p_items jsonb
) RETURNS uuid
  LANGUAGE plpgsql
AS $function$
DECLARE
  v_order_id uuid;
  v_item jsonb;
  v_items_count int;
BEGIN
  v_items_count := jsonb_array_length(p_items);
  IF v_items_count = 0 THEN
    RAISE EXCEPTION '주문 아이템이 비어있습니다';
  END IF;

  INSERT INTO orders (order_number, customer_name, phone, status)
  VALUES (p_order_number, p_customer_name, p_customer_phone, p_status)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF v_item->>'product_number' IS NULL THEN
      RAISE EXCEPTION '주문 아이템에 product_number가 누락되었습니다';
    END IF;

    INSERT INTO order_items (
      order_id, product_number, brand, model, category,
      condition, size, measurements, inspection_status, customer_agreed
    ) VALUES (
      v_order_id,
      v_item->>'product_number',
      v_item->>'brand',
      COALESCE(v_item->>'model', ''),
      v_item->>'category',
      v_item->>'condition',
      v_item->>'size',
      (v_item->'measurements')::jsonb,
      COALESCE(v_item->>'inspection_status', 'pending'),
      COALESCE((v_item->>'customer_agreed')::boolean, false)
    );
  END LOOP;

  RETURN v_order_id;
END;
$function$;

-- ============================================================
-- Function: create_settlement_with_items
-- Source: V3 migration 012 (20260304000012_fix_rpc_settlement_v2.sql)
-- DELTA: DELTA-2 (V2 bugs: period_start→settlement_period_start, 'pending'→'draft', etc.)
-- ============================================================
CREATE OR REPLACE FUNCTION create_settlement_with_items(
  p_seller_id uuid,
  p_period_start date,
  p_period_end date,
  p_total_sales numeric,
  p_commission_rate numeric,
  p_commission_amount numeric,
  p_settlement_amount numeric,
  p_sold_item_ids uuid[]
) RETURNS uuid AS $$
DECLARE
  v_settlement_id uuid;
  v_locked_count int;
  v_expected_count int;
BEGIN
  v_expected_count := COALESCE(array_length(p_sold_item_ids, 1), 0);
  IF v_expected_count = 0 THEN
    RAISE EXCEPTION '정산 항목이 비어있습니다';
  END IF;

  SELECT COUNT(*) INTO v_locked_count
    FROM sold_items
    WHERE id = ANY(p_sold_item_ids)
      AND settlement_status = 'pending'
    FOR UPDATE;

  IF v_locked_count != v_expected_count THEN
    RAISE EXCEPTION '잠금 실패: 예상 %건 중 %건만 pending', v_expected_count, v_locked_count;
  END IF;

  INSERT INTO settlements (
    seller_id, settlement_period_start, settlement_period_end,
    total_sales, commission_rate, commission_amount, settlement_amount,
    item_count, status
  ) VALUES (
    p_seller_id, p_period_start, p_period_end,
    p_total_sales, p_commission_rate, p_commission_amount, p_settlement_amount,
    v_expected_count, 'draft'
  ) RETURNING id INTO v_settlement_id;

  INSERT INTO settlement_items (settlement_id, sold_item_id)
    SELECT v_settlement_id, unnest(p_sold_item_ids);

  UPDATE sold_items
    SET settlement_status = 'settled'
    WHERE id = ANY(p_sold_item_ids);

  RETURN v_settlement_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Function: complete_consignment
-- Source: V3 migration 013 (20260304000013_fix_rpc_consignment_v2.sql)
-- DELTA: DELTA-3 (V2 bugs: missing columns, condition→product_condition, status, etc.)
-- ============================================================
CREATE OR REPLACE FUNCTION complete_consignment(
  p_consignment_id uuid,
  p_product_number text,
  p_product_name text DEFAULT NULL,
  p_sale_price integer DEFAULT 0,
  p_seller_id uuid DEFAULT NULL,
  p_brand text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_condition text DEFAULT NULL,
  p_size text DEFAULT NULL,
  p_color text DEFAULT NULL,
  p_measurements jsonb DEFAULT NULL,
  p_order_number text DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_consignment record;
  v_product_id uuid;
  v_order_id uuid;
  v_actual_seller_id uuid;
  v_actual_product_name text;
BEGIN
  -- Step 1: Validate consignment
  SELECT * INTO v_consignment
    FROM consignment_requests
    WHERE id = p_consignment_id AND status = 'approved'
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '위탁 요청을 찾을 수 없거나 approved 상태가 아닙니다 (id: %)', p_consignment_id;
  END IF;

  -- seller_id: 파라미터 > consignment_requests.seller_id
  v_actual_seller_id := COALESCE(p_seller_id, v_consignment.seller_id);
  -- product_name: 파라미터 > consignment_requests.product_name
  v_actual_product_name := COALESCE(p_product_name, v_consignment.product_name);

  -- Step 2: Insert st_products (V2 컬럼명 사용)
  BEGIN
    INSERT INTO st_products (
      product_number, product_name, seller_id, sale_price,
      product_type, is_active, photo_status, smartstore_status,
      brand, category, product_condition, size, color, measurements,
      consignment_date
    ) VALUES (
      p_product_number, v_actual_product_name, v_actual_seller_id, p_sale_price,
      'consignment', true, 'pending', 'draft',
      p_brand, p_category, p_condition, p_size, p_color, p_measurements,
      CURRENT_DATE
    )
    RETURNING id INTO v_product_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION '상품번호가 이미 존재합니다: %', p_product_number;
  END;

  -- Step 3: Create order if data provided
  IF p_order_number IS NOT NULL THEN
    INSERT INTO orders (order_number, customer_name, phone, status)
    VALUES (p_order_number, p_customer_name, p_customer_phone, 'APPLIED')
    RETURNING id INTO v_order_id;

    INSERT INTO order_items (order_id, product_number, brand, model, condition)
    VALUES (v_order_id, p_product_number, COALESCE(p_brand, ''), COALESCE(v_actual_product_name, ''), COALESCE(p_condition, 'N'));
  END IF;

  -- Step 4: Update consignment status + link product
  UPDATE consignment_requests
    SET status = 'completed',
        product_id = v_product_id,
        inspected_at = now(),
        updated_at = now()
    WHERE id = p_consignment_id;

  RETURN v_product_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Function: generate_product_number
-- Source: V3 migration 015 (20260304000015_rpc_generate_product_number.sql)
-- DELTA: DELTA-4 (V3 uses CT-{SELLER_CODE}-{SEQ} vs V2's YYMMDD-RANDOM)
-- ============================================================
CREATE OR REPLACE FUNCTION generate_product_number(p_seller_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_seller_code TEXT;
  v_next_seq INTEGER;
  v_product_number TEXT;
BEGIN
  -- Step 1: 셀러 코드 조회
  SELECT seller_code INTO v_seller_code
  FROM sellers WHERE id = p_seller_id;

  IF v_seller_code IS NULL THEN
    RAISE EXCEPTION '셀러를 찾을 수 없습니다: %', p_seller_id;
  END IF;

  -- Step 2: 해당 셀러의 현재 최대 순번 조회 + 1
  -- pg_advisory_xact_lock으로 동시성 보호 (같은 셀러에 대한 동시 호출 시 직렬화)
  PERFORM pg_advisory_xact_lock(hashtext('gen_prod_num_' || v_seller_code));

  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(product_number, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO v_next_seq
  FROM st_products
  WHERE product_number LIKE 'CT-' || v_seller_code || '-%';

  -- Step 3: 형식 조립 (CT-{SELLER_CODE}-{SEQ:3})
  v_product_number := 'CT-' || v_seller_code || '-' || LPAD(v_next_seq::TEXT, 3, '0');

  RETURN v_product_number;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION generate_product_number(UUID) TO authenticated, service_role;

-- ============================================================
-- Function: find_brand
-- Source: V2 original
-- DELTA: DELTA-6
-- ============================================================
CREATE OR REPLACE FUNCTION find_brand(search_term text)
RETURNS TABLE(official_name text, alias text)
  LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT ba.official_name, ba.alias
  FROM brand_aliases ba
  WHERE ba.alias ILIKE '%' || search_term || '%'
     OR ba.official_name ILIKE '%' || search_term || '%'
  ORDER BY
    -- 정확한 매칭 우선
    CASE WHEN ba.alias ILIKE search_term THEN 0
         WHEN ba.official_name ILIKE search_term THEN 0
         ELSE 1 END,
    ba.official_name
  LIMIT 10;
END;
$function$;

-- ============================================================
-- Function: generate_order_number
-- Source: V2 original
-- DELTA: DELTA-6
-- ============================================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text
  LANGUAGE plpgsql
AS $function$
DECLARE
  num TEXT;
BEGIN
  LOOP
    num := TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE order_number = num);
  END LOOP;
  RETURN num;
END;
$function$;

-- ============================================================
-- Function: get_commission_rate
-- Source: V2 original
-- DELTA: DELTA-6
-- ============================================================
CREATE OR REPLACE FUNCTION get_commission_rate(p_seller_id uuid)
RETURNS numeric
  LANGUAGE plpgsql
AS $function$
DECLARE
  v_individual_rate DECIMAL;
  v_tier TEXT;
BEGIN
  SELECT commission_rate, seller_tier
  INTO v_individual_rate, v_tier
  FROM sellers WHERE id = p_seller_id;

  -- 개별 수수료율이 설정되어 있으면 우선
  IF v_individual_rate IS NOT NULL AND v_individual_rate > 0 THEN
    RETURN v_individual_rate;
  END IF;

  -- 등급별 기본 수수료율
  CASE v_tier
    WHEN 'general' THEN RETURN 0.25;
    WHEN 'employee' THEN RETURN 0.20;
    WHEN 'vip' THEN RETURN 0.20;
    ELSE RETURN 0.25;
  END CASE;
END;
$function$;

-- ============================================================
-- Function: pgp_sym_decrypt_text
-- Source: V2 original
-- DELTA: DELTA-6, DELTA-10
-- ============================================================
CREATE OR REPLACE FUNCTION pgp_sym_decrypt_text(cipher_text text, encryption_key text)
RETURNS text
  LANGUAGE sql
AS $function$
  SELECT pgp_sym_decrypt(decode(cipher_text, 'base64'), encryption_key);
$function$;

-- ============================================================
-- Function: pgp_sym_encrypt_text
-- Source: V2 original
-- DELTA: DELTA-6, DELTA-10
-- ============================================================
CREATE OR REPLACE FUNCTION pgp_sym_encrypt_text(plain_text text, encryption_key text)
RETURNS text
  LANGUAGE sql
AS $function$
  SELECT encode(pgp_sym_encrypt(plain_text, encryption_key), 'base64');
$function$;

-- ========================================

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

-- ========================================

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
-- market_prices (2 policies)
-- ---------------------------------------------------------------------------
CREATE POLICY "Allow service write market_prices" ON public.market_prices
  FOR ALL TO public
  USING (true) WITH CHECK (true);

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
-- order_items (1 policy)
-- ---------------------------------------------------------------------------
CREATE POLICY "Allow all" ON public.order_items
  FOR ALL TO public
  USING (true) WITH CHECK (true);

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
-- photo_uploads (1 policy)
-- ---------------------------------------------------------------------------
CREATE POLICY "Allow all" ON public.photo_uploads
  FOR ALL TO public
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- photos (1 policy)
-- ---------------------------------------------------------------------------
CREATE POLICY "Allow all" ON public.photos
  FOR ALL TO public
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- price_estimate_cache (1 policy)
-- ---------------------------------------------------------------------------
CREATE POLICY "service role full access" ON public.price_estimate_cache
  FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));

-- ---------------------------------------------------------------------------
-- price_references (2 policies)
-- ---------------------------------------------------------------------------
CREATE POLICY "Allow service write price_references" ON public.price_references
  FOR ALL TO public
  USING (true) WITH CHECK (true);

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
