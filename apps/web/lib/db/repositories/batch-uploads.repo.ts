/**
 * 엑셀 업로드 기록 CRUD (excel_uploads 테이블)
 * WHY: batch.repo.ts 120줄 제한 준수 (§10.1)
 * HOW: createAdminClient + mapUploadRow 재사용
 * WHERE: 엑셀 업로드 이력 생성/결과 갱신
 */
import { createAdminClient } from '../../supabase/admin'
import type { DbResult } from '../types'
import { UPLOAD_COLUMNS, mapUploadRow, type ExcelUpload } from './batch.repo'

export async function createUploadRecord(
  input: { upload_type: string; file_name: string; file_url?: string; uploaded_by?: string; row_count?: number },
): Promise<DbResult<ExcelUpload>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('excel_uploads')
    .insert(input)
    .select(UPLOAD_COLUMNS)
    .single()
  if (error) return { data: null, error: error.message }
  return { data: mapUploadRow(data as Record<string, unknown>), error: null }
}

export async function updateUploadResult(
  id: string,
  result: {
    success_count?: number; error_count?: number; error_details?: unknown[]
    consignment_count?: number; inventory_count?: number
    return_count?: number; mismatch_count?: number; status?: string
  },
): Promise<DbResult<ExcelUpload>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('excel_uploads')
    .update(result)
    .eq('id', id)
    .select(UPLOAD_COLUMNS)
    .single()
  if (error) return { data: null, error: error.message }
  return { data: mapUploadRow(data as Record<string, unknown>), error: null }
}
