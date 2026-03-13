# Phase 7: 스토리지 마이그레이션 구현 계획

**작성일**: 2026-03-13
**변경 레벨**: L3 (DB + 데이터 마이그레이션)
**위험 등급**: 등급 3 (고위험)
**근거**: plan5.md §10, V2 ref 6개, analysis-techniques.md
**Rev.2**: 빌더+기획자 검증 반영 — Blocker 3건 + GAP 4건 + WRONG 1건 해소

---

## 1. 위험 등급 판단 근거

| 기준 | 해당 여부 | 설명 |
|------|----------|------|
| DB 스키마 변경 | ✅ | `_migration_checkpoint` 테이블 생성 |
| 파일 처리 파이프라인 | ✅ | 5,000장 사진 로컬→Supabase Storage 이동 |
| 배치 작업 (대량 데이터) | ✅ | 건별 체크포인트 + URL 일괄 변환 |
| 외부 API 연동 | ✅ | Supabase Storage API |

→ **등급 3**: 최소 16회 검증 / 가동 6개 에이전트

---

## 2. 핵심 결정 사항 (3건)

| # | 결정 | 선택 | 이유 |
|---|------|------|------|
| D-01 | V2 파일 접근 전략 | **tar → 로컬 실행** | 5,000장 일회성 작업, V3 SDK 직접 활용 |
| D-02 | photo-url.ts vs path.ts | **path.ts 확장** | SSOT, 경로 규칙 충돌 해소, 기존 함수 재활용 |
| D-03 | 업로드 주체 | **프론트엔드 직접** | 이미 route.ts+service 설계 완료, 서버는 메타만 |

---

## 3. 구현 범위

### 3.1 V2→V3 사진 저장 전환

| 항목 | V2 (현재) | V3 (목표) |
|------|----------|----------|
| 파일 저장 | 로컬 `/uploads/photos/` | Supabase Storage `photos` 버킷 |
| DB 경로 | `/uploads/products/P001/front.jpg` | `products/P001/front.jpg` (Storage 상대경로) |
| URL 해석 | 서버가 static 파일 서빙 | `resolveStorageUrl()` → 환경변수 기반 full URL |
| 새 업로드 | 서버 로컬 저장 | 프론트엔드 → Supabase Storage 직접 업로드 → 서버 메타 등록 |

### 3.2 마이그레이션 대상 DB 컬럼 (4개 테이블)

| # | 테이블.컬럼 | 타입 | 변환 |
|---|------------|------|------|
| 1 | `st_products.photos` | jsonb | `/uploads/...` 경로 → Storage 상대경로 |
| 2 | `photos.file_url` | text | `/uploads/...` → Storage 상대경로 |
| 3 | `photos.edited_url` | text | `/uploads/...` → Storage 상대경로 |
| 4 | `photo_uploads.file_url` | text | `/uploads/...` → Storage 상대경로 |
| 5 | `consignment_requests.inspection_image` | text | `/uploads/...` → Storage 상대경로 |

### 3.3 영향 받는 도메인

| 도메인 | V2 ref | DB 컬럼 |
|--------|--------|---------|
| 사진 | v2-ref-photos.md | photos.file_url, edited_url, photo_uploads.file_url |
| 상품 | v2-ref-products-sales.md | st_products.photos (jsonb) |
| 위탁 | v2-ref-consignment.md | consignment_requests.inspection_image |
| 정산/알림 | - | 영향 없음 |

---

## 4. 구현 파일 목록

### Step 1: 인프라 (DDL + 버킷 + Gateway) — 신규 2파일

| # | 파일 | 줄수 | 설명 |
|---|------|------|------|
| 1 | `supabase/migrations/20260313000023_migration_checkpoint.sql` | ~20 | DDL + 버킷 생성 + Storage RLS |
| 2 | `apps/web/lib/gateway/storage.ts` | ~60 | Supabase Storage 래퍼 |

### Step 2: 유틸 확장 — 수정 2파일

| # | 파일 | 수정량 | 설명 |
|---|------|--------|------|
| 3 | `apps/web/lib/utils/path.ts` | +15줄 | `resolveStorageUrl()` 추가 (환경변수 기반 URL 해석) |
| 4 | `apps/web/lib/env.ts` | +4줄 | `PHOTO_STORAGE_MODE`, `PHOTO_BASE_URL` 추가 |

### Step 3: 서비스 수정 — 수정 1파일

| # | 파일 | 수정량 | 설명 |
|---|------|--------|------|
| 5 | `apps/web/lib/services/photo-edit.service.ts` | ~10줄 | stub → storage.upload() 실제 호출 |

### Step 4: 마이그레이션 스크립트 — 신규 1파일

| # | 파일 | 줄수 | 설명 |
|---|------|------|------|
| 6 | `scripts/migrate-storage.ts` | ~100 | 멱등 마이그레이션 (5개 소스, 3단계 상태 머신) |

**총 6파일** (신규 3 + 수정 3)

---

## 5. 핵심 설계

### 5.1 DDL + 버킷 생성

```sql
-- _migration_checkpoint (임시 — 마이그레이션 완료 후 DROP 가능, tokyo-ddl 미포함)
CREATE TABLE IF NOT EXISTS _migration_checkpoint (
  local_path text PRIMARY KEY,  -- 전체 경로 (PK충돌 방지)
  source_table text NOT NULL,   -- 'st_products' | 'photos' | 'photo_uploads' | 'consignment_requests'
  source_id text NOT NULL,
  bucket text NOT NULL DEFAULT 'photos',
  storage_path text,            -- Storage 상대경로
  status text CHECK (status IN ('pending','uploaded','url_updated')) DEFAULT 'pending',
  supabase_url text,
  error_message text,
  updated_at timestamptz DEFAULT now()
);

-- Supabase Storage 버킷 생성
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: 인증된 사용자만 업로드, 공개 읽기
CREATE POLICY "photos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');
CREATE POLICY "photos_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'photos' AND auth.role() = 'authenticated');
```

### 5.2 storage.ts (Gateway)

```typescript
import { createAdminClient } from '../supabase/admin'

export async function upload(bucket: string, path: string, file: Buffer): Promise<string> {
  const client = createAdminClient()
  const { error } = await client.storage.from(bucket).upload(path, file, { upsert: true })
  if (error) throw new Error(`Storage 업로드 실패: ${error.message}`)
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

export function getPublicUrl(bucket: string, path: string): string {
  return createAdminClient().storage.from(bucket).getPublicUrl(path).data.publicUrl
}

export async function remove(bucket: string, paths: string[]): Promise<void> {
  const { error } = await createAdminClient().storage.from(bucket).remove(paths)
  if (error) throw new Error(`Storage 삭제 실패: ${error.message}`)
}
```

### 5.3 path.ts 확장 (D-02 결정)

```typescript
// 기존 함수 유지 + 아래 추가

const PHOTO_MODE = process.env.NEXT_PUBLIC_PHOTO_STORAGE_MODE ?? 'legacy'
const PHOTO_BASE = process.env.NEXT_PUBLIC_PHOTO_BASE_URL ?? ''

/** Storage 상대경로 → 전체 URL 해석 */
export function resolveStorageUrl(storagePath: string): string {
  if (PHOTO_MODE === 'supabase') return `${PHOTO_BASE}/${storagePath}`
  return `/uploads/${storagePath}`
}
```

사용 예:
```typescript
resolveStorageUrl(getProductPhotoPath('P001', 'front.jpg'))
// supabase: 'https://xxx.supabase.co/storage/v1/object/public/photos/products/P001/front.jpg'
// legacy:   '/uploads/products/P001/front.jpg'
```

### 5.4 env.ts 확장

```typescript
// Storage — 선택: 미설정 시 legacy 모드
export const PHOTO_STORAGE_MODE = getOptionalEnvVar('NEXT_PUBLIC_PHOTO_STORAGE_MODE') ?? 'legacy'
export const PHOTO_BASE_URL = getOptionalEnvVar('NEXT_PUBLIC_PHOTO_BASE_URL') ?? ''
```

### 5.5 photo-edit.service.ts 수정

```typescript
// Before (stub):
const editedUrl = `${photo.fileUrl}?edited=true`

// After:
import { upload } from '../gateway/storage'
import { getProductPhotoPath } from '../utils/path'
// ... PhotoRoom 배경 제거 후 Buffer 획득
const storagePath = getProductPhotoPath(productId, `${photoId}_edited.jpg`)
const editedUrl = await upload('photos', storagePath, editedBuffer)
```

### 5.6 migrate-storage.ts

**사전 준비**: V2 서버에서 `tar -czf uploads.tar.gz /uploads/` → 로컬로 전송 → 압축 해제

**실행 환경**: 로컬 개발 머신 (V3 코드베이스 내 `scripts/` 에서 `npx tsx scripts/migrate-storage.ts`)

**환경변수**: `V2_UPLOADS_PATH=/path/to/extracted/uploads` (마운트된 V2 파일 경로)

**5개 입력 소스**:
```sql
-- 1. st_products.photos (jsonb 내 경로 추출)
SELECT id, jsonb_array_elements_text(photos) AS path
  FROM st_products WHERE photos::text LIKE '%/uploads/%'

-- 2. photos.file_url
SELECT id, file_url FROM photos WHERE file_url LIKE '/uploads/%'

-- 3. photos.edited_url
SELECT id, edited_url FROM photos WHERE edited_url LIKE '/uploads/%'

-- 4. photo_uploads.file_url
SELECT id, file_url FROM photo_uploads WHERE file_url LIKE '/uploads/%'

-- 5. consignment_requests.inspection_image
SELECT id, inspection_image FROM consignment_requests WHERE inspection_image LIKE '/uploads/%'
```

**3단계 상태 머신**:
```
pending → uploaded → url_updated
```

**URL 업데이트 전략**: DB에 **Storage 상대경로**를 저장 (전체 URL 아님)
```sql
-- photos.file_url 예:
-- Before: '/uploads/products/P001/front.jpg'
-- After:  'products/P001/front.jpg'
-- 런타임에 resolveStorageUrl()이 전체 URL로 변환
```

**jsonb 안전 처리**: `st_products.photos`는 `jsonb_set` 대신 배열 전체 재구성
```typescript
// 안전한 jsonb 업데이트: 텍스트 치환 대신 배열 재구성
const oldPaths: string[] = JSON.parse(product.photos)
const newPaths = oldPaths.map(p => p.replace('/uploads/', ''))
await db.update('st_products', { photos: JSON.stringify(newPaths) }, { id: product.id })
```

---

## 6. 환경변수

| 변수 | 용도 | 기본값 | env.ts |
|------|------|--------|--------|
| `NEXT_PUBLIC_PHOTO_STORAGE_MODE` | `legacy` / `supabase` | `legacy` | getOptionalEnvVar |
| `NEXT_PUBLIC_PHOTO_BASE_URL` | Supabase Storage public URL | `''` | getOptionalEnvVar |
| `V2_UPLOADS_PATH` | 마이그레이션 스크립트 전용 | - | 스크립트 내부 |

---

## 7. 구현 순서

```
Step 1: DDL + 버킷 + Gateway
  → _migration_checkpoint DDL + storage.buckets INSERT + RLS
  → lib/gateway/storage.ts

Step 2: 유틸 확장
  → path.ts에 resolveStorageUrl() 추가
  → env.ts에 PHOTO_STORAGE_MODE, PHOTO_BASE_URL 추가

Step 3: 서비스 수정
  → photo-edit.service.ts (stub → storage.upload())

Step 4: 마이그레이션 스크립트
  → scripts/migrate-storage.ts (5소스, 3단계 상태 머신)

Step 5: 검증 (등급 3, 16회)

Step 6: 커밋
```

---

## 8. 검증 계획 (등급 3: 16회)

### Phase A: 사전 분석 (병렬)

| # | 에이전트 | 기법 | 대상 |
|---|----------|------|------|
| 1 | 기획자 | 딥시뮬레이션 | 정상: 5소스 수집 → 업로드 → URL 업데이트 → 환경변수 전환 |
| 2 | 기획자 | 딥시뮬레이션 | 실패: 네트워크 중단, 파일 누락, 버킷 쿼터, 동시 실행 |
| 3 | 기획자 | 유저 워크스루 | 관리자: tar 전송 → 스크립트 실행 → 결과 확인 |
| 4 | 기획자 | 유저 워크스루 | 전환 후: 사진 표시 + 새 업로드 + 편집 파이프라인 |
| 5 | 디렉터 | 아키텍트 리뷰 | 레이어: gateway=L0, path.ts=L1, service 수정=L1 |
| 6 | 디렉터 | 아키텍트 리뷰 | SSOT: path.ts 단일 경로 규칙 + resolveStorageUrl 일관성 |

### Phase B: 구현 후 검증 (병렬)

| # | 에이전트 | 기법 | 대상 |
|---|----------|------|------|
| 7 | 빌더 | 엣지케이스 | 입력: 0바이트, 100MB, 한글 파일명, 특수문자, 공백 |
| 8 | 빌더 | 엣지케이스 | 시스템: jsonb 빈 배열, null edited_url, 이미 Storage URL인 행 |
| 9 | 빌더 | 디펜던시 | 직접: photos.repo, photo-uploads.repo, consignments.repo |
| 10 | 빌더 | 디펜던시 | 연쇄: resolveStorageUrl 호출처 전수, st_products.photos 참조 쿼리 |
| 11 | 테스터 | 레드팀 | 버킷 RLS, URL 경로 조작, ../traversal |
| 12 | 테스터 | 레드팀 | 스크립트 SQL 인젝션, 파일명 shell escape |
| 13 | 테스터 | 벤치마크 | 5,000장 예상 시간 + Supabase Storage 동시 업로드 한도 |
| 14 | 테스터 | 벤치마크 | Storage 요금 추정 + 대역폭 제한 |

### Phase C: 종합 판정 (순차)

| # | 에이전트 | 기법 | 대상 |
|---|----------|------|------|
| 15 | 리뷰어 | 딥리서치 | Phase A+B 미해결 이슈 |
| 16 | 디렉터 | 최종 승인 | 전체 결과 기반 |

---

## 9. 롤백 계획

1. `NEXT_PUBLIC_PHOTO_STORAGE_MODE=legacy` → 즉시 V2 경로 복귀
2. DB에 Storage 상대경로가 저장되므로, `resolveStorageUrl()`이 `/uploads/` 접두사 붙여서 V2 호환
3. `_migration_checkpoint`로 진행 상태 추적

### 전환 검증 시나리오

```
1. PHOTO_STORAGE_MODE=supabase 설정
2. 마이그레이션된 사진 URL 정상 표시 (5개 테이블 전체)
3. 새 사진 업로드 → Storage에 저장 + 메타 등록
4. photo-edit 파이프라인 → 편집 결과 Storage 저장
5. legacy 모드 롤백 → /uploads/ 경로 404 없이 작동
```

---

## 10. 검증 반영 이력

### Rev.1 (리뷰어)
| 이슈 | 해결 |
|------|------|
| 위탁 검수 이미지 누락 | consignment_requests.inspection_image 추가 |
| 입력 데이터 소스 불명확 | 5개 SQL 소스 명시 |
| photo-edit.service.ts 수정 누락 | 수정 파일 목록에 추가 |
| photos 테이블 컬럼 누락 | file_url + edited_url 추가 |
| 전환 검증 시나리오 없음 | §9에 5단계 추가 |

### Rev.2 (빌더 + 기획자)
| 이슈 | 해결 |
|------|------|
| 🔴 V2 파일 접근 전략 미확정 | D-01: tar → 로컬 실행, V2_UPLOADS_PATH 환경변수 |
| 🔴 getPhotoUrl()과 DB 불일치 | D-02: photo-url.ts 폐기 → path.ts에 resolveStorageUrl() |
| 🔴 업로드 주체 미확정 | D-03: 프론트엔드 직접 (현재 설계 유지) |
| env.ts 수정 누락 | §4에 env.ts 추가 (2변수) |
| 버킷 생성 방법 미명시 | DDL에 storage.buckets INSERT + RLS 추가 |
| photo_uploads 테이블 누락 | 5번째 소스로 추가 |
| _migration_checkpoint PK 충돌 | PK를 file_name → local_path(전체경로)로 변경 |
| tokyo-ddl 동기화 미명시 | 임시 테이블 → tokyo-ddl 미포함 명시 |
| jsonb 텍스트 치환 무결성 | 배열 재구성 방식으로 변경 |
| path.ts vs photo-url.ts 경로 충돌 | photo-url.ts 폐기, path.ts SSOT |
| 스크립트 실행 환경 미정의 | 로컬 개발 머신, npx tsx 명시 |
