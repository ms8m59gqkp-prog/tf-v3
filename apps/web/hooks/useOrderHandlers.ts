/**
 * 주문 관리 5핸들러 훅
 * WHY: 주문 상태변경, 검수, 보류, 실측 로직 통합
 * HOW: api 호출 + mutate 재검증
 * WHERE: orders/OrderClient.tsx
 */
'use client'

import { useCallback } from 'react'
import { api } from '@/lib/api/client'
import type { KeyedMutator } from 'swr'
import type { OrderStatus, InspectionStatus } from '@/lib/types/domain/order'

export function useOrderHandlers<T>(mutate: KeyedMutator<T>) {
  const statusChange = useCallback(async (id: string, status: OrderStatus) => {
    await api.patch(`/api/admin/orders/${id}`, { status })
    await mutate()
  }, [mutate])

  const inspectionComplete = useCallback(async (
    id: string,
    itemId: string,
    fields: { inspectionStatus: InspectionStatus; condition?: string; memo?: string; holdAdjustedPrice?: number; holdReason?: string },
  ) => {
    await api.patch(`/api/admin/orders/${id}/inspection`, { itemId, ...fields })
    await mutate()
  }, [mutate])

  const hold = useCallback(async (
    id: string,
    itemId: string,
    holdReason: string,
    holdAdjustedPrice: number,
  ) => {
    await api.patch(`/api/admin/orders/${id}/inspection`, {
      itemId,
      inspectionStatus: 'hold' as InspectionStatus,
      holdReason,
      holdAdjustedPrice,
    })
    await mutate()
  }, [mutate])

  const measurementSave = useCallback(async (
    id: string,
    itemId: string,
    measurements: Record<string, unknown>,
    size?: string,
  ) => {
    await api.patch(`/api/admin/orders/${id}/measurement`, {
      itemId,
      measurements,
      ...(size ? { size } : {}),
    })
    await mutate()
  }, [mutate])

  const measurementCardGenerate = useCallback(async (
    itemId: string,
    fields: Record<string, unknown>,
  ) => {
    await api.patch(`/api/admin/orders/items/${itemId}`, fields)
    await mutate()
  }, [mutate])

  return { statusChange, inspectionComplete, hold, measurementSave, measurementCardGenerate }
}
