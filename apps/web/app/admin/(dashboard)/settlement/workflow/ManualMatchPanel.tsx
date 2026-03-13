/**
 * 수동매칭 좌우 분할 패널
 * WHY: V2 동일 — 미매칭 매출건↔네이버건 수동 연결
 * HOW: 좌측 매출 / 우측 네이버 → 선택 후 매칭
 * WHERE: Step3_Matching.tsx
 */
'use client'

import { useState } from 'react'
import Button from '@/components/Button'
import { api, APIError } from '@/lib/api/client'
import { useToast } from '@/components/Toast'

export interface UnmatchedItem {
  id: string
  productName: string
  amount: number
}

interface ManualMatchPanelProps {
  salesItems: UnmatchedItem[]
  naverItems: UnmatchedItem[]
  onMatchComplete: () => void
}

function ItemColumn({ items, selected, onSelect, label, activeClass }: {
  items: UnmatchedItem[]; selected: string | null; onSelect: (id: string) => void; label: string; activeClass: string
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="mb-2 text-xs font-medium text-gray-500">{label}</p>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">미매칭 건 없음</p>
      ) : items.map((item) => (
        <button key={item.id} type="button" onClick={() => onSelect(item.id)}
          className={`w-full rounded p-2 text-left text-sm ${selected === item.id ? activeClass : 'hover:bg-gray-50'}`}>
          <div className="font-medium">{item.productName}</div>
          <div className="text-xs text-gray-500">{item.amount.toLocaleString()}원</div>
        </button>
      ))}
    </div>
  )
}

export default function ManualMatchPanel({ salesItems, naverItems, onMatchComplete }: ManualMatchPanelProps) {
  const [selectedSales, setSelectedSales] = useState<string | null>(null)
  const [selectedNaver, setSelectedNaver] = useState<string | null>(null)
  const [matching, setMatching] = useState(false)
  const { toast } = useToast()

  async function handleMatch() {
    if (!selectedSales || !selectedNaver) return
    setMatching(true)
    try {
      await api.post('/api/admin/matching/manual', { salesRecordId: selectedSales, naverSettlementId: selectedNaver })
      toast('수동매칭 완료', 'success')
      setSelectedSales(null)
      setSelectedNaver(null)
      onMatchComplete()
    } catch (err) {
      toast(err instanceof APIError ? err.message : '매칭 실패', 'error')
    } finally { setMatching(false) }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">수동 매칭</p>
      <div className="grid grid-cols-2 gap-4">
        <ItemColumn items={salesItems} selected={selectedSales} onSelect={setSelectedSales} label="매출 건 (미매칭)" activeClass="bg-amber-100" />
        <ItemColumn items={naverItems} selected={selectedNaver} onSelect={setSelectedNaver} label="네이버 건 (미매칭)" activeClass="bg-blue-100" />
      </div>
      <div className="flex justify-center">
        <Button disabled={!selectedSales || !selectedNaver} loading={matching} onClick={handleMatch}>선택 항목 매칭</Button>
      </div>
    </div>
  )
}
