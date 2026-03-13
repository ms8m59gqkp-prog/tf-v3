-- Phase 7: Storage 마이그레이션 체크포인트 + 버킷 생성
-- WHY: 로컬 /uploads/ → Supabase Storage 전환 시 멱등 상태 추적
-- 임시 테이블 — 마이그레이션 완료 후 DROP 가능, tokyo-ddl 미포함

CREATE TABLE IF NOT EXISTS _migration_checkpoint (
  local_path text NOT NULL,
  source_table text NOT NULL,
  source_id text NOT NULL,
  PRIMARY KEY (local_path, source_table, source_id),
  bucket text NOT NULL DEFAULT 'photos',
  storage_path text,
  status text CHECK (status IN ('pending','uploaded','url_updated','file_missing','error')) DEFAULT 'pending',
  supabase_url text,
  error_message text,
  updated_at timestamptz DEFAULT now()
);

-- RLS 활성화: service_role만 접근 가능 (정책 없음 = anon/authenticated 차단)
ALTER TABLE _migration_checkpoint ENABLE ROW LEVEL SECURITY;

-- Supabase Storage 버킷 생성 (공개 읽기)
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: 공개 읽기
DROP POLICY IF EXISTS "photos_public_read" ON storage.objects;
CREATE POLICY "photos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');

-- Storage RLS: 인증된 사용자만 업로드
DROP POLICY IF EXISTS "photos_auth_insert" ON storage.objects;
CREATE POLICY "photos_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'photos' AND auth.role() = 'authenticated');
