/**
 * photos 테이블 CRUD
 * WHY: 처리/매칭된 사진 데이터 관리
 * HOW: createAdminClient + mapRow snake→camel
 * WHERE: photo-edit.service.ts에서 호출
 */
import { createAdminClient } from '../../supabase/admin'
import type { Photo } from '../../types/domain/photo'
import type { DbResult } from '../types'

const COLUMNS = `id, order_item_id, file_name, file_url, shot_type, is_edited, edited_url, sort_order, created_at` as const

function mapRow(row: Record<string, unknown>): Photo {
  return {
    id: row.id as string,
    orderItemId: row.order_item_id as string,
    fileName: row.file_name as string,
    fileUrl: row.file_url as string,
    shotType: (row.shot_type as string) ?? null,
    isEdited: (row.is_edited as boolean) ?? null,
    editedUrl: (row.edited_url as string) ?? null,
    sortOrder: (row.sort_order as number) ?? null,
    createdAt: (row.created_at as string) ?? null,
  }
}

export async function create(
  input: { order_item_id: string; file_name: string; file_url: string; shot_type?: string; sort_order?: number },
): Promise<DbResult<Photo>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('photos')
    .insert(input)
    .select(COLUMNS)
    .single()
  if (error) return { data: null, error: error.message }
  return { data: mapRow(data as Record<string, unknown>), error: null }
}

export async function findByOrderItemId(orderItemId: string): Promise<DbResult<Photo[]>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('photos')
    .select(COLUMNS)
    .eq('order_item_id', orderItemId)
    .order('sort_order', { ascending: true })
  if (error) return { data: null, error: error.message }
  return { data: (data as Record<string, unknown>[]).map(mapRow), error: null }
}

export async function updateEditedUrl(
  id: string, editedUrl: string,
): Promise<DbResult<Photo>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('photos')
    .update({ edited_url: editedUrl, is_edited: true })
    .eq('id', id)
    .select(COLUMNS)
    .single()
  if (error) return { data: null, error: error.message }
  return { data: mapRow(data as Record<string, unknown>), error: null }
}

export async function findByIds(ids: string[]): Promise<DbResult<Photo[]>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('photos')
    .select(COLUMNS)
    .in('id', ids)
  if (error) return { data: null, error: error.message }
  return { data: (data as Record<string, unknown>[]).map(mapRow), error: null }
}
