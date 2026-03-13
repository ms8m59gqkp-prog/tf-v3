/**
 * 주문 검수 Step1 — 등급 + 가격
 * WHY: V2 동일 4등급 선택 → derivePrices
 * HOW: 등급 버튼 → 가격 자동 계산
 * WHERE: OrderInspectionModal.tsx
 */
'use client'

import { useState } from 'react'
import Button from '@/components/Button'
import FormField from '@/components/FormField'

type Condition = 'N' | 'S' | 'A' | 'B'

const CONDITION_LABELS: Record<Condition, string> = {
  N: 'NEW',
  S: 'S급',
  A: 'A급',
  B: 'B급',
}

const CONDITION_RATES: Record<Condition, number> = {
  N: 1.0,
  S: 0.85,
  A: 0.70,
  B: 0.50,
}

function derivePrices(originalPrice: number): Record<Condition, number> {
  const result = {} as Record<Condition, number>
  for (const [k, rate] of Object.entries(CONDITION_RATES)) {
    result[k as Condition] = Math.round((originalPrice * rate) / 1000) * 1000
  }
  return result
}

interface InspectionStepProps {
  originalPrice: number
  onComplete: (condition: Condition, memo: string) => void
}

export default function InspectionStep({ originalPrice, onComplete }: InspectionStepProps) {
  const [condition, setCondition] = useState<Condition | null>(null)
  const [memo, setMemo] = useState('')
  const prices = derivePrices(originalPrice)

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-700">등급 선택</p>
      <div className="grid grid-cols-4 gap-2">
        {(Object.keys(CONDITION_LABELS) as Condition[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCondition(c)}
            className={`rounded-lg border-2 p-3 text-center text-sm font-medium transition-colors ${
              condition === c
                ? 'border-amber-500 bg-amber-50 text-amber-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <div>{CONDITION_LABELS[c]}</div>
            <div className="mt-1 text-xs text-gray-500">{prices[c].toLocaleString()}원</div>
          </button>
        ))}
      </div>

      {condition && (
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-sm text-gray-600">선택: <strong>{CONDITION_LABELS[condition]}</strong></p>
          <p className="text-lg font-bold text-gray-900">{prices[condition].toLocaleString()}원</p>
        </div>
      )}

      <FormField label="검수 메모">
        <textarea
          className="w-full rounded-md border border-gray-300 p-2 text-sm"
          rows={2}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </FormField>

      <div className="flex justify-end">
        <Button disabled={!condition} onClick={() => condition && onComplete(condition, memo)}>
          다음 (실측)
        </Button>
      </div>
    </div>
  )
}
