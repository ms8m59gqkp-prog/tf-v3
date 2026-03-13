/**
 * 셀러 상세 + 활동이력 모달
 * WHY: 셀러 정보 확인 + 수정 진입점
 * HOW: useApi로 셀러 상세 + history 조회
 * WHERE: sellers/SellerSettlementClient.tsx
 */
'use client'

import { useState } from 'react'
import { useApi } from '@/hooks/useApi'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import SellerEditFields from './SellerEditFields'
import type { Seller } from '@/lib/types/domain/seller'

interface SellerDetailModalProps {
  sellerId: string
  onClose: () => void
}

interface SellerHistory {
  consignmentCount: number
  orderCount: number
  settlementCount: number
}

export default function SellerDetailModal({ sellerId, onClose }: SellerDetailModalProps) {
  const [editing, setEditing] = useState(false)
  const { data: seller, mutate } = useApi<Seller>(`/api/admin/sellers/${sellerId}`)
  const { data: history } = useApi<SellerHistory>(`/api/admin/sellers/${sellerId}/history`)

  const handleSaved = () => {
    setEditing(false)
    void mutate()
  }

  return (
    <Modal open onClose={onClose} title="셀러 상세" size="lg">
      {!seller ? (
        <p className="text-sm text-gray-500">로딩 중...</p>
      ) : editing ? (
        <SellerEditFields seller={seller} onSave={handleSaved} onCancel={() => setEditing(false)} />
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Dt label="셀러코드" value={seller.sellerCode} />
            <Dt label="이름" value={seller.name} />
            <Dt label="전화" value={seller.phone} />
            <Dt label="이메일" value={seller.email ?? '-'} />
            <Dt label="은행" value={seller.bankName ?? '-'} />
            <Dt label="계좌" value={seller.bankAccount ?? '-'} />
            <Dt label="등급" value={seller.sellerTier ?? '-'} />
            <Dt label="상태" value={seller.status ?? '-'} />
            <Dt label="수수료율" value={seller.commissionRate != null ? `${(seller.commissionRate * 100).toFixed(0)}%` : '-'} />
          </dl>

          {history && (
            <div className="rounded-md bg-gray-50 p-3">
              <h4 className="mb-2 text-sm font-medium text-gray-700">활동 이력</h4>
              <div className="flex gap-6 text-sm text-gray-600">
                <span>위탁 {history.consignmentCount}건</span>
                <span>주문 {history.orderCount}건</span>
                <span>정산 {history.settlementCount}건</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditing(true)}>수정</Button>
            <Button onClick={onClose}>닫기</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function Dt({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-medium text-gray-600">{label}</dt>
      <dd className="text-gray-900">{value}</dd>
    </>
  )
}
