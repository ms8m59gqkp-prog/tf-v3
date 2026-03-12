/**
 * 상품 서비스 (L1 Business Layer)
 * WHY: 상품 CRUD 비즈니스 로직 캡슐화 — repo 직접 노출 방지
 * HOW: camelCase ↔ snake_case 변환 + DbResult 에러 → AppError throw
 * WHERE: 상품 목록/상세/등록/수정 API route에서 호출
 */
import * as productsRepo from '../db/repositories/products.repo'
import * as productsQueryRepo from '../db/repositories/products-query.repo'
import type { StProductWithSeller } from '../db/repositories/products.repo'
import type { ProductSummary } from '../db/repositories/products-query.repo'
import type { StProduct } from '../types/domain/product'
import type { PageOptions } from '../db/types'
import { AppError } from '../errors'

export interface CreateProductInput {
  productName: string
  salePrice: number
  sellerId?: string
  brand?: string
  category?: string
  productCondition?: string
  productType?: string
  size?: string
  color?: string
  origin?: string
  material?: string
  composition?: string
  retailPrice?: number
  retailPriceSource?: string
}

function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`)
}

function camelToSnakeFields(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[toSnake(k)] = v
  }
  return result
}

export async function list(
  filters?: Parameters<typeof productsQueryRepo.list>[0],
  pageOptions?: PageOptions,
): Promise<{ items: StProductWithSeller[]; total: number }> {
  const result = await productsQueryRepo.list(filters, pageOptions)
  if (result.error !== null) throw new AppError('INTERNAL', result.error)
  return { items: result.data, total: result.total }
}

export async function getById(id: string): Promise<StProductWithSeller> {
  const result = await productsRepo.findById(id)
  if (result.error !== null) throw new AppError('NOT_FOUND', `상품을 찾을 수 없습니다: ${id}`)
  return result.data
}

export async function update(id: string, fields: Partial<StProduct>): Promise<StProduct> {
  const existing = await productsRepo.findById(id)
  if (existing.error !== null) throw new AppError('NOT_FOUND', `상품을 찾을 수 없습니다: ${id}`)

  const snakeFields = camelToSnakeFields(fields as unknown as Record<string, unknown>)
  if (Object.keys(snakeFields).length === 0) return existing.data

  const result = await productsRepo.update(id, snakeFields)
  if (result.error !== null) throw new AppError('INTERNAL', result.error)
  return result.data
}

export async function create(input: CreateProductInput): Promise<StProduct> {
  const snakeFields = camelToSnakeFields(input as unknown as Record<string, unknown>)
  const result = await productsRepo.create(
    snakeFields as Partial<Record<string, unknown>> & { product_name: string; sale_price: number },
  )
  if (result.error !== null) throw new AppError('INTERNAL', result.error)
  return result.data
}

export async function remove(id: string): Promise<StProduct> {
  const existing = await productsRepo.findById(id)
  if (existing.error !== null) throw new AppError('NOT_FOUND', `상품을 찾을 수 없습니다: ${id}`)
  if (existing.data.isActive === false) throw new AppError('CONFLICT', '이미 비활성화된 상품입니다')

  const result = await productsRepo.update(id, { is_active: false })
  if (result.error !== null) throw new AppError('INTERNAL', result.error)
  return result.data
}

export async function getSummary(): Promise<ProductSummary> {
  const result = await productsQueryRepo.getSummary()
  if (result.error !== null) throw new AppError('INTERNAL', result.error)
  return result.data
}
