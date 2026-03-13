/**
 * 주문 검수 Step2 — 14카테고리 실측
 * WHY: V2 동일 카테고리별 측정 필드
 * HOW: 카테고리 선택 → 프리셋 필드 표시 → 수치 입력
 * WHERE: OrderInspectionModal.tsx
 */
'use client'

import { useState } from 'react'
import Button from '@/components/Button'
import FormField from '@/components/FormField'
import { MEASUREMENT_CATEGORIES, type MeasurementCategory } from '@/lib/constants/measurement-fields'

interface MeasurementStepProps {
  onComplete: (measurements: Record<string, string>, size?: string) => void
}

export default function MeasurementStep({ onComplete }: MeasurementStepProps) {
  const [selected, setSelected] = useState<MeasurementCategory | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [size, setSize] = useState('')

  function updateValue(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }))
  }

  function handleCategorySelect(cat: MeasurementCategory) {
    setSelected(cat)
    setValues({})
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-700">카테고리 선택</p>
      <div className="flex flex-wrap gap-2">
        {MEASUREMENT_CATEGORIES.map((cat) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => handleCategorySelect(cat)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selected?.name === cat.name
                ? 'bg-amber-100 text-amber-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {selected && (
        <div className="space-y-3 rounded-lg border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-800">{selected.name} 측정</p>
          <div className="grid grid-cols-2 gap-3">
            {selected.fields.map((f) => (
              <FormField key={f.key} label={f.label}>
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-300 p-2 text-sm"
                  placeholder="cm"
                  value={values[f.key] ?? ''}
                  onChange={(e) => updateValue(f.key, e.target.value)}
                />
              </FormField>
            ))}
          </div>
        </div>
      )}

      <FormField label="사이즈 (옵션)">
        <input
          type="text"
          className="w-full rounded-md border border-gray-300 p-2 text-sm"
          placeholder="예: 100, XL, FREE"
          value={size}
          onChange={(e) => setSize(e.target.value)}
        />
      </FormField>

      <div className="flex justify-end">
        <Button
          disabled={!selected}
          onClick={() => onComplete(values, size || undefined)}
        >
          실측 완료
        </Button>
      </div>
    </div>
  )
}
