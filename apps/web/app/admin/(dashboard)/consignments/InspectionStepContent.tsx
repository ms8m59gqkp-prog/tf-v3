/**
 * 검수 단계별 UI 렌더
 * WHY: InspectionModal 줄 수 분리
 * HOW: step 값에 따라 폼 표시
 * WHERE: InspectionModal.tsx
 */
'use client'

import Button from '@/components/Button'
import FormField from '@/components/FormField'
import type { InspectionStep, InspectionResult, InspectionFormData } from '@/hooks/useInspectionFlow'

interface Props {
  step: InspectionStep
  form: InspectionFormData
  updateForm: (patch: Partial<InspectionFormData>) => void
  next: (result?: InspectionResult) => void
}

const RESULT_LABELS: Record<InspectionResult, string> = {
  completed: '승인 (완료)',
  on_hold: '보류',
  rejected: '반려',
}

export default function InspectionStepContent({ step, form, updateForm, next }: Props) {
  if (step === 'question') {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-gray-600">검수 결과를 선택하세요</p>
        {(Object.keys(RESULT_LABELS) as InspectionResult[]).map((r) => (
          <Button key={r} variant="secondary" onClick={() => next(r)}>{RESULT_LABELS[r]}</Button>
        ))}
      </div>
    )
  }

  if (step === 'measurement') {
    return (
      <FormField label="검수 메모">
        <textarea className="w-full rounded-md border border-gray-300 p-2 text-sm" rows={3} value={form.memo} onChange={(e) => updateForm({ memo: e.target.value })} />
      </FormField>
    )
  }

  if (step === 'issue_type') {
    return (
      <FormField label="이슈 유형">
        <input className="w-full rounded-md border border-gray-300 p-2 text-sm" value={form.issueType} onChange={(e) => updateForm({ issueType: e.target.value })} placeholder="예: 흠집, 변색, 사이즈 불일치" />
        <Button variant="secondary" onClick={() => next()} className="mt-2">다음</Button>
      </FormField>
    )
  }

  if (step === 'hold_form' || step === 'reject_form') {
    return (
      <div className="space-y-3">
        <FormField label="메모">
          <textarea className="w-full rounded-md border border-gray-300 p-2 text-sm" rows={2} value={form.memo} onChange={(e) => updateForm({ memo: e.target.value })} />
        </FormField>
        {step === 'hold_form' && (
          <FormField label="조정 가격">
            <input type="number" min="0" className="w-full rounded-md border border-gray-300 p-2 text-sm" value={form.adjustmentPrice ?? ''} onChange={(e) => updateForm({ adjustmentPrice: Math.max(0, Number(e.target.value)) || null })} />
          </FormField>
        )}
        <Button variant="secondary" onClick={() => next()}>다음</Button>
      </div>
    )
  }

  if (step === 'reject_address') {
    return (
      <FormField label="반송 주소">
        <input className="w-full rounded-md border border-gray-300 p-2 text-sm" value={form.rejectAddress} onChange={(e) => updateForm({ rejectAddress: e.target.value })} />
        <Button variant="secondary" onClick={() => next()} className="mt-2">다음</Button>
      </FormField>
    )
  }

  if (step === 'hold_sms' || step === 'reject_sms') {
    return (
      <div className="rounded-lg bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-600">
          {step === 'hold_sms' ? '보류 알림 SMS가 발송됩니다.' : '반려 알림 SMS가 발송됩니다.'}
        </p>
      </div>
    )
  }

  return null
}
