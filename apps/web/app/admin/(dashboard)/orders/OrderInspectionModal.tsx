/**
 * 주문 검수 2단계 모달
 * WHY: V2 동일 — Step1 등급선택 → Step2 실측
 * HOW: step 상태로 2단계 전환
 * WHERE: OrderClient.tsx
 */
'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'
import InspectionStep from './InspectionStep'
import MeasurementStep from './MeasurementStep'
import { useToast } from '@/components/Toast'

interface OrderInspectionModalProps {
  orderId: string
  itemId: string
  originalPrice: number
  open: boolean
  onClose: () => void
  onInspectionComplete: (itemId: string, condition: string, memo: string) => Promise<void>
  onMeasurementSave: (itemId: string, measurements: Record<string, string>, size?: string) => Promise<void>
}

export default function OrderInspectionModal({
  itemId,
  originalPrice,
  open,
  onClose,
  onInspectionComplete,
  onMeasurementSave,
}: OrderInspectionModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  async function handleInspection(condition: string, memo: string) {
    if (submitting) return
    setSubmitting(true)
    try {
      await onInspectionComplete(itemId, condition, memo)
      setStep(2)
    } catch {
      toast('검수 저장 실패', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMeasurement(measurements: Record<string, string>, size?: string) {
    if (submitting) return
    setSubmitting(true)
    try {
      await onMeasurementSave(itemId, measurements, size)
      toast('실측 완료', 'success')
      setStep(1)
      onClose()
    } catch {
      toast('실측 저장 실패', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    setStep(1)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`검수 ${step === 1 ? '(1/2 등급)' : '(2/2 실측)'}`}
    >
      {step === 1 ? (
        <InspectionStep originalPrice={originalPrice} onComplete={handleInspection} />
      ) : (
        <MeasurementStep onComplete={handleMeasurement} />
      )}
    </Modal>
  )
}
