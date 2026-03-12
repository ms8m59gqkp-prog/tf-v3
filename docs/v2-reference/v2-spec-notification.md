# V2 검증 기준서 #6: 알림 도메인

## 파일 구조

| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `lib/notification/sms.ts` | 68 | Solapi SMS 래퍼 |
| `lib/notification/templates.ts` | 133 | 6개 SMS 템플릿 |
| `lib/notification/index.ts` | 129 | 상태변경 자동 알림 + 수동 발송 + DB 로깅 |
| `api/admin/notifications/send-sms/route.ts` | 46 | SMS 발송 API |
| `api/admin/notifications/route.ts` | 84 | 이력 조회 API (필터+검색+페이지네이션) |
| `api/admin/notifications/bulk-send/route.ts` | 66 | 대량 발송 API |
| `api/admin/notifications/resend/route.ts` | 41 | 재발송 API |
| `app/admin/notifications/page.tsx` | 56 | 2탭: SendTab + HistoryTab |
| `components/SendTab.tsx` | 276 | 프로모션 발송 3단계 |
| `components/HistoryTab.tsx` | 243 | 발송 이력 + 필터 |
| `components/ManualSendModal.tsx` | 383 | 수동 발송 3단계 모달 |
| `components/LogDetailModal.tsx` | 127 | 상세 로그 + 재발송 |

---

## SMS 서비스 (Solapi)

- **API**: Solapi (CoolSMS) — `SolapiMessageService(apiKey, apiSecret)`
- **환경변수**: `COOLSMS_API_KEY`, `COOLSMS_API_SECRET`, `SENDER_PHONE`
- **자동 LMS 변환**: 90바이트 초과 시 자동 LMS 전환
- **개발 모드**: API 키 없으면 콘솔 로깅만

---

## SMS 템플릿 6종

| 이벤트 | 함수 | 트리거 |
|--------|------|--------|
| 수령 확인 | `receivedMessage(productName)` | approved → received |
| 검수 완료 | `completedMessage(productName)` | received → completed |
| 보류 (가격조정) | `holdMessage(productName, reason, adjustmentUrl)` | inspecting → on_hold |
| 판매 완료 | `soldMessage(productName, saleDate, saleAmount)` | 주문 sold |
| 대금 지급 | `paidMessage({sellerName, items[], totalPayout, payoutDate})` | 정산 paid |
| 반려 | `rejectedMessage(productName, reason, trackingNumber?)` | → rejected |

- **업체 전화번호**: `010-6644-6190` (템플릿에 하드코딩)
- **공통 인사말**: "안녕하세요, 트레이딩 플로어입니다"

---

## 알림 트리거 이벤트

```typescript
type TriggerEvent = 'received' | 'completed' | 'on_hold' | 'rejected' | 'sold' | 'paid' | 'custom' | 'promotion'
```

---

## 알림 관리 UI (2탭 구조)

**Tab 1: SendTab** — 프로모션 발송 3단계
1. **target**: "all"(전체 셀러) / "marketing"(광고 동의자) 선택, 대상 수 표시
2. **compose**: textarea + 바이트 카운트 (>90바이트 → LMS), 미리보기
3. **confirm**: 요약 + confirm() 재확인 → 발송 → "성공 N건/실패 M건" → 3초 후 HistoryTab

**Tab 2: HistoryTab** — 발송 이력
- 필터: Status(전체/발송완료/실패) + Event(8종) + 검색(셀러명/전화/상품번호/메시지, 디바운스 300ms)
- 테이블 7열: 일시 | 발송단계(EventBadge) | 상품번호 | 셀러 | 전화번호 | 메시지(50자 생략) | 상태
- 행 클릭 → LogDetailModal (상세 + 재발송 버튼[실패건만])

**ManualSendModal** — 수동 발송 3단계
1. **select**: 셀러 검색 + 체크박스 + 전체 선택 + 광고동의 태그
2. **compose**: textarea (6줄) + 바이트/자 카운트
3. **confirm**: 요약 + 미리보기 → 발송 → 2초 후 자동 종료

---

## 대량 발송/재발송 API

- **대량 발송**: `POST /api/admin/notifications/bulk-send` — sellerIds[] + message + triggerEvent → 순차 발송
- **재발송**: `POST /api/admin/notifications/resend` — logId → 원본 파라미터로 재발송
- **이력 조회**: `GET /api/admin/notifications` — status/trigger_event/date_from/date_to/search/page/per_page

---

## 알림 로깅

- **DB 테이블**: `notification_logs`
- **기록 항목**: consignmentId, sellerId, phone, message, triggerEvent, messageId, success
- **조인**: sellers(이름/전화), consignment_requests(상품번호/상품명)
