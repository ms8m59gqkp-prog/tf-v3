/**
 * 배치 + 업로드 공유 인프라 (COLUMNS, mapRow, 타입)
 * WHY: _batch_progress + excel_uploads 쿼리 일원화 (SELECT * 금지, AV1)
 * HOW: 2개 테이블 COLUMNS 분리 명시 + mapRow 분리 + DbResult 래핑
 * WHERE: 배치 진행률 추적, 업로드 이력 관리
 */
import type { BatchProgress } from '../../types/domain/notification'

/** DDL _batch_progress 9컬럼 전체 -- SELECT * 금지 (AV1) */
const BATCH_COLUMNS = `id, batch_id, total, completed, failed,
  failed_ids, status, created_at, updated_at` as const

/** DDL excel_uploads 15컬럼 전체 -- SELECT * 금지 (AV1) */
const UPLOAD_COLUMNS = `id, upload_type, file_name, file_url, uploaded_by,
  row_count, success_count, error_count, error_details,
  consignment_count, inventory_count, return_count, mismatch_count,
  status, created_at` as const

export interface ExcelUpload {
  id: string
  uploadType: string
  fileName: string
  fileUrl?: string | null
  uploadedBy?: string | null
  rowCount: number
  successCount: number
  errorCount: number
  errorDetails?: unknown[] | null
  consignmentCount: number
  inventoryCount: number
  returnCount: number
  mismatchCount: number
  status: 'processing' | 'completed' | 'failed'
  createdAt?: string | null
}

function mapBatchRow(row: Record<string, unknown>): BatchProgress {
  return {
    id: row.id as string,
    batchId: row.batch_id as string,
    total: row.total as number,
    completed: row.completed as number,
    failed: row.failed as number,
    failedIds: (row.failed_ids as unknown[]) ?? null,
    status: row.status as BatchProgress['status'],
    createdAt: (row.created_at as string) ?? null,
    updatedAt: (row.updated_at as string) ?? null,
  }
}

function mapUploadRow(row: Record<string, unknown>): ExcelUpload {
  return {
    id: row.id as string,
    uploadType: row.upload_type as string,
    fileName: row.file_name as string,
    fileUrl: (row.file_url as string) ?? null,
    uploadedBy: (row.uploaded_by as string) ?? null,
    rowCount: (row.row_count as number) ?? 0,
    successCount: (row.success_count as number) ?? 0,
    errorCount: (row.error_count as number) ?? 0,
    errorDetails: (row.error_details as unknown[]) ?? null,
    consignmentCount: (row.consignment_count as number) ?? 0,
    inventoryCount: (row.inventory_count as number) ?? 0,
    returnCount: (row.return_count as number) ?? 0,
    mismatchCount: (row.mismatch_count as number) ?? 0,
    status: row.status as ExcelUpload['status'],
    createdAt: (row.created_at as string) ?? null,
  }
}

export { mapBatchRow, mapUploadRow, BATCH_COLUMNS, UPLOAD_COLUMNS }
