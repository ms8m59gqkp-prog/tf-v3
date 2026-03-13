/**
 * Step 6: 최종 검토 + 지급
 * WHY: 정산 내역 확인 후 최종 지급 처리
 * HOW: GET /settlements/[id] → 확인 → POST /pay
 * WHERE: WorkflowClient.tsx
 */
'use client'

import { useState } from 'react'
import Button from '@/components/Button'
import FormField from '@/components/FormField'
import { useApi } from '@/hooks/useApi'
import { api, APIError } from '@/lib/api/client'
import { useToast } from '@/components/Toast'

interface SettlementDetail {
  id: string
  totalSales: number
  commissionAmount: number
  settlementAmount: number
  itemCount: number
  status: string
}

interface Step6Props {
  settlementId: string
  onComplete: () => void
}

export default function Step6_Review({ settlementId, onComplete }: Step6Props) {
  const { data } = useApi<SettlementDetail>(`/api/admin/settlements/${settlementId}`)
  const [paidBy, setPaidBy] = useState('')
  const [transferRef, setTransferRef] = useState('')
  const [paying, setPaying] = useState(false)
  const { toast } = useToast()

  async function handlePay() {
    if (!paidBy.trim()) {
      toast('처리자를 입력하세요', 'error')
      return
    }
    setPaying(true)
    try {
      await api.post(`/api/admin/settlements/${settlementId}/pay`, {
        paidBy,
        ...(transferRef ? { transferRef } : {}),
      })
      toast('지급 완료', 'success')
      onComplete()
    } catch (err) {
      toast(err instanceof APIError ? err.message : '지급 실패', 'error')
    } finally {
      setPaying(false)
    }
  }

  if (!data) return <p className="text-sm text-gray-500">로딩 중...</p>

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-gray-50 p-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">총매출:</span> <strong>{data.totalSales.toLocaleString()}</strong></div>
          <div><span className="text-gray-500">수수료:</span> <strong>{data.commissionAmount.toLocaleString()}</strong></div>
          <div><span className="text-gray-500">정산액:</span> <strong>{data.settlementAmount.toLocaleString()}</strong></div>
          <div><span className="text-gray-500">건수:</span> <strong>{data.itemCount}</strong></div>
        </div>
      </div>

      <FormField label="처리자">
        <input className="w-full rounded-md border border-gray-300 p-2 text-sm" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} placeholder="이름" />
      </FormField>
      <FormField label="이체 참조번호 (옵션)">
        <input className="w-full rounded-md border border-gray-300 p-2 text-sm" value={transferRef} onChange={(e) => setTransferRef(e.target.value)} />
      </FormField>

      <div className="flex justify-end">
        <Button loading={paying} onClick={handlePay}>최종 지급</Button>
      </div>
    </div>
  )
}
