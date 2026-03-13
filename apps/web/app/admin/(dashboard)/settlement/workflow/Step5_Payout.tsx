/**
 * Step 5: 지급 처리
 * WHY: 정산서 생성 + 엑셀 다운로드 + 확정
 * HOW: generate → export → confirm
 * WHERE: WorkflowClient.tsx
 */
'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import Button from '@/components/Button'
import FormField from '@/components/FormField'
import { api, APIError } from '@/lib/api/client'
import { useToast } from '@/components/Toast'

interface Step5Props { onComplete: (settlementId: string) => void }

export default function Step5_Payout({ onComplete }: Step5Props) {
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [settlementId, setSettlementId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const { toast } = useToast()

  async function handleGenerate() {
    if (!periodStart || !periodEnd) { toast('기간을 선택하세요', 'error'); return }
    if (periodStart > periodEnd) { toast('시작일이 종료일보다 늦습니다', 'error'); return }
    setGenerating(true)
    try {
      const res = await api.post<{ id: string }>('/api/admin/settlements/generate', { periodStart, periodEnd })
      setSettlementId(res.id)
      toast('정산서 생성 완료', 'success')
    } catch (err) {
      toast(err instanceof APIError ? err.message : '생성 실패', 'error')
    } finally { setGenerating(false) }
  }

  async function handleExport() {
    if (!settlementId) return
    try {
      const res = await fetch('/api/admin/settlements/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ settlementId }),
      })
      if (!res.ok) throw new Error('다운로드 실패')
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('spreadsheet') && !ct.includes('octet-stream')) throw new Error('잘못된 응답 형식')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      Object.assign(document.createElement('a'), { href: url, download: `settlement-${settlementId}.xlsx` }).click()
      URL.revokeObjectURL(url)
    } catch { toast('엑셀 다운로드 실패', 'error') }
  }

  async function handleConfirm() {
    if (!settlementId) return
    setConfirming(true)
    try {
      await api.post(`/api/admin/settlements/${settlementId}/confirm`, {})
      toast('확정 완료', 'success')
      onComplete(settlementId)
    } catch (err) {
      toast(err instanceof APIError ? err.message : '확정 실패', 'error')
    } finally { setConfirming(false) }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="시작일">
          <input type="date" className="w-full rounded-md border border-gray-300 p-2 text-sm" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </FormField>
        <FormField label="종료일">
          <input type="date" className="w-full rounded-md border border-gray-300 p-2 text-sm" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </FormField>
      </div>
      {!settlementId ? (
        <Button loading={generating} onClick={handleGenerate}>정산서 생성</Button>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExport}><Download className="mr-1.5 h-4 w-4" /> 엑셀 다운로드</Button>
          <Button loading={confirming} onClick={handleConfirm}>확정</Button>
        </div>
      )}
    </div>
  )
}
