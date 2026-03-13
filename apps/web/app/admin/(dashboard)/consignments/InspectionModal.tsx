/**
 * 위탁 검수 모달
 * WHY: 7단계 검수 플로우 (V2 동일)
 * HOW: useInspectionFlow + InspectionStepContent
 * WHERE: ConsignmentClient.tsx
 */
'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import { useInspectionFlow } from '@/hooks/useInspectionFlow'
import { api, APIError } from '@/lib/api/client'
import { useToast } from '@/components/Toast'
import InspectionStepContent from './InspectionStepContent'

interface InspectionModalProps {
  consignmentId: string
  open: boolean
  onClose: () => void
  onComplete: () => void
}

export default function InspectionModal({ consignmentId, open, onClose, onComplete }: InspectionModalProps) {
  const { step, form, updateForm, next, reset, isFinal } = useInspectionFlow()
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  async function handleSubmit() {
    setSubmitting(true)
    try {
      if (form.result === 'completed') {
        await api.post(`/api/admin/consignments/${consignmentId}/approve`, {})
      } else {
        await api.patch(`/api/admin/consignments/${consignmentId}`, {
          status: form.result, memo: form.memo, adjustmentPrice: form.adjustmentPrice,
        })
      }
      toast('검수 완료', 'success')
      reset()
      onComplete()
    } catch (err) {
      toast(err instanceof APIError ? err.message : '검수 실패', 'error')
    } finally { setSubmitting(false) }
  }

  function handleClose() { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="위탁 검수">
      <div className="space-y-4">
        <InspectionStepContent step={step} form={form} updateForm={updateForm} next={next} />
        {isFinal && (
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="secondary" onClick={handleClose}>취소</Button>
            <Button loading={submitting} onClick={handleSubmit}>확정</Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
