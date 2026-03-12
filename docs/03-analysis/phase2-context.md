# Phase 2 재구현 Context

**최종 업데이트**: 2026-03-09
**상태**: ✅ 완료

## 핵심 파일 경로

| 카테고리 | 경로 |
|---------|------|
| 계획서 | docs/03-analysis/phase2-detailed-plan.md |
| DDL | supabase/tokyo-ddl/01_tables.sql |
| 제약조건 | supabase/tokyo-ddl/02_constraints.sql |
| RPC 함수 | supabase/tokyo-ddl/04_functions.sql |
| Phase 1 타입 | apps/web/lib/types/domain/*.ts |
| Phase 1 유틸 | apps/web/lib/utils/*.ts |
| 인프라 | apps/web/lib/supabase/admin.ts |
| 구현 대상 | apps/web/lib/db/ |

## 의사결정 기록

| # | 결정 | 근거 |
|---|------|------|
| D1 | findOrCreate 23505는 error.code 직접 접근 (인라인 insert) | supabase-js는 throw하지 않음. 3회 시뮬레이션 전략B 6:1 채택 |
| D3 | sales-records rowIndex는 Phase 3 Service에서 매핑 | spread 객체 indexOf -1 문제. repo 범위 외 |
| D6 | notifications/batch는 구현 시 수동 DDL 교차검증 | Sim 10 미검증 |

## 아키텍처 규칙 (architecture-spec.md)

- repo 120줄 제한 (§10.1)
- 함수 80줄 제한 (§10.1)
- SELECT * 금지 → COLUMNS 명시 (§5.2)
- .or() 금지 (§5.2)
- L1 → L0 의존만 허용 (§2.1)
- Batch 오케스트레이션은 L1(Service)에만 (§6.1)

## 구현 결과 요약

| 항목 | 수량 |
|------|------|
| 총 파일 수 | 24개 (인프라 2 + 리포 19 + TX 3) |
| 원래 계획 파일 수 | 16개 → 120줄 제한 준수 위해 24개로 분할 |
| TS 에러 수정 | 18개 GenericStringError (2-step casting) |
| D1 버그 수정 | sellers.repo.ts findOrCreate try/catch → error.code |
| tsc 결과 | 0 errors |
| vitest 결과 | 79/79 PASS |
| 딥리서치 | 3회 모두 100% 매치율 |

## 다음 단계

- Phase 3: Service 레이어 계획 수립 (L1 Business Logic)
  - repo 함수를 조합하는 비즈니스 로직
  - Batch 오케스트레이션 (§6.1)
  - 엑셀 파싱 → repo 호출 → 결과 반환 흐름
