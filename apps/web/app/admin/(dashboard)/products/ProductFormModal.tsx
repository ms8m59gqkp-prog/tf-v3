/**
 * 상품 등록/수정 모달
 * WHY: 상품 CRUD의 Create/Update UI
 * HOW: Modal + FormField + api.post/patch
 * WHERE: ProductClient.tsx, ProductDetailModal.tsx
 */
'use client'

import { useState, type FormEvent } from 'react'
import Modal from '@/components/Modal'
import FormField from '@/components/FormField'
import Button from '@/components/Button'
import { useToast } from '@/components/Toast'
import { api } from '@/lib/api/client'
import { PRODUCT_TYPES, type StProduct } from '@/lib/types/domain/product'

interface ProductFormModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  mode: 'create' | 'edit'
  product?: StProduct
}

type F = Record<'productName' | 'salePrice' | 'brand' | 'category' | 'productCondition' | 'productType' | 'size' | 'color' | 'origin', string>

const initForm = (p?: StProduct): F => ({
  productName: p?.productName ?? '', salePrice: p ? String(p.salePrice) : '',
  brand: p?.brand ?? '', category: p?.category ?? '', productCondition: p?.productCondition ?? '',
  productType: p?.productType ?? '', size: p?.size ?? '', color: p?.color ?? '', origin: p?.origin ?? '',
})

const IC = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500'

export default function ProductFormModal({ open, onClose, onSuccess, mode, product }: ProductFormModalProps) {
  const [form, setForm] = useState<F>(() => initForm(product))
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  function set(key: keyof F, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (!form.productName.trim()) { toast('상품명을 입력해주세요', 'error'); return }
    const price = Math.max(0, Number(form.salePrice) || 0)

    const body: Record<string, unknown> = { productName: form.productName.trim(), salePrice: price }
    if (form.brand) body.brand = form.brand
    if (form.category) body.category = form.category
    if (form.productCondition) body.productCondition = form.productCondition
    if (form.productType) body.productType = form.productType
    if (form.size) body.size = form.size
    if (form.color) body.color = form.color
    if (form.origin) body.origin = form.origin

    setSubmitting(true)
    try {
      if (mode === 'create') await api.post('/api/admin/products', body)
      else await api.patch(`/api/admin/products/${product!.id}`, body)
      toast(mode === 'create' ? '상품 등록 완료' : '상품 수정 완료', 'success')
      onSuccess()
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : '저장 실패', 'error')
    } finally { setSubmitting(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={mode === 'create' ? '상품 등록' : '상품 수정'} size="lg">
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        {([['productName', '상품명 *'], ['salePrice', '판매가 *', 'number'], ['brand', '브랜드'],
          ['category', '카테고리'], ['productCondition', '상태'], ['size', '사이즈'],
          ['color', '색상'], ['origin', '원산지']] as const).map(([k, label, type]) => (
          <FormField key={k} label={label}>
            <input className={IC} type={type ?? 'text'} min={type === 'number' ? '0' : undefined}
              value={form[k]} onChange={(e) => set(k, e.target.value)} />
          </FormField>
        ))}
        <FormField label="유형">
          <select className={IC} value={form.productType} onChange={(e) => set('productType', e.target.value)}>
            <option value="">선택</option>
            {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t === 'consignment' ? '위탁' : '재고'}</option>)}
          </select>
        </FormField>
        <div className="col-span-2 flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>취소</Button>
          <Button type="submit" loading={submitting}>{mode === 'create' ? '등록' : '저장'}</Button>
        </div>
      </form>
    </Modal>
  )
}
