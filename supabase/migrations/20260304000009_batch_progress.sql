-- 20260304000009_batch_progress.sql
-- WHY: logBatch(result) 호출이 §7.2에 있으나 테이블 DDL이 없었음 (aud1-1 GAP-09, R4-04)
--      배치 분류 작업의 진행 상태를 추적하고 실패 항목 재시도를 위한 테이블
-- HOW: _batch_progress 테이블 생성 (batch_id UNIQUE로 중복 기록 방지)
--      failed_ids: 실패한 product ID 목록 → 재시도 시 사용
-- WHERE: plan5.md §3.1.7
-- APPLY: db push
--
-- ▸ V2 실측 반영 (2026-03-04)
--   - _batch_progress 테이블 없음 → 신규 생성 필요 확인
--   - CREATE TABLE IF NOT EXISTS로 멱등성 보장 (재실행 안전)
--   - CHECK 제약조건은 테이블 생성 시 함께 생성되므로 별도 멱등 처리 불필요

CREATE TABLE IF NOT EXISTS _batch_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id text NOT NULL UNIQUE,
  total int NOT NULL,
  completed int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  failed_ids jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (status IN ('running','completed','partial','failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- batch_id UNIQUE: 동일 배치 중복 기록 방지
-- failed_ids: 실패한 product ID 목록 → 재시도 시 사용
