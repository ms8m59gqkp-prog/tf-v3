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
-- 19. sellers (25 columns) — migration 017에서 address 추가
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
  address TEXT,
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
  fail_reason TEXT,
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
