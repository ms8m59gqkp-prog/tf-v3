# Phase 7 Tasks

**Rev.3** — 과감없이 검증 반영 (7파일: 신규 3 + 수정 4)

## Step 1: 인프라 (DDL + 버킷 + Gateway) — 신규 2파일 ✅
- [x] `supabase/migrations/20260313000023_migration_checkpoint.sql` 작성
  - `_migration_checkpoint` 테이블 (복합 PK: local_path, source_table, source_id)
  - `storage.buckets` INSERT (photos 버킷, public=true)
  - Storage RLS 정책 2개 (공개 읽기 + 인증 쓰기), DROP IF EXISTS 멱등성
- [x] `apps/web/lib/gateway/storage.ts` 작성
  - `upload(bucket, path, file)` → publicUrl 반환 + sanitizePath (URL 인코딩 우회 방어)
  - `getPublicUrl(bucket, path)` → publicUrl 반환
  - `remove(bucket, paths)` → void
  - 0바이트 가드 + 50MB 제한

## Step 2: 유틸 확장 — 수정 2파일 ✅
- [x] `apps/web/lib/utils/path.ts` 수정
  - `resolveStorageUrl(storagePath)` 추가 (encodeURIComponent 포함)
  - `getEditedPhotoPath(photoId)` 추가 (SSOT)
- [x] `apps/web/lib/env.ts` 수정
  - `PHOTO_STORAGE_MODE` = getOptionalEnvVar() ?? 'legacy'
  - `PHOTO_BASE_URL` = getOptionalEnvVar() ?? ''

## Step 3: 서비스 수정 — 수정 2파일 ✅
- [x] `apps/web/lib/services/photo-edit.service.ts` 수정
  - stub → storage.upload() 실제 호출
  - fetchImageBuffer() 경로 탐색 방어
  - getEditedPhotoPath() SSOT 사용
- [x] `apps/web/lib/services/naver-export.service.ts` 수정
  - getMainImage()에 resolveStorageUrl() 적용
  - `as` 타입 캐스트 → 타입 가드로 교체

## Step 4: 마이그레이션 스크립트 — 신규 1파일 ✅
- [x] `scripts/migrate-storage.ts` 작성 (~300줄)
  - 5개 입력 소스 (st_products.photos, photos.file_url/edited_url, photo_uploads, consignment_requests)
  - 5상태 머신: pending → uploaded → url_updated + file_missing + error
  - 쿼터 초과 시 조기 중단, 100건 단위 진행률, 최종 요약
  - LEGACY PATH NOTICE 명확화

## Step 5: 검증 (등급 3, 16회) ✅

### Phase A: 사전 분석 (병렬, 6회)
- [x] 기획자: 딥시뮬레이션 × 2 (정상 5소스/실패 시나리오) → 9 FAIL 발견, 모두 수정
- [x] 기획자: 유저 워크스루 × 2 (tar→실행/전환검증) → PASS
- [x] 디렉터: 아키텍트 리뷰 × 2 (레이어/SSOT 일관성) → PASS

### Phase B: 구현 후 검증 (병렬, 8회)
- [x] 빌더: 엣지케이스 × 2 (입력 극단/시스템 극단) → 0바이트/50MB 가드 추가
- [x] 빌더: 디펜던시 × 2 (직접/연쇄) → naver-export resolveStorageUrl 추가
- [x] 테스터: 레드팀 × 2 (RLS+경로조작/SQL인젝션) → sanitizePath, fetchImageBuffer 강화
- [x] 테스터: 벤치마크 × 2 (시간/요금) → 순차 ~33분 허용 (일회성)

### Phase C: 종합 판정 (순차, 2회)
- [x] 리뷰어: 딥리서치 → 2 Blocker + 3 Warning 발견, 모두 수정
- [x] 디렉터: 최종 승인

## Step 6: 커밋
- [ ] TypeScript 빌드 체크
- [ ] git add + commit
