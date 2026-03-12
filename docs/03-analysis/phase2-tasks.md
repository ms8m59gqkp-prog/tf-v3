# Phase 2 재구현 Tasks

**최종 업데이트**: 2026-03-09
**상태**: ✅ 완료 (딥리서치 3회 100% 검증)

## Step 1: 인프라 (2파일)
- [x] db/types.ts — DbResult, DbListResult, BulkResult, FailedRow, PageOptions
- [x] db/client.ts — createAdminClient re-export + 공용 헬퍼
- [x] tsc 검증

## Step 2: 리포 1~3 (3파일 → 5파일 분할)
- [x] sellers.repo.ts — 25컬럼, findOrCreate D1 Strategy B 적용
- [x] sellers-query.repo.ts — findByNameAndPhone, listByPage
- [x] consignments.repo.ts — 28컬럼 공유 인프라 + findById + create
- [x] consignments-query.repo.ts — list, updateStatus, batchDelete (분할)
- [x] consignments-bulk.repo.ts — bulkCreate, checkDuplicates, validateRow (분할)
- [x] tsc 검증

## Step 3: 리포 4~6 (3파일 → 6파일 분할)
- [x] orders.repo.ts — 19+23컬럼 공유 인프라 + findById + list
- [x] orders-mutation.repo.ts — updateStatus, updateItem, getItemsByOrderId (분할)
- [x] products.repo.ts — 36컬럼 공유 인프라 + findById + update + create
- [x] products-query.repo.ts — list (5-status filter) + getSummary (분할)
- [x] settlement.repo.ts — 16컬럼 공유 인프라 + findById + list
- [x] settlement-status.repo.ts — confirm, pay, updateStatus (분할)
- [x] tsc 검증

## Step 4: 리포 7~9 (3파일 → 5파일 분할)
- [x] sold-items.repo.ts — 20컬럼, upsertFromExcel, listPending
- [x] sales-records.repo.ts — 19컬럼 공유 인프라 + bulkInsert
- [x] sales-records-query.repo.ts — listUnmatched, updateMatchStatus, deleteBatch (분할)
- [x] naver-settlements.repo.ts — 13컬럼 공유 인프라 + bulkInsert
- [x] naver-settlements-query.repo.ts — listUnmatched, updateMatchStatus, deleteBatch, cleanUnmatched (분할)
- [x] tsc 검증

## Step 5: 리포 10~11 (2파일 → 5파일 분할)
- [x] notifications.repo.ts — 10컬럼 공유 인프라 + create + findByConsignmentId
- [x] notifications-query.repo.ts — list 복합검색 (.or() 금지 준수) (분할)
- [x] batch.repo.ts — 9+15컬럼 공유 인프라
- [x] batch-progress.repo.ts — createProgress, incrementCompleted/Failed, completeProgress (분할)
- [x] batch-uploads.repo.ts — createUploadRecord, updateUploadResult (분할)
- [x] tsc 검증

## Step 6: 트랜잭션 (3파일)
- [x] order.tx.ts — create_order_with_items RPC
- [x] settlement.tx.ts — create_settlement_with_items RPC
- [x] consignment.tx.ts — complete_consignment RPC
- [x] tsc 검증

## 최종 게이트
- [x] tsc --noEmit: 0 errors
- [x] vitest run: 79/79 PASS (4 test files)
- [x] 파일 줄 수: 전부 120줄 이내 (max: sellers.repo.ts 120줄)
- [x] 딥리서치 3회: Plan vs 구현 100%, DDL vs 컬럼 100%, 매니페스토 준수 100%
