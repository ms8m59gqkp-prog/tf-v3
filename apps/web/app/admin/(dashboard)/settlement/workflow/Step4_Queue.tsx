/**
 * Step 4: 정산 대기열
 * WHY: 매칭 결과를 셀러별 그룹화하여 큐에 적재
 * HOW: POST /queue → GET /queue/summary → 셀러별 카드
 * WHERE: WorkflowClient.tsx
 */
'use client'

import { useState } from 'react'
import Button from '@/components/Button'
import { api, APIError } from '@/lib/api/client'
import { useApi } from '@/hooks/useApi'
import { useToast } from '@/components/Toast'

interface SellerSummary {
  sellerId: string
  sellerName: string
  totalItems: number
  totalSaleAmount: number
  totalPayout: number
}

interface Step4Props {
  onComplete: () => void
}

export default function Step4_Queue({ onComplete }: Step4Props) {
  const [queued, setQueued] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { data: summary } = useApi<SellerSummary[]>(
    queued ? '/api/admin/matching/queue/summary' : null,
  )

  async function handleQueue() {
    setLoading(true)
    try {
      await api.post('/api/admin/matching/queue', {})
      setQueued(true)
      toast('큐 적재 완료', 'success')
    } catch (err) {
      toast(err instanceof APIError ? err.message : '큐 적재 실패', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {!queued ? (
        <div className="text-center">
          <p className="mb-4 text-sm text-gray-600">매칭 결과를 대기열에 적재합니다</p>
          <Button loading={loading} onClick={handleQueue}>큐 적재</Button>
        </div>
      ) : (
        <>
          <p className="text-sm font-medium text-gray-700">셀러별 정산 요약</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(summary ?? []).map((s) => (
              <div key={s.sellerId} className="rounded-lg border border-gray-200 p-4">
                <p className="font-semibold text-gray-900">{s.sellerName}</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">건수</p>
                    <p className="font-medium">{s.totalItems}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">매출</p>
                    <p className="font-medium">{s.totalSaleAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">지급액</p>
                    <p className="font-medium">{s.totalPayout.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={onComplete}>다음 단계</Button>
          </div>
        </>
      )}
    </div>
  )
}
