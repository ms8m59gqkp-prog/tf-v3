-- 20260304000017_alter_sellers_add_address.sql
-- WHY: 셀러코드 생성 시 이름+전화+주소 기반 고유값 필요. 향후 배송/반품 기능에도 활용.
-- HOW: sellers 테이블에 address TEXT 컬럼 추가 (NULL 허용)
-- WHERE: sellers 테이블
-- APPLY: db push

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS address TEXT;
