# Preflight 결과 — 2026-03-04

## 00: 중복 탐지 → PASS (0건)
```
[]
```

## 01: 고아 FK → SQL 오류 (컬럼명 불일치 → 수정 필요)
```
column c.consignment_id does not exist
```
**원인**: Preflight SQL이 가정한 컬럼명과 V2 실제 스키마 불일치

## 02: 상태값 감사
```
pending: 8건 (PRESENT)
completed: 3건 (PRESENT)
inspecting: 0 (NOT PRESENT)
on_hold: 0 (NOT PRESENT)
approved: 0 (NOT PRESENT)
rejected: 0 (NOT PRESENT)
received: 0 (NOT PRESENT)
```

## 03: 기존 제약/RLS 현황
- CHECK constraint: **이미 7값 적용** (pending, inspecting, on_hold, approved, rejected, received, completed)
- RLS: consignment_requests 이미 활성화 (admin_all + service_all 정책)

---

## V2 DB 실제 상태 요약

### 테이블: 26개
brand_aliases, brand_price_summary, consignment_requests, excel_uploads, market_prices,
mismatches, naver_settlements, notification_logs, order_items, orders, photo_uploads,
photos, price_estimate_cache, price_references, return_shipments, sales_ledger,
sales_records, search_synonyms, sellers, settlement_audit_log, settlement_items,
settlement_matches, settlement_queue, settlements, sold_items, st_products

### FK 관계: 23개 (실측)

### RLS 활성 테이블: 17/26개
consignment_requests ✅, excel_uploads ✅, market_prices ✅, mismatches ✅,
order_items ✅, orders ✅, photo_uploads ✅, photos ✅, price_estimate_cache ✅,
price_references ✅, sales_ledger ✅, search_synonyms ✅, sellers ✅,
settlement_items ✅, settlements ✅, sold_items ✅, st_products ✅

### USING(true) 위반 정책 (architecture-spec §7 위반)
- orders: "Allow all" (qual=true, with_check=true)
- order_items: "Allow all" (qual=true, with_check=true)
- photo_uploads: "Allow all" (qual=true, with_check=true)
- photos: "Allow all" (qual=true, with_check=true)
- market_prices: "Allow public read" (qual=true)
- price_references: "Allow public read" (qual=true)

### 기존 UNIQUE 제약: 17개
- sellers(phone) ✅ 이미 존재
- sellers(seller_code) ✅ 이미 존재
- st_products(product_number) ✅ 이미 존재
- settlement_queue(match_id) ❌ 없음
- return_shipments(consignment_id) ❌ 없음

### 기존 인덱스: 100+개
- idx_orders_status ✅ 이미 존재
- idx_sales_records_match_status ✅ 이미 존재
- idx_settlement_queue_seller_id ✅ 이미 존재
- idx_consignment_seller ✅ 이미 존재
- idx_sold_items(seller_id, settlement_status) 복합 ❌ 없음

### 기존 RPC: 8개
find_brand, generate_order_number, generate_product_id, generate_product_number,
get_commission_rate, pgp_sym_decrypt_text, pgp_sym_encrypt_text, update_updated_at
→ plan5 RPC 3개(create_settlement_with_items, create_order_with_items, complete_consignment) 없음

### 누락 컬럼/테이블
- sales_records.upload_session_id ❌ 없음
- orders.hold_token ❌ 없음
- _batch_progress 테이블 ❌ 없음
