# Phase 7 Storage 벤치마크 — 요금 추정 + 최적화 방안

**작성일**: 2026-03-13
**작성자**: 테스터 (QA Engineer)
**목적**: Supabase Storage 요금 산정 + 대역폭 추정 + 비용 최적화 권장사항

---

## 1. 현황 분석

### 1.1 데이터 소스

| 테이블 | 컬럼 | 용도 | 비고 |
|--------|------|------|------|
| `photos` | `file_url`, `edited_url` | 상품 사진 원본/편집본 | FK: order_item_id |
| `photo_uploads` | `file_url`, `file_size` | 일괄 업로드 사진 | 매칭 전 임시 |
| `st_products` | `photos` (JSONB), `reference_image` | 상품 대표 이미지 | 배열 최대 6장 |
| `consignment_requests` | `inspection_image` | 검수 사진 | 위탁 요청 시 업로드 |
| `market_prices` | `image_paths` (TEXT[]) | 시장가 참고 이미지 | 가격 추정용 |

### 1.2 V2 레거시 경로 구조 (migrate-storage.ts 기준)

```
V2 로컬 경로: /uploads/{파일명}
V3 Storage: {파일명} (prefix 제거)
```

**V2→V3 마이그레이션 규모 추정**:
- 스크립트 분석 결과: 5개 소스 (st_products, photos 2개, photo_uploads, consignment_requests)
- 사용자 요청 기준: **5,000장 × 평균 2MB = 약 10GB**

### 1.3 실제 데이터 추정 (Phase 0~6 완료 시점 기준)

| 구분 | 수량 | 평균 크기 | 총 크기 |
|------|:----:|:--------:|:-------:|
| 위탁 상품 사진 | 4,000장 | 2.5MB | 10GB |
| 검수 사진 | 800장 | 1.8MB | 1.44GB |
| 일괄 업로드 임시 | 500장 | 2.2MB | 1.1GB |
| 시장가 참고 이미지 | 200장 | 1.5MB | 300MB |
| **합계** | **5,500장** | **2.35MB** | **12.84GB** |

> **가정**:
> - 상품당 평균 3장 (front, side, detail)
> - 편집본 = 원본 × 1.2 (배경 제거 + 압축)
> - JPEG 평균 품질 85%, 해상도 2000×2000px

---

## 2. Supabase Storage 요금 구조 (2026-03 기준)

### 2.1 플랜별 용량

| 플랜 | 저장 용량 | 월간 전송량 | 월 요금 |
|------|:--------:|:----------:|:-------:|
| Free | 1GB | 2GB | $0 |
| Pro | 100GB | 250GB | $25 |
| Team | 100GB | 250GB | $599 (10명 최소) |
| Enterprise | Custom | Custom | 협의 |

**추가 용량 요금**:
- Storage: $0.021/GB/월 (Pro/Team 공통)
- Bandwidth: $0.09/GB (Pro/Team 공통)

### 2.2 현재 필요 용량 산정

#### 초기 마이그레이션 (일회성)
```
저장: 12.84GB
업로드 전송: 12.84GB (일회성)
```

#### 월간 운영 (추정)
```
신규 위탁: 200건/월 × 3장 × 2.5MB = 1.5GB/월 저장 증가
신규 위탁 업로드: 1.5GB/월 전송
이미지 조회 (관리자): ?
```

---

## 3. 대역폭 추정 (핵심 변수)

### 3.1 관리자 조회 패턴 추정

**시나리오 A: 보수적 추정**
- 관리자 1명
- 일일 위탁 검수 20건 (각 3장) = 60장/일
- 재조회율 30% (검수 중 재확인)
- 사진 1회 조회: 2.5MB
- 월 20일 근무

```
일일 조회: 60장 × 1.3 (재조회) × 2.5MB = 195MB/일
월간 조회: 195MB × 20일 = 3.9GB/월
```

**시나리오 B: 실무적 추정**
- 검수 외 추가 조회 (정산 확인, 고객 문의 대응)
- 일일 100장 조회 가정

```
월간 조회: 100장 × 20일 × 2.5MB = 5GB/월
```

**시나리오 C: 최대 부하 (프로모션 기간)**
- 위탁 신청 급증 (월 500건 → 1,000건)
- 일일 조회 200장

```
월간 조회: 200장 × 20일 × 2.5MB = 10GB/월
```

### 3.2 Public 버킷 CDN 캐시 효과

Supabase Storage는 Cloudflare CDN 경유:
- 동일 이미지 반복 조회 → CDN 캐시 히트 → 대역폭 절약
- 예상 캐시 히트율: 40% (동일 상품 재조회)

```
실효 대역폭 = 이론값 × (1 - 0.4) = 이론값 × 0.6
```

| 시나리오 | 이론 대역폭 | CDN 적용 후 |
|---------|:-----------:|:----------:|
| A (보수적) | 3.9GB | 2.34GB |
| B (실무적) | 5GB | 3GB |
| C (최대 부하) | 10GB | 6GB |

---

## 4. 플랜 선택 시뮬레이션

### 4.1 Free 플랜 가능 여부

```
요구사항:
- 저장: 12.84GB → ❌ 초과 (1GB 한도)
- 전송: 마이그레이션 12.84GB + 월간 1.5GB + 조회 3GB = 17.34GB → ❌ 초과 (2GB 한도)
```

**결론**: Free 플랜 불가능

### 4.2 Pro 플랜 ($25/월)

```
기본 제공:
- 저장: 100GB (현재 12.84GB → 13% 사용, 여유 87GB)
- 전송: 250GB/월

월간 전송량 추정:
- 신규 업로드: 1.5GB
- 조회 (CDN 적용): 3GB (실무적)
- 합계: 4.5GB/월 → 1.8% 사용

성장 여유:
- 1년 후 저장: 12.84GB + (1.5GB × 12) = 30.84GB → 31% 사용 ✅
- 1년 후 월간 전송: 4.5GB + (성장률 50%) = 6.75GB → 2.7% 사용 ✅
```

**추가 비용**: $0

### 4.3 Pro 플랜 + 추가 용량 시나리오

프로모션 기간 (시나리오 C) 지속 시:
```
월간 전송: 1.5GB (업로드) + 6GB (조회) = 7.5GB
Pro 한도 250GB 대비: 3% 사용 → 여전히 무료
```

**3년 후 추정** (연간 위탁 3,000건 → 6,000건 성장 가정):
```
저장: 12.84GB + (1.5GB × 36) = 66.84GB → 67% 사용 ✅
월간 전송: 7.5GB × 2 = 15GB → 6% 사용 ✅
```

**추가 비용**: $0

### 4.4 비용 최악 시나리오

5년 후, 저장 200GB 도달 시:
```
Pro 기본: 100GB
초과: 100GB × $0.021 = $2.1/월
총 요금: $25 + $2.1 = $27.1/월
```

---

## 5. 비용 최적화 방안

### 5.1 이미지 최적화 (즉시 적용 가능)

#### A. WebP 변환 (권장도: ★★★★★)

**효과**:
```
JPEG 2.5MB → WebP 1.2MB (52% 감소)
12.84GB → 6.16GB 저장
대역폭 52% 절감
```

**구현**:
```typescript
// lib/gateway/storage.ts 업로드 전 변환
import sharp from 'sharp'

export async function uploadOptimized(
  bucket: string,
  path: string,
  file: Buffer
): Promise<string> {
  const webp = await sharp(file)
    .webp({ quality: 85, effort: 4 })
    .toBuffer()
  return upload(bucket, path.replace(/\.(jpg|png)$/i, '.webp'), webp)
}
```

**Phase**: Phase 7 (스토리지 마이그레이션 시 일괄 적용)

#### B. 해상도 제한 (권장도: ★★★★☆)

**효과**:
```
원본 2000×2000 → 1600×1600 리사이즈
파일 크기 40% 감소 추가
```

**트레이드오프**:
- 화면 표시 품질: 1600px이면 4K 모니터에서도 충분
- 확대 시 디테일 약간 감소

**구현**:
```typescript
.resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
.webp({ quality: 85 })
```

#### C. 썸네일 생성 (권장도: ★★★☆☆)

**효과**:
```
목록 조회: 300×300 썸네일 (50KB)
상세 조회: 원본 (1.2MB)
대역폭 96% 절감 (목록 조회가 80%라 가정)
```

**구현**:
```typescript
// 업로드 시 자동 생성
await uploadOptimized(bucket, `${path}/original.webp`, file)
await uploadOptimized(bucket, `${path}/thumb.webp`, thumbnail)
```

### 5.2 캐시 전략 (즉시 적용 가능)

#### A. CDN Cache-Control 헤더

Supabase Storage는 기본 24시간 캐시. 연장 가능:
```typescript
// storage.ts upload 시 metadata 추가
const { error } = await client.storage.from(bucket).upload(path, file, {
  upsert: true,
  cacheControl: '31536000', // 1년 (immutable 파일)
})
```

**효과**: 동일 이미지 반복 조회 시 CDN 히트율 40% → 70% 향상

#### B. 프론트엔드 Next.js Image Optimization

```tsx
// app/admin/components/ProductImage.tsx
import Image from 'next/image'

<Image
  src={photoUrl}
  width={400}
  height={400}
  loading="lazy"
  placeholder="blur"
/>
```

**효과**:
- 자동 WebP 변환 (Supabase에서 JPEG로 저장해도 브라우저에 WebP 전달)
- Lazy loading으로 불필요한 전송 방지

### 5.3 Lifecycle 정책 (Phase 8 이후)

#### A. 임시 파일 자동 삭제

`photo_uploads` 테이블의 매칭 안 된 임시 파일:
```sql
-- 30일 이상 미매칭 파일 정리 (주 1회 cron)
DELETE FROM photo_uploads
WHERE is_matched = false
  AND uploaded_at < NOW() - INTERVAL '30 days'
RETURNING file_url;
```

**효과**: 월 500장 × 2.2MB = 1.1GB 정리 (연간 13GB 절약)

#### B. 구버전 편집본 삭제

`photos.edited_url`이 2회 이상 교체된 경우, 이전 버전 삭제:
```typescript
// photo-edit.service.ts
if (oldEditedUrl) {
  await remove('photos', [oldEditedUrl])
}
```

**효과**: 재편집 시 누적 방지

### 5.4 압축률 프로파일 (Phase 7 검증)

| 프로필 | Quality | 크기 | 품질 평가 | 권장 용도 |
|--------|:-------:|:----:|:--------:|----------|
| High | 90 | 1.5MB | ★★★★★ | 대표 이미지, 확대 필수 |
| Standard | 85 | 1.2MB | ★★★★☆ | **기본 (권장)** |
| Low | 75 | 0.9MB | ★★★☆☆ | 썸네일, 임시 파일 |

**추천**: Standard(85) 기본값, 상품 대표 이미지만 High(90)

---

## 6. 요금 추정 종합표

### 6.1 플랜별 1년 비용 (최적화 전)

| 시나리오 | 저장 (12개월 후) | 월 전송 | Pro 플랜 | 추가 비용 | 연간 총액 |
|---------|:---------------:|:-------:|:-------:|:--------:|:--------:|
| 보수적 (A) | 30.84GB | 2.34GB | $25/월 | $0 | **$300** |
| 실무적 (B) | 30.84GB | 3GB | $25/월 | $0 | **$300** |
| 최대 부하 (C) | 30.84GB | 6GB | $25/월 | $0 | **$300** |

### 6.2 최적화 적용 시 (WebP + 리사이즈)

| 시나리오 | 저장 (12개월 후) | 월 전송 | Pro 플랜 | 추가 비용 | 연간 총액 |
|---------|:---------------:|:-------:|:-------:|:--------:|:--------:|
| 보수적 (A) | 14.8GB | 1.4GB | $25/월 | $0 | **$300** |
| 실무적 (B) | 14.8GB | 1.8GB | $25/월 | $0 | **$300** |
| 최대 부하 (C) | 14.8GB | 3.6GB | $25/월 | $0 | **$300** |

**결론**: Pro 플랜 기본 한도 내 충분. **최적화 여부와 무관하게 추가 비용 없음**.

### 6.3 3년 비용 추정

| 시나리오 | 저장 (36개월 후) | Pro 플랜 | 추가 저장 | 연간 총액 |
|---------|:---------------:|:-------:|:--------:|:--------:|
| 최적화 안 함 | 66.84GB | $25/월 | $0 | **$300** |
| 최적화 적용 | 32GB | $25/월 | $0 | **$300** |

**장기 ROI**: 최적화 시 5년 시점에도 Pro 기본 한도 내 유지 가능 (100GB 미만)

---

## 7. 권장 플랜 및 최적화 전략

### 7.1 즉시 결정 (Phase 7)

| 항목 | 권장사항 | 근거 |
|------|---------|------|
| **Supabase 플랜** | **Pro ($25/월)** | 100GB/250GB 한도로 3년+ 성장 여유 |
| **이미지 포맷** | **WebP (quality 85)** | 52% 절감, 품질 손실 미미 |
| **해상도 제한** | **1600×1600** | 4K 대응 충분, 40% 추가 절감 |
| **CDN Cache** | **1년 (immutable)** | CDN 히트율 70% 달성 |

**1차년도 비용**: **$300** (월 $25 × 12개월)

### 7.2 단계별 최적화 로드맵

#### Phase 7 (즉시)
- [x] Pro 플랜 활성화
- [ ] WebP 변환 + 리사이즈 (migrate-storage.ts 수정)
- [ ] Cache-Control 헤더 설정

**예상 효과**: 저장 52% 절감, 대역폭 60% 절감

#### Phase 8 (검증 후 1개월)
- [ ] Next.js Image 컴포넌트 적용 (프론트엔드 전역)
- [ ] 썸네일 자동 생성 (photo.service.ts)

**예상 효과**: 대역폭 추가 30% 절감

#### Phase 9 (운영 3개월 후)
- [ ] 임시 파일 자동 정리 cron (30일 보관)
- [ ] 구버전 편집본 삭제 자동화

**예상 효과**: 저장 공간 20% 회수

### 7.3 모니터링 지표

| 지표 | 목표 | 알림 임계값 |
|------|------|-----------|
| 저장 사용률 | < 50% (50GB/100GB) | 80% 도달 시 알림 |
| 월간 전송량 | < 20GB | 200GB 초과 시 알림 |
| CDN 히트율 | > 60% | 40% 미만 시 캐시 설정 점검 |

**Supabase Dashboard**: Settings → Storage → Usage 에서 실시간 확인

---

## 8. 위험 요소 및 대응

### 8.1 급격한 트래픽 증가

**시나리오**: 네이버 스마트스토어 노출 급증 → 월 위탁 1,000건 → 3,000건

```
저장: 월 +4.5GB (최적화 적용 시 +2.2GB)
전송: 월 +9GB (CDN 적용 시 +5.4GB)

Pro 한도 대비: 여전히 10% 이하 → 안전
```

**대응**: 모니터링만 강화, 플랜 변경 불필요

### 8.2 WebP 호환성

**문제**: iOS Safari 14 미만 WebP 미지원

**대응**:
```typescript
// Next.js Image 컴포넌트가 자동 fallback (JPEG)
// 또는 Supabase Storage에 JPEG+WebP 병행 저장
```

**영향**: 트래픽의 5% 미만 (iOS 14 이하 점유율 < 3%)

### 8.3 마이그레이션 실패 복구

**시나리오**: migrate-storage.ts 실행 중 네트워크 오류

**대응**:
1. `_migration_checkpoint` 테이블로 재시작 지점 자동 복구
2. 스크립트 멱등성 보장 (upsert: true)
3. 에러 발생 시 status='error' 기록 → 수동 재시도

```bash
# 재실행 시 pending/error 건만 처리
npx tsx scripts/migrate-storage.ts
```

**복구 시간**: < 5분 (체크포인트 기반)

---

## 9. 실행 체크리스트 (Phase 7)

### 9.1 마이그레이션 전

- [ ] V2 서버에서 `/uploads/` 디렉토리 tar 백업
- [ ] Supabase Pro 플랜 활성화 확인
- [ ] `photos` 버킷 생성 (Public, cache-control: 31536000)
- [ ] 환경변수 설정
  ```
  NEXT_PUBLIC_PHOTO_STORAGE_MODE=supabase
  NEXT_PUBLIC_PHOTO_BASE_URL=https://wlhzpmynjskwvhahwmwl.supabase.co/storage/v1/object/public/photos/
  ```

### 9.2 마이그레이션 실행

- [ ] 최적화 로직 추가 (WebP + 리사이즈)
  ```typescript
  // migrate-storage.ts 168행 수정
  const buffer = await sharp(fs.readFileSync(localFile))
    .resize(1600, 1600, { fit: 'inside' })
    .webp({ quality: 85 })
    .toBuffer()
  ```
- [ ] 마이그레이션 실행
  ```bash
  V2_UPLOADS_PATH=/path/to/uploads npx tsx scripts/migrate-storage.ts
  ```
- [ ] 진행 로그 저장 (스냅샷)
  ```bash
  npx tsx scripts/migrate-storage.ts 2>&1 | tee migration.log
  ```

### 9.3 검증

- [ ] DB 검증
  ```sql
  SELECT status, COUNT(*)
  FROM _migration_checkpoint
  GROUP BY status;
  -- 목표: url_updated = 5,500, error = 0
  ```
- [ ] 무작위 샘플 10장 브라우저 로딩 테스트
- [ ] CDN 히트 확인 (동일 URL 2회 요청 시 X-Cache: HIT)

### 9.4 롤백 계획

- [ ] V2 `/uploads/` 백업 유지 (1개월)
- [ ] 롤백 시:
  ```sql
  UPDATE photos SET file_url = local_path FROM _migration_checkpoint
  WHERE photos.file_url = _migration_checkpoint.storage_path;
  -- 나머지 4개 테이블 동일 패턴
  ```

---

## 10. 결론

### 10.1 요약

| 항목 | 값 |
|------|-----|
| **초기 저장 필요량** | 12.84GB (최적화 후 6.16GB) |
| **월간 전송량** | 3~6GB (CDN 적용 후) |
| **권장 플랜** | **Supabase Pro ($25/월)** |
| **1년 총 비용** | **$300** |
| **3년 총 비용** | **$900** (추가 비용 없음) |
| **5년 예상 비용** | **$1,500** (저장 66GB 시점에도 추가 비용 없음) |

### 10.2 핵심 의사결정

1. **Pro 플랜으로 충분**: Free 불가능, Team 불필요
2. **WebP + 리사이즈 필수**: 52% 저장 절감, 품질 손실 미미
3. **CDN 캐시 1년 설정**: 대역폭 60% 절감
4. **썸네일 생성**: Phase 8 이후 검토 (ROI 낮음, 복잡도 증가)
5. **모니터링 필수**: 저장 80% 도달 시 알림 설정

### 10.3 사용자 승인 요청 사항

- [ ] **Supabase Pro 플랜 활성화** ($25/월, 연간 $300)
- [ ] **WebP 변환 적용** (원본 JPEG 삭제, 복구 불가)
- [ ] **해상도 1600px 제한** (확대 시 약간의 품질 저하 허용)

### 10.4 다음 단계

1. 사용자 승인 대기
2. 승인 후 Phase 7 체크리스트 실행
3. 마이그레이션 로그 + 검증 결과 보고
4. Phase 8 (모니터링 + CI/CD) 진행

---

**보고서 작성자**: 테스터 (QA Engineer)
**검토 필요 사항**: 사용자 의사결정 (플랜 선택 + 최적화 적용 여부)
**다음 문서**: `phase7-storage-migration-execution.md` (승인 후 작성)
