/**
 * 셀러 수정 필드
 * WHY: 셀러 정보 인라인 수정 폼
 * HOW: FormField + api.patch + submitting guard
 * WHERE: sellers/SellerDetailModal.tsx
 */
'use client'

import { useState } from 'react'
import { api } from '@/lib/api/client'
import { useToast } from '@/components/Toast'
import FormField from '@/components/FormField'
import Button from '@/components/Button'
import { SELLER_STATUSES, SELLER_TIERS } from '@/lib/types/domain/seller'
import type { Seller } from '@/lib/types/domain/seller'

interface SellerEditFieldsProps {
  seller: Seller
  onSave: () => void
  onCancel: () => void
}

export default function SellerEditFields({ seller, onSave, onCancel }: SellerEditFieldsProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: seller.name,
    phone: seller.phone,
    email: seller.email ?? '',
    sellerTier: seller.sellerTier ?? 'general',
    status: seller.status ?? 'active',
    commissionRate: seller.commissionRate ?? 0.25,
  })

  const set = (key: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const inputClass = 'rounded-md border border-gray-300 px-3 py-2 text-sm w-full'

  const handleSave = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await api.patch(`/api/admin/sellers/${seller.id}`, form)
      toast('셀러 정보가 수정되었습니다', 'success')
      onSave()
    } catch {
      toast('수정에 실패했습니다', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <FormField label="이름">
        <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} />
      </FormField>
      <FormField label="전화">
        <input className={inputClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
      </FormField>
      <FormField label="이메일">
        <input className={inputClass} value={form.email} onChange={(e) => set('email', e.target.value)} />
      </FormField>
      <FormField label="등급">
        <select className={inputClass} value={form.sellerTier} onChange={(e) => set('sellerTier', e.target.value)}>
          {SELLER_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </FormField>
      <FormField label="상태">
        <select className={inputClass} value={form.status} onChange={(e) => set('status', e.target.value)}>
          {SELLER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </FormField>
      <FormField label="수수료율 (0~1)">
        <input
          type="number"
          step="0.01"
          min="0"
          max="1"
          className={inputClass}
          value={form.commissionRate}
          onChange={(e) => set('commissionRate', Number(e.target.value))}
        />
      </FormField>
      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onCancel}>취소</Button>
        <Button onClick={handleSave} disabled={submitting}>
          {submitting ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  )
}
