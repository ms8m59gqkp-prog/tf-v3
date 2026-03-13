# Phase 7 Context

**최종 업데이트**: 2026-03-13 (Rev.2 — 빌더+기획자 검증 반영, D-01/D-02/D-03 결정)

## 핵심 파일 경로

### 생성 대상 (신규 3파일)
| 파일 | 레이어 | 역할 |
|------|--------|------|
| `supabase/migrations/20260313000023_migration_checkpoint.sql` | L3 | DDL + 버킷 생성 + RLS |
| `apps/web/lib/gateway/storage.ts` | L0 | Supabase Storage 래퍼 (upload/getPublicUrl/remove) |
| `scripts/migrate-storage.ts` | - | 멱등 마이그레이션 스크립트 (5소스, 3단계) |

### 수정 대상 (4파일)
| 파일 | 수정 내용 |
|------|----------|
| `apps/web/lib/utils/path.ts` | `resolveStorageUrl()` + `getEditedPhotoPath()` 추가 — D-02 결정 |
| `apps/web/lib/env.ts` | `PHOTO_STORAGE_MODE`, `PHOTO_BASE_URL` 추가 (+4줄) |
| `apps/web/lib/services/photo-edit.service.ts` | stub → storage.upload() 실제 호출, getEditedPhotoPath() SSOT |
| `apps/web/lib/services/naver-export.service.ts` | getMainImage()에 resolveStorageUrl() 적용 + 타입 가드 |

### 마이그레이션 대상 DB 컬럼 (5개)
| # | 테이블.컬럼 | 타입 | 변환 |
|---|------------|------|------|
| 1 | `st_products.photos` | jsonb | `/uploads/...` → Storage 상대경로 (배열 재구성) |
| 2 | `photos.file_url` | text | `/uploads/...` → Storage 상대경로 |
| 3 | `photos.edited_url` | text | `/uploads/...` → Storage 상대경로 |
| 4 | `photo_uploads.file_url` | text | `/uploads/...` → Storage 상대경로 |
| 5 | `consignment_requests.inspection_image` | text | `/uploads/...` → Storage 상대경로 |

### 참조 파일 (읽기 전용)
| 파일 | 참조 이유 |
|------|----------|
| `apps/web/lib/gateway/photoroom.ts` | gateway 패턴 참고 |
| `apps/web/lib/gateway/naver-shopping.ts` | gateway 패턴 참고 |
| `apps/web/lib/supabase/admin.ts` | createAdminClient() — storage.ts에서 사용 |
| `apps/web/lib/db/client.ts` | DB 클라이언트 import |
| `apps/web/lib/env.ts` | getOptionalEnvVar 패턴 |
| `supabase/tokyo-ddl/01_tables.sql` | st_products.photos 컬럼 확인 |

### V2 참조
| 문서 | 핵심 정보 |
|------|----------|
| v2-ref-photos.md | 편집 파이프라인, 로컬 저장 경로, 배치 상수 |
| v2-ref-products-sales.md | st_products.photos 구조 |
| v2-ref-consignment.md | completed 시 사진 경로 + 검수 이미지 |
| v2-ref-orders.md | 검수 이미지 (photos 테이블 경유) |

## 결정 사항 (Rev.2)

| # | 결정 | 선택 | 이유 |
|---|------|------|------|
| D-01 | V2 파일 접근 전략 | tar → 로컬 실행 | 5,000장 일회성, V3 SDK 직접 활용, V2_UPLOADS_PATH 환경변수 |
| D-02 | photo-url.ts vs path.ts | path.ts 확장 | SSOT, `products/` vs `photos/` 경로 충돌 해소 |
| D-03 | 업로드 주체 | 프론트엔드 직접 | route.ts+service 이미 JSON 메타만 수신하는 구조 |
| - | 환경변수 스위칭 | `NEXT_PUBLIC_PHOTO_STORAGE_MODE` | legacy↔supabase 즉시 전환 |
| - | DB 저장 형식 | Storage 상대경로 | `resolveStorageUrl()`이 런타임에 full URL 생성 |
| - | _migration_checkpoint PK | 복합 PK `(local_path, source_table, source_id)` | 동일 경로 다른 테이블 충돌 방지 |
| - | jsonb 업데이트 | 배열 재구성 | 텍스트 치환 대비 무결성 보장 |
| - | tokyo-ddl 동기화 | 미포함 | 임시 테이블, 마이그레이션 완료 후 DROP 가능 |

## 다음 단계

- [ ] Step 1: DDL + 버킷 + Gateway (신규 2파일)
- [ ] Step 2: path.ts + env.ts 확장 (수정 2파일)
- [ ] Step 3: photo-edit.service.ts 수정 (수정 1파일)
- [ ] Step 4: migrate-storage.ts 작성 (신규 1파일)
- [ ] Step 5: 검증 (등급 3, 16회)
- [ ] Step 6: 커밋
