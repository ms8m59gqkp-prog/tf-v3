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
