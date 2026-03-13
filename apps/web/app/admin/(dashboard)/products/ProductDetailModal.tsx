/**
 * 상품 상세 + 네이버 내보내기 모달
 * WHY: 상품 상세 조회, 수정 전환, 네이버 내보내기, 비활성화
 * HOW: useApi GET + api.get/delete 액션
 * WHERE: ProductClient.tsx
 */
'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import { useToast } from '@/components/Toast'
import { useApi } from '@/hooks/useApi'
import { api } from '@/lib/api/client'
import type { StProduct } from '@/lib/types/domain/product'
import ProductFormModal from './ProductFormModal'

interface ProductDetailModalProps {
  productId: string
  open: boolean
  onClose: () => void
  onMutated: () => void
}

const buildRows = (p: StProduct) => [
  ['상품명', p.productName], ['판매가', `${p.salePrice.toLocaleString()}원`],
  ['브랜드', p.brand], ['카테고리', p.category], ['상태', p.productCondition],
  ['유형', p.productType], ['사이즈', p.size], ['색상', p.color], ['원산지', p.origin],
  ['활성', p.isActive === false ? '비활성' : '활성'], ['생성일', p.createdAt?.slice(0, 10)],
].map(([label, value]) => ({ label: label as string, value: (value ?? '-') as string }))

export default function ProductDetailModal({ productId, open, onClose, onMutated }: ProductDetailModalProps) {
  const { data: product, isLoading } = useApi<StProduct>(open ? `/api/admin/products/${productId}` : null)
  const [editOpen, setEditOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const { toast } = useToast()

  async function handleExport() {
    if (exporting) return
    setExporting(true)
    try {
      await api.get(`/api/admin/products/${productId}/naver-export`)
      toast('네이버 내보내기 완료', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : '내보내기 실패', 'error')
    } finally { setExporting(false) }
  }

  async function handleDeactivate() {
    if (deactivating) return
    setDeactivating(true)
    try {
      await api.delete(`/api/admin/products/${productId}`)
      toast('상품 비활성화 완료', 'success'); onMutated(); onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : '비활성화 실패', 'error')
    } finally { setDeactivating(false) }
  }

  if (editOpen && product) {
    return (
      <ProductFormModal open mode="edit" product={product}
        onClose={() => setEditOpen(false)} onSuccess={onMutated} />
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="상품 상세" size="lg">
      {isLoading || !product ? (
        <div className="py-8 text-center text-sm text-gray-400">로딩 중...</div>
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {buildRows(product).map((r) => (
              <div key={r.label} className="flex gap-2">
                <dt className="font-medium text-gray-500 w-20 shrink-0">{r.label}</dt>
                <dd className="text-gray-900">{r.value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
            <Button variant="secondary" onClick={() => setEditOpen(true)}>수정</Button>
            <Button variant="secondary" onClick={handleExport} loading={exporting}>네이버 내보내기</Button>
            <Button variant="danger" onClick={handleDeactivate} loading={deactivating}>비활성화</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
