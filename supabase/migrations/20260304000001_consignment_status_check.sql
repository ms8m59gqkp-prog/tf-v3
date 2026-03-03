-- 20260304000001_consignment_status_check.sql
-- WHY: V2 DB CHECK 5값, TypeScript 7값 → 불일치 (에이전트1 발견)
-- HOW: DROP + ADD로 CHECK 재생성 (멱등성: DO 블록 내 존재 여부 확인)
-- WHERE: plan5.md §3.1.1
-- APPLY: db push
--
-- [V2 실측 반영] 2026-03-04
-- consignment_requests_status_check가 이미 7값으로 적용되어 있음.
-- 멱등성 처리: 기존 제약이 7값이면 스킵, 아니면 DROP + ADD.

DO $$
DECLARE
  _check_def text;
BEGIN
  -- 현재 CHECK 제약 정의를 조회
  SELECT pg_get_constraintdef(c.oid)
    INTO _check_def
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
   WHERE r.relname = 'consignment_requests'
     AND c.conname = 'consignment_requests_status_check'
     AND n.nspname = 'public';

  IF _check_def IS NULL THEN
    -- 제약이 아예 없으면 새로 생성
    RAISE NOTICE '[001] consignment_requests_status_check 없음 → 생성';
    ALTER TABLE consignment_requests
      ADD CONSTRAINT consignment_requests_status_check
      CHECK (status IN (
        'pending','received','inspecting','approved',
        'on_hold','rejected','completed'
      ));
  ELSIF _check_def ILIKE '%on_hold%'
    AND _check_def ILIKE '%inspecting%'
    AND _check_def ILIKE '%completed%' THEN
    -- 이미 7값 포함 → 스킵
    RAISE NOTICE '[001] consignment_requests_status_check 이미 7값 적용 → 스킵';
  ELSE
    -- 5값 등 구버전 → DROP 후 재생성
    RAISE NOTICE '[001] consignment_requests_status_check 구버전 → DROP + 재생성';
    ALTER TABLE consignment_requests
      DROP CONSTRAINT consignment_requests_status_check;
    ALTER TABLE consignment_requests
      ADD CONSTRAINT consignment_requests_status_check
      CHECK (status IN (
        'pending','received','inspecting','approved',
        'on_hold','rejected','completed'
      ));
  END IF;
END $$;
