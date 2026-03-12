/**
 * 시세 관리 서비스 (L1 Business Layer)
 * WHY: market_prices CRUD 비즈니스 로직 캡슐화
 * HOW: repo 래핑 + 입력 검증 + DbResult → AppError 변환
 * WHERE: market-prices API route에서 호출
 */
import * as marketPricesRepo from '../db/repositories/market-prices.repo'
import * as marketPricesQueryRepo from '../db/repositories/market-prices-query.repo'
import type { MarketPrice, CreateMarketPriceInput } from '../db/repositories/market-prices.repo'
import type { MarketPriceFilters } from '../db/repositories/market-prices-query.repo'
import type { PageOptions } from '../db/types'
import { AppError } from '../errors'

export async function list(
  filters?: MarketPriceFilters,
  pageOptions?: PageOptions,
): Promise<{ items: MarketPrice[]; total: number }> {
  const result = await marketPricesQueryRepo.list(filters, pageOptions)
  if (result.error !== null) throw new AppError('INTERNAL', result.error)
  return { items: result.data, total: result.total }
}

export async function create(input: CreateMarketPriceInput): Promise<MarketPrice> {
  if (!input.brand?.trim()) {
    throw new AppError('VALIDATION', '브랜드는 필수입니다')
  }
  if (!input.category?.trim()) {
    throw new AppError('VALIDATION', '카테고리는 필수입니다')
  }
  if (input.price <= 0) {
    throw new AppError('VALIDATION', '가격은 0보다 커야 합니다')
  }

  const result = await marketPricesRepo.create(input)
  if (result.error !== null) throw new AppError('INTERNAL', result.error)
  return result.data
}

export async function findByBrandCategory(
  brand: string,
  category: string,
): Promise<{ items: MarketPrice[]; total: number }> {
  if (!brand.trim()) throw new AppError('VALIDATION', '브랜드는 필수입니다')
  if (!category.trim()) throw new AppError('VALIDATION', '카테고리는 필수입니다')

  const result = await marketPricesQueryRepo.findByBrandCategory(brand, category)
  if (result.error !== null) throw new AppError('INTERNAL', result.error)
  return { items: result.data, total: result.total }
}
