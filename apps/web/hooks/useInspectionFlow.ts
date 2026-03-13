/**
 * 위탁 검수 7단계 상태머신 훅
 * WHY: 검수 플로우를 단계별로 관리
 * HOW: step enum + reducer 패턴
 * WHERE: consignments/InspectionModal.tsx
 */
'use client'

import { useState, useCallback, useRef } from 'react'

export type InspectionStep =
  | 'question'
  | 'measurement'
  | 'issue_type'
  | 'hold_form'
  | 'hold_sms'
  | 'reject_form'
  | 'reject_address'
  | 'reject_sms'

export type InspectionResult = 'completed' | 'on_hold' | 'rejected'

export interface InspectionFormData {
  result: InspectionResult | null
  issueType: string
  memo: string
  adjustmentPrice: number | null
  rejectAddress: string
  measurements: Record<string, string>
}

const INITIAL_FORM: InspectionFormData = {
  result: null,
  issueType: '',
  memo: '',
  adjustmentPrice: null,
  rejectAddress: '',
  measurements: {},
}

export function useInspectionFlow() {
  const [step, setStep] = useState<InspectionStep>('question')
  const [form, setForm] = useState<InspectionFormData>(INITIAL_FORM)
  const resultRef = useRef<InspectionResult | null>(null)

  const updateForm = useCallback(
    (patch: Partial<InspectionFormData>) =>
      setForm((prev) => ({ ...prev, ...patch })),
    [],
  )

  const next = useCallback((result?: InspectionResult) => {
    if (result) {
      resultRef.current = result
      setForm((prev) => ({ ...prev, result }))
    }

    setStep((current) => {
      if (current === 'question') {
        if (result === 'completed') return 'measurement'
        if (result === 'on_hold') return 'issue_type'
        if (result === 'rejected') return 'issue_type'
      }
      if (current === 'issue_type') {
        return resultRef.current === 'on_hold' ? 'hold_form' : 'reject_form'
      }
      if (current === 'hold_form') return 'hold_sms'
      if (current === 'reject_form') return 'reject_address'
      if (current === 'reject_address') return 'reject_sms'
      return current
    })
  }, [])

  const reset = useCallback(() => { setStep('question'); setForm(INITIAL_FORM) }, [])
  const isFinal = step === 'measurement' || step === 'hold_sms' || step === 'reject_sms'

  return { step, form, updateForm, next, reset, isFinal }
}
