/**
 * 셀러 핵심 CRUD + findOrCreate
 * WHY: sellers 테이블 쿼리 일원화 (SELECT * 금지, AV1)
 * HOW: COLUMNS 명시 + mapRow snake→camelCase + DbResult 래핑
 * WHERE: 위탁 접수, 정산, 주문 등 셀러 참조 전역
 */
import { createAdminClient } from '../../supabase/admin'
import type { Seller } from '../../types/domain/seller'
import type { DbResult } from '../types'

const COLUMNS = [
  'id', 'seller_code', 'name', 'phone', 'email', 'seller_tier', 'status',
  'commission_rate', 'channel_type', 'bank_name', 'bank_account', 'bank_holder',
  'bank_verified', 'address', 'created_at', 'updated_at',
  'id_card_number', 'id_card_verified', 'id_card_file_url',
  'contract_start', 'contract_end', 'tagging_code', 'nickname',
  'marketing_consent', 'marketing_consent_at',
].join(', ')

function mapRow(row: Record<string, unknown>): Seller {
  return {
    id: row.id as string,
    sellerCode: row.seller_code as string,
    name: row.name as string,
    phone: row.phone as string,
    email: (row.email as string) ?? null,
    sellerTier: (row.seller_tier as Seller['sellerTier']) ?? null,
    status: (row.status as Seller['status']) ?? null,
    commissionRate: row.commission_rate != null ? Number(row.commission_rate) : null,
    channelType: (row.channel_type as Seller['channelType']) ?? null,
    bankName: (row.bank_name as string) ?? null,
    bankAccount: (row.bank_account as string) ?? null,
    bankHolder: (row.bank_holder as string) ?? null,
    bankVerified: (row.bank_verified as boolean) ?? null,
    address: (row.address as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
    updatedAt: (row.updated_at as string) ?? null,
    idCardNumber: (row.id_card_number as string) ?? null,
    idCardVerified: (row.id_card_verified as boolean) ?? null,
    idCardFileUrl: (row.id_card_file_url as string) ?? null,
    contractStart: (row.contract_start as string) ?? null,
    contractEnd: (row.contract_end as string) ?? null,
    taggingCode: (row.tagging_code as string) ?? null,
    nickname: (row.nickname as string) ?? null,
    marketingConsent: (row.marketing_consent as boolean) ?? null,
    marketingConsentAt: (row.marketing_consent_at as string) ?? null,
  }
}

export { mapRow, COLUMNS }
interface CreateSellerInput { name: string; phone: string; address?: string; status?: string }

export async function findById(id: string): Promise<DbResult<Seller>> {
  const client = createAdminClient()
  const { data, error } = await client.from('sellers').select(COLUMNS).eq('id', id).single()
  if (error) return { data: null, error: error.message }
  return { data: mapRow(data as unknown as Record<string, unknown>), error: null }
}

export async function findByPhone(phone: string): Promise<DbResult<Seller | null>> {
  const client = createAdminClient()
  const { data, error } = await client.from('sellers').select(COLUMNS).eq('phone', phone).maybeSingle()
  if (error) return { data: null, error: error.message }
  return data ? { data: mapRow(data as unknown as Record<string, unknown>), error: null } : { data: null, error: null }
}
export async function listActive(): Promise<DbResult<Seller[]>> {
  const client = createAdminClient()
  const { data, error } = await client.from('sellers').select(COLUMNS).eq('status', 'active').range(0, 4999)
  if (error) return { data: null, error: error.message }
  return { data: (data as unknown as Record<string, unknown>[]).map(mapRow), error: null }
}

export async function create(input: CreateSellerInput): Promise<DbResult<Seller>> {
  const client = createAdminClient()
  const { data: code, error: rpcErr } = await client.rpc(
    'generate_seller_code' as never,
    { p_name: input.name, p_phone: input.phone, p_address: input.address ?? '' } as never,
  )
  if (rpcErr) return { data: null, error: rpcErr.message }
  const { data, error } = await client.from('sellers').insert({
    seller_code: code as string, name: input.name, phone: input.phone,
    address: input.address ?? null, status: input.status ?? 'active',
  }).select(COLUMNS).single()
  if (error) return { data: null, error: error.message }
  return { data: mapRow(data as unknown as Record<string, unknown>), error: null }
}
export async function update(id: string, fields: Partial<Record<string, unknown>>): Promise<DbResult<Seller>> {
  const client = createAdminClient()
  const { data, error } = await client.from('sellers').update(fields).eq('id', id).select(COLUMNS).single()
  if (error) return { data: null, error: error.message }
  return { data: mapRow(data as unknown as Record<string, unknown>), error: null }
}

export async function findOrCreate(name: string, phone: string, address?: string): Promise<DbResult<Seller>> {
  if (phone) {
    const existing = await findByPhone(phone)
    if (existing.error) return { data: null, error: existing.error }
    if (existing.data) {
      if (existing.data.name !== name) return update(existing.data.id, { name })
      return { data: existing.data, error: null }
    }
  }
  if (!phone) return create({ name: name || '미상', phone, address, status: 'active' })
  const client = createAdminClient()
  const { data: code, error: rpcErr } = await client.rpc(
    'generate_seller_code' as never,
    { p_name: name || '미상', p_phone: phone, p_address: address ?? '' } as never,
  )
  if (rpcErr) return { data: null, error: rpcErr.message }
  const { data, error } = await client.from('sellers').insert({
    seller_code: code as string, name: name || '미상', phone,
    address: address ?? null, status: 'active',
  }).select(COLUMNS).single()
  if (!error) return { data: mapRow(data as unknown as Record<string, unknown>), error: null }
  if (error.code === '23505') {
    const fallback = await findByPhone(phone)
    if (!fallback.error && fallback.data) return { data: fallback.data, error: null }
  }
  return { data: null, error: error.message }
}
