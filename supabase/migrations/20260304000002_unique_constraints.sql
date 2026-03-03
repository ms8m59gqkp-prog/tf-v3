-- 20260304000002_unique_constraints.sql
-- WHY: 이중 정산(FIN-01), 판매자 중복(H5/H6), 상품번호 충돌(H19)
-- HOW: DO 블록 내 pg_constraint 조회로 존재 여부 확인 → 없는 것만 추가
-- WHERE: plan5.md §3.1.2
-- APPLY: db push
--
-- [V2 실측 반영] 2026-03-04
-- sellers(phone)          → sellers_phone_key 이미 존재 → 스킵
-- sellers(seller_code)    → sellers_seller_code_key 이미 존재 → 스킵
-- st_products(product_number) → st_products_product_number_key 이미 존재 → 스킵
-- settlement_queue(match_id)  → 없음 → 추가 필요
-- return_shipments(consignment_id) → 없음 → 추가 필요

-- [사전 조건] 각 테이블 중복 확인 쿼리 실행 필수
-- [사전 조건] 외래키 참조 테이블 4개(consignment_requests, sold_items,
--            settlement_queue, st_products) 고아 참조 정리
-- [Rev.5-R5] 운영 중 DB에 적용 시 CREATE UNIQUE INDEX CONCURRENTLY 사용 고려

DO $$
BEGIN
  -- 1) settlement_queue(match_id) — V2 실측: 없음 → 추가
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
      JOIN pg_class r ON r.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = r.relnamespace
     WHERE n.nspname = 'public'
       AND r.relname = 'settlement_queue'
       AND c.contype = 'u'
       AND c.conname = 'uq_settlement_queue_match'
  ) THEN
    RAISE NOTICE '[002] uq_settlement_queue_match 없음 → 생성';
    ALTER TABLE settlement_queue
      ADD CONSTRAINT uq_settlement_queue_match UNIQUE (match_id);
  ELSE
    RAISE NOTICE '[002] uq_settlement_queue_match 이미 존재 → 스킵';
  END IF;

  -- 2) sellers(phone) — V2 실측: sellers_phone_key 이미 존재 → 스킵
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
      JOIN pg_class r ON r.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = r.relnamespace
     WHERE n.nspname = 'public'
       AND r.relname = 'sellers'
       AND c.contype = 'u'
       AND EXISTS (
         SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = r.oid
            AND a.attnum = ANY(c.conkey)
            AND a.attname = 'phone'
       )
  ) THEN
    RAISE NOTICE '[002] sellers(phone) UNIQUE 없음 → 생성';
    ALTER TABLE sellers
      ADD CONSTRAINT uq_sellers_phone UNIQUE (phone);
  ELSE
    RAISE NOTICE '[002] sellers(phone) UNIQUE 이미 존재 → 스킵';
  END IF;

  -- 3) sellers(seller_code) — V2 실측: sellers_seller_code_key 이미 존재 → 스킵
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
      JOIN pg_class r ON r.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = r.relnamespace
     WHERE n.nspname = 'public'
       AND r.relname = 'sellers'
       AND c.contype = 'u'
       AND EXISTS (
         SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = r.oid
            AND a.attnum = ANY(c.conkey)
            AND a.attname = 'seller_code'
       )
  ) THEN
    RAISE NOTICE '[002] sellers(seller_code) UNIQUE 없음 → 생성';
    ALTER TABLE sellers
      ADD CONSTRAINT uq_sellers_code UNIQUE (seller_code);
  ELSE
    RAISE NOTICE '[002] sellers(seller_code) UNIQUE 이미 존재 → 스킵';
  END IF;

  -- 4) return_shipments(consignment_id) — V2 실측: 없음 → 추가
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
      JOIN pg_class r ON r.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = r.relnamespace
     WHERE n.nspname = 'public'
       AND r.relname = 'return_shipments'
       AND c.contype = 'u'
       AND c.conname = 'uq_return_consignment'
  ) THEN
    RAISE NOTICE '[002] uq_return_consignment 없음 → 생성';
    ALTER TABLE return_shipments
      ADD CONSTRAINT uq_return_consignment UNIQUE (consignment_id);
  ELSE
    RAISE NOTICE '[002] uq_return_consignment 이미 존재 → 스킵';
  END IF;

  -- 5) st_products(product_number) — V2 실측: st_products_product_number_key 이미 존재 → 스킵
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
      JOIN pg_class r ON r.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = r.relnamespace
     WHERE n.nspname = 'public'
       AND r.relname = 'st_products'
       AND c.contype = 'u'
       AND EXISTS (
         SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = r.oid
            AND a.attnum = ANY(c.conkey)
            AND a.attname = 'product_number'
       )
  ) THEN
    RAISE NOTICE '[002] st_products(product_number) UNIQUE 없음 → 생성';
    ALTER TABLE st_products
      ADD CONSTRAINT uq_st_products_number UNIQUE (product_number);
  ELSE
    RAISE NOTICE '[002] st_products(product_number) UNIQUE 이미 존재 → 스킵';
  END IF;
END $$;
