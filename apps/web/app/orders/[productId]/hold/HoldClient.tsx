/**
 * 주문보류 동의 클라이언트
 * WHY: 아이템별 동의/거부 처리
 * HOW: GET 토큰 조회 → 아이템별 버튼 → POST 응답
 * WHERE: orders/[productId]/hold/page.tsx
 */
'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Button from '@/components/Button'
import { api, APIError } from '@/lib/api/client'

interface HoldItem { id: string; productName: string; holdReason: string; holdAdjustedPrice: number | null; customerAgreed: boolean | null }

export default function HoldClient() {
  const { productId } = useParams<{ productId: string }>()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [data, setData] = useState<{ items: HoldItem[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [responding, setResponding] = useState<string | null>(null)

  useEffect(() => {
    if (!token) { setError('토큰이 필요합니다'); setLoading(false); return }
    api.get<{ items: HoldItem[] }>(`/api/orders/${productId}/hold?token=${token}`)
      .then(setData)
      .catch((e) => setError(e instanceof APIError ? e.message : '조회 실패'))
      .finally(() => setLoading(false))
  }, [productId, token])

  async function handleRespond(itemId: string, agreed: boolean) {
    setResponding(itemId)
    try {
      await api.post(`/api/orders/${productId}/hold`, { token, itemId, agreed })
      setData((prev) => prev ? {
        ...prev, items: prev.items.map((it) => it.id === itemId ? { ...it, customerAgreed: agreed } : it),
      } : prev)
    } catch (e) {
      setError(e instanceof APIError ? e.message : '응답 실패')
    } finally { setResponding(null) }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">로딩 중...</div>
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>
  if (!data) return null

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="mb-6 text-xl font-bold text-gray-900">주문 보류 확인</h1>
      <div className="space-y-4">
        {data.items.map((item) => (
          <div key={item.id} className="rounded-lg border border-gray-200 p-4">
            <p className="font-medium text-gray-900">{item.productName}</p>
            <p className="mt-1 text-sm text-gray-500">사유: {item.holdReason}</p>
            {item.holdAdjustedPrice != null && (
              <p className="text-sm text-gray-500">조정 가격: {item.holdAdjustedPrice.toLocaleString()}원</p>
            )}
            {item.customerAgreed != null ? (
              <p className={`mt-2 text-sm font-medium ${item.customerAgreed ? 'text-green-600' : 'text-red-600'}`}>
                {item.customerAgreed ? '동의함' : '거부함'}
              </p>
            ) : (
              <div className="mt-3 flex gap-2">
                <Button variant="primary" loading={responding === item.id} onClick={() => handleRespond(item.id, true)}>동의</Button>
                <Button variant="danger" loading={responding === item.id} onClick={() => handleRespond(item.id, false)}>거부</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
