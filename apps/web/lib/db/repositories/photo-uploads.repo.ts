/**
 * photo_uploads 테이블 CRUD
 * WHY: 업로드된 원본 사진 메타데이터 관리
 * HOW: createAdminClient + mapRow snake→camel
 * WHERE: photo-upload.service.ts에서 호출
 */
import { createAdminClient } from '../../supabase/admin'
import type { PhotoUpload } from '../../types/domain/photo'
import type { DbResult } from '../types'

const COLUMNS = `id, file_name, file_url, file_size, uploaded_by, is_matched, order_item_id, uploaded_at` as const

function mapRow(row: Record<string, unknown>): PhotoUpload {
  return {
    id: row.id as string,
    fileName: row.file_name as string,
    fileUrl: row.file_url as string,
    fileSize: (row.file_size as number) ?? null,
    uploadedBy: (row.uploaded_by as string) ?? null,
    isMatched: (row.is_matched as boolean) ?? null,
    orderItemId: (row.order_item_id as string) ?? null,
    uploadedAt: (row.uploaded_at as string) ?? null,
  }
}

export async function create(
  input: { file_name: string; file_url: string; file_size?: number; uploaded_by?: string },
): Promise<DbResult<PhotoUpload>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('photo_uploads')
    .insert(input)
    .select(COLUMNS)
    .single()
  if (error) return { data: null, error: error.message }
  return { data: mapRow(data as Record<string, unknown>), error: null }
}

export async function bulkCreate(
  inputs: Array<{ file_name: string; file_url: string; file_size?: number; uploaded_by?: string }>,
): Promise<DbResult<PhotoUpload[]>> {
  if (inputs.length === 0) return { data: [], error: null }
  const client = createAdminClient()
  const { data, error } = await client
    .from('photo_uploads')
    .insert(inputs)
    .select(COLUMNS)
  if (error) return { data: null, error: error.message }
  return { data: (data as Record<string, unknown>[]).map(mapRow), error: null }
}

export async function findById(id: string): Promise<DbResult<PhotoUpload>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('photo_uploads')
    .select(COLUMNS)
    .eq('id', id)
    .single()
  if (error) return { data: null, error: error.message }
  return { data: mapRow(data as Record<string, unknown>), error: null }
}

export async function listUnmatched(): Promise<DbResult<PhotoUpload[]>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('photo_uploads')
    .select(COLUMNS)
    .eq('is_matched', false)
    .order('uploaded_at', { ascending: false })
  if (error) return { data: null, error: error.message }
  return { data: (data as Record<string, unknown>[]).map(mapRow), error: null }
}
