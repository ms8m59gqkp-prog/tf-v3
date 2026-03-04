/**
 * 판매자 리포지토리 — sellers 테이블 CRUD
 * WHY: 판매자 정보 조회/생성/수정 데이터 접근
 * HOW: createAdminClient + mapRow(V2 snake→V3 camel)
 * WHERE: seller 서비스에서 참조
 */

import { createAdminClient } from '@/lib/db/client'
import type { Seller, SellerTier } from '@/lib/types/domain/seller'

const COLUMNS = 'id, name, phone, seller_code, commission_rate, seller_tier, bank_name, bank_account, created_at'

export function mapRow(row: Record<string, unknown>): Seller {
  return {
    id: row.id as string,
    sellerName: row.name as string,
    phone: row.phone as string,
    sellerCode: row.seller_code as string,
    sellerType: row.seller_tier as SellerTier,
    commissionRate: Number(row.commission_rate),
    bankName: (row.bank_name as string) || undefined,
    bankAccount: (row.bank_account as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.created_at as string, // V2 has no updated_at → fallback
  }
}

export async function getById(id: string): Promise<Seller> {
  const sb = createAdminClient()
  const { data, error } = await sb.from('sellers').select(COLUMNS).eq('id', id).single()
  if (error) throw new Error(`[sellers.getById] ${error.message}`)
  return mapRow(data)
}

export async function getByPhone(phone: string): Promise<Seller> {
  const sb = createAdminClient()
  const { data, error } = await sb.from('sellers').select(COLUMNS).eq('phone', phone).single()
  if (error) throw new Error(`[sellers.getByPhone] ${error.message}`)
  return mapRow(data)
}

export async function getBySellerCode(code: string): Promise<Seller> {
  const sb = createAdminClient()
  const { data, error } = await sb.from('sellers').select(COLUMNS).eq('seller_code', code).single()
  if (error) throw new Error(`[sellers.getBySellerCode] ${error.message}`)
  return mapRow(data)
}

export async function listByPage({ page, pageSize }: { page: number; pageSize: number }): Promise<Seller[]> {
  const from = page * pageSize
  const to = from + pageSize - 1
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('sellers')
    .select(COLUMNS)
    .range(from, to)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`[sellers.listByPage] ${error.message}`)
  return data.map(mapRow)
}

interface CreateSellerInput {
  name: string
  phone: string
  sellerCode: string
  commissionRate: number
  sellerTier: SellerTier
  bankName?: string
  bankAccount?: string
}

export async function create(input: CreateSellerInput): Promise<Seller> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('sellers')
    .insert({
      name: input.name,
      phone: input.phone,
      seller_code: input.sellerCode,
      commission_rate: input.commissionRate,
      seller_tier: input.sellerTier,
      bank_name: input.bankName ?? null,
      bank_account: input.bankAccount ?? null,
    })
    .select(COLUMNS)
    .single()
  if (error) throw new Error(`[sellers.create] ${error.message}`)
  return mapRow(data)
}

export async function updateCommissionRate(id: string, expectedRate: number, newRate: number): Promise<Seller> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('sellers')
    .update({ commission_rate: newRate })
    .eq('id', id)
    .eq('commission_rate', expectedRate)
    .select(COLUMNS)
    .single()
  if (error) throw new Error(`[sellers.updateCommissionRate] ${error.message}`)
  return mapRow(data)
}
