# V2 검증 기준서 #3: 사진 도메인

## 파일 구조 (30개 파일)

### 핵심 파일
| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `app/admin/photos/page.tsx` | 184 | 3탭: OriginalsTab, ProcessedTab, ProductTab(레거시) |
| `components/ClassifyMatchModal.tsx` | 343 | SSE 스트리밍 Claude Vision 분류 + 드래그앤드롭 + 수동 매칭 |
| `lib/photo-classify/prompt.ts` | 98 | Claude Vision 프롬프트 (4 절대규칙, 9 카테고리, 14 색상, 7 패턴) |
| `lib/photo-classify/claude-api.ts` | 187 | 배치 모드(10개/배치, 30초 딜레이), 레이트리밋 핸들링(65초 대기) |
| `lib/photo-classify/post-process.ts` | 279 | 4단계 그룹 병합 + 6 검증규칙 |
| `lib/photo-editor.ts` | 191 | 파이프라인: EXIF→배경제거→프린지→캔버스(1500×1500) |

---

## 사진 처리 파이프라인

```
원본 업로드 → HEIC→JPEG 변환 → EXIF 회전 보정
  → Claude Vision 분류 (SSE 스트리밍)
    → 배치 처리 (10개/배치, 30초 간격)
    → 4단계 후처리 (그룹 병합 + 검증)
  → 배경 제거 (PhotoRoom API → @imgly 폴백)
  → 알파 프린지 정리 (threshold=25)
  → 캔버스 배치 (1500×1500, 흰색 배경)
  → 결과 저장
```

---

## Claude Vision 분류 규칙

**4 절대규칙**:
1. 한 이미지에 하나의 상품만
2. 같은 상품의 다른 각도는 같은 그룹
3. 그룹당 최대 8장
4. 최소 분류율 80%

**9 카테고리** (V2 소스: prompt.ts:54):
```
outer, suit, shirt, knitwear, trousers, shoes, sneakers, bag, necktie
```

**14 색상** (V2 소스: prompt.ts:68):
```
navy, black, white, brown, olive, light grey, burgundy, beige, dark brown, grey, cream, khaki, forest green, charcoal
```

**7 패턴** (V2 소스: prompt.ts:69):
```
solid, stripe, plaid, check, herringbone, houndstooth, paisley
```

---

## 분류 후처리 (post-process.ts)

**4단계 그룹 병합**:
1. 완전 일치 그룹 병합
2. 유사 그룹 병합 (매칭 스코어 기반)
3. 미분류 파일 재할당
4. 그룹 크기 제한 (max 8)

**6 검증규칙**:
1. 빈 그룹 제거
2. 중복 파일 감지
3. 그룹 크기 초과 검사
4. 분류율 최소 80% 확인
5. 카테고리 유효성 검사
6. 파일명 일치 검증

---

## 매칭 스코어 (ClassifyMatchModal)

| 조건 | 점수 |
|------|------|
| 브랜드 완전 일치 | +35 |
| 브랜드 유사 일치 | +25 |
| 카테고리 일치 | +30 |
| 색상 일치 | +20 |
| 색상 불일치 | -15 |
| 사이즈 일치 | +15 |
| **최소 임계값** | **15** |

---

## 배경 제거

**1차**: PhotoRoom API (`https://sdk.photoroom.com/v1/segment`)
- 인증: `x-api-key` 헤더
- 일일 한도: ~93건
- 응답: 투명 PNG

**2차 (폴백)**: `@imgly/background-removal-node` (로컬 처리)

---

## 이미지 편집 파이프라인 (photo-editor.ts)

```
Step 1: normalizeToJpeg() — HEIC 변환 + EXIF 회전
Step 2: removeBg() — PhotoRoom API + @imgly 폴백
Step 3: cleanAlphaFringe() — alpha < 25인 픽셀 투명화
Step 4: placeOnCanvas() — 1500×1500 흰색 캔버스에 중앙 배치 (95% JPEG)
```
