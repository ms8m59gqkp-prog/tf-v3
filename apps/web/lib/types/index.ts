/**
 * 도메인 타입 통합 re-export
 * WHY: 단일 진입점으로 import 경로 단순화
 * HOW: domain/ 하위 모든 모듈 re-export
 * WHERE: import { Seller, Order, ... } from '@/lib/types'
 */

export * from './domain/seller'
export * from './domain/consignment'
export * from './domain/order'
export * from './domain/settlement'
export * from './domain/product'
export * from './domain/notification'
export * from './domain/photo'
