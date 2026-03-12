# V2 참조: 사진 도메인 (구현용)

> V3 구현 시 실시간 참조용 — V2 파일 경로, 코드 스니펫, V3 매핑

## V2 파일 인벤토리

### 페이지/컴포넌트
| V2 파일 | 줄 수 | 역할 |
|---------|-------|------|
| `app/admin/photos/page.tsx` | 184 | 3탭: OriginalsTab, ProcessedTab, ProductTab(레거시) |
| `components/ClassifyMatchModal.tsx` | 343 | SSE Claude Vision 분류 + 드래그앤드롭 + 수동 매칭 |
| `components/OriginalsTab.tsx` | - | 원본 사진 갤러리 |
| `components/ProcessedTab.tsx` | - | 처리된 사진 갤러리 |

### 사진 분류 라이브러리
| V2 파일 | 줄 수 | 역할 |
|---------|-------|------|
| `lib/photo-classify/prompt.ts` | 98 | Claude Vision 프롬프트 (4규칙, 9카테고리, 14색상, 7패턴) |
| `lib/photo-classify/claude-api.ts` | 187 | 배치 처리 + 레이트리밋 핸들링 |
| `lib/photo-classify/post-process.ts` | 279 | 4단계 그룹 병합 + 6검증 |
| `lib/photo-classify/constants.ts` | 29 | 배치/리트라이 상수 |
| `lib/photo-classify/types.ts` | 39 | ClassifiedFile, ClassifiedGroup, ValidationError, LoadedImage |

### 이미지 편집
| V2 파일 | 줄 수 | 역할 |
|---------|-------|------|
| `lib/photo-editor.ts` | 191 | EXIF→배경제거→프린지→캔버스 파이프라인 |
| `lib/photoroom.ts` | 74 | PhotoRoom API 래퍼 |

---

## Claude Vision 분류 시스템

### 프롬프트 구조 (prompt.ts)

**4 절대규칙**:
1. 한 이미지에 하나의 상품만 식별
2. 같은 상품의 다른 각도 사진은 같은 그룹으로
3. 그룹당 최대 8장
4. 최소 분류율 80%

**9 카테고리** (V2 소스: prompt.ts:54):
```
outer | suit | shirt | knitwear | trousers | shoes | sneakers | bag | necktie
```

**14 색상** (V2 소스: prompt.ts:68):
```
navy | black | white | brown | olive | light grey | burgundy | beige |
dark brown | grey | cream | khaki | forest green | charcoal
```

**7 패턴** (V2 소스: prompt.ts:69):
```
solid | stripe | plaid | check | herringbone | houndstooth | paisley
```

### 배치 처리 상수 (constants.ts)

```typescript
// V2 소스: lib/photo-classify/constants.ts
BATCH_SIZE = 10              // 배치당 이미지 수
BATCH_THRESHOLD = 15         // 배칭 시작 임계값
BATCH_DELAY_MS = 30_000      // 배치간 딜레이 (30초)
RATE_LIMIT_WAIT_MS = 65_000  // 레이트리밋 대기 (65초)
MAX_RETRIES_PER_BATCH = 3    // 배치당 최대 재시도
MAX_GROUP_SIZE = 8            // 그룹당 최대 이미지
MIN_CLASSIFIED_RATIO = 0.8   // 최소 분류율 (80%)
// 참고: CONCURRENT_LIMIT 상수는 V2에 없음
```

### 분류 타입 (types.ts)

```typescript
interface ClassifiedFile {
  fileName: string
  type: string        // 카테고리
  order: number       // 그룹 내 순서
  confidence: number  // 0~1
  description: string
  color: string
  pattern: string
}

interface ClassifiedGroup {
  groupId: string
  brand: string
  type: string     // 카테고리
  subtype: string
  color: string
  size: string
  files: ClassifiedFile[]
}

interface ValidationError {
  groupId: string
  message: string
  severity: 'error' | 'warning'
}
```

### 후처리 4단계 (post-process.ts, 279줄)

```
Phase 1: 완전 일치 그룹 병합 — 동일 brand+type+color
Phase 2: 유사 그룹 병합 — 매칭 스코어 기반
Phase 3: 미분류 파일 재할당 — 가장 유사한 그룹에 배정
Phase 4: 그룹 크기 제한 — max 8장 초과 시 분할
```

**6 검증규칙**:
1. 빈 그룹 제거
2. 중복 파일 감지 (동일 fileName)
3. 그룹 크기 > 8 경고
4. 분류율 < 80% 에러
5. 카테고리 유효성 (9개 중 하나)
6. 파일명 원본과 일치 검증

---

## 매칭 스코어 (ClassifyMatchModal)

| 조건 | 점수 | 설명 |
|------|------|------|
| 브랜드 완전 일치 | +35 | 정확한 브랜드명 |
| 브랜드 유사 일치 | +25 | 별칭/변형 매칭 |
| 카테고리 일치 | +30 | jacket=jacket |
| 색상 일치 | +20 | black=black |
| 색상 불일치 | -15 | 다른 색상 |
| 사이즈 일치 | +15 | 동일 사이즈 |
| **최소 임계값** | **15** | 이 이상이어야 매칭 후보 |

---

## 이미지 편집 파이프라인 (photo-editor.ts)

### Step 1: normalizeToJpeg()
- HEIC → JPEG 변환 (heic-convert)
- EXIF 회전 보정 (sharp.rotate())
- 출력: JPEG Buffer

### Step 2: removeBg()
- **1차**: PhotoRoom API
  - URL: `https://sdk.photoroom.com/v1/segment`
  - Header: `x-api-key: PHOTOROOM_API_KEY`
  - Request: multipart/form-data (image_file)
  - Response: 투명 PNG Buffer
  - 에러 코드: 402(크레딧 소진), 429(일일 한도 ~93건), 520(서버)
- **2차 (폴백)**: `@imgly/background-removal-node` (로컬)

### Step 3: cleanAlphaFringe()
- alpha < ALPHA_THRESHOLD(25) → 완전 투명 처리
- 배경 제거 후 남은 반투명 프린지 제거

### Step 4: placeOnCanvas()
- 캔버스: 1500×1500px, 흰색(#FFFFFF)
- 이미지를 캔버스 크기에 맞게 스케일링
- 중앙 배치
- 출력: JPEG 95% 품질

---

## V3 구현 체크리스트

### Phase 4 (서비스 레이어)
- [ ] `photo.service.ts` — 사진 업로드, 분류, 편집, 매칭
- [ ] `photo-classify.service.ts` — Claude Vision 분류 파이프라인
- [ ] `photo-edit.service.ts` — 이미지 편집 파이프라인
- [ ] 분류 상수/타입 정의

### Phase 5 (API 라우트)
- [ ] `POST /api/admin/photos/upload` — 원본 업로드
- [ ] `POST /api/admin/photos/classify` — Claude Vision 분류 (SSE)
- [ ] `POST /api/admin/photos/edit` — 배경제거+캔버스 처리
- [ ] `POST /api/admin/photos/match` — 상품-사진 매칭

### Phase 6 (UI)
- [ ] 3탭 UI (원본/처리됨/상품별)
- [ ] 분류 모달 (SSE 진행률 + 결과 표시)
- [ ] 드래그앤드롭 파일 순서 변경
- [ ] 수동 상품 매칭 검색
- [ ] 이미지 편집 진행률 표시

### V2 핵심 UX 유지 사항
1. **3탭 구조**: 원본→처리됨→상품별 흐름
2. **SSE 스트리밍**: 분류 진행 실시간 표시
3. **드래그앤드롭**: 그룹 내 사진 순서 변경
4. **배치 처리 피드백**: 10개씩 처리, 진행률 표시
5. **PhotoRoom + 폴백**: 1차 API, 2차 로컬
