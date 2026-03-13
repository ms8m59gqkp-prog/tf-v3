/**
 * 주문 보류 모달
 * WHY: 보류 사유 입력 + 고객 동의 상태 추적
 * HOW: hold API 호출 + 동의 상태 표시
 * WHERE: OrderClient.tsx
 */
'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import FormField from '@/components/FormField'
import { useToast } from '@/components/Toast'

interface HoldModalProps {
  orderId: string
  itemId: string
  open: boolean
  onClose: () => void
  onHold: (id: string, itemId: string, reason: string, price: number) => Promise<void>
}

export default function HoldModal({ orderId, itemId, open, onClose, onHold }: HoldModalProps) {
  const [reason, setReason] = useState('')
  const [price, setPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  async function handleSubmit() {
    if (!reason.trim()) {
      toast('보류 사유를 입력하세요', 'error')
      return
    }
    setSubmitting(true)
    try {
      await onHold(orderId, itemId, reason, Math.max(0, Number(price) || 0))
      toast('보류 처리 완료', 'success')
      setReason('')
      setPrice('')
      onClose()
    } catch {
      toast('보류 처리 실패', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="주문 보류">
      <div className="space-y-4">
        <FormField label="보류 사유">
          <textarea
            className="w-full rounded-md border border-gray-300 p-2 text-sm"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="보류 사유를 입력하세요"
          />
        </FormField>
        <FormField label="조정 가격">
          <input
            type="number"
            min="0"
            className="w-full rounded-md border border-gray-300 p-2 text-sm"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
          />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button variant="danger" loading={submitting} onClick={handleSubmit}>
            보류 처리
          </Button>
        </div>
      </div>
    </Modal>
  )
}
