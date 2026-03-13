/**
 * 가격조정 클라이언트
 * WHY: 셀러 3선택지 (수락/역제안/거부)
 * HOW: GET 토큰 조회 → 선택 → POST 응답
 * WHERE: consignment/adjust/[token]/page.tsx
 */
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Button from '@/components/Button'
import { api, APIError } from '@/lib/api/client'

type SellerResponse = 'accepted' | 'counter' | 'cancelled'

interface AdjustData { productName: string; customerName: string; suggestedPrice: number }

const LABELS: Record<SellerResponse, string> = { accepted: '수락', counter: '역제안', cancelled: '거부' }

export default function AdjustClient() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<AdjustData | null>(null)
  const [loading, setLoading] = useState(true)
  const [response, setResponse] = useState<SellerResponse | null>(null)
  const [counterPrice, setCounterPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<AdjustData>(`/api/consignment/adjust/${token}`)
      .then(setData)
      .catch((e) => setError(e instanceof APIError ? e.message : '조회 실패'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSubmit() {
    if (!response) return
    if (response === 'counter' && (!counterPrice || Number(counterPrice) <= 0)) {
      setError('역제안 금액을 올바르게 입력하세요')
      return
    }
    setSubmitting(true)
    try {
      await api.post(`/api/consignment/adjust/${token}`, {
        response, ...(response === 'counter' ? { counterPrice: Math.max(0, Number(counterPrice)) } : {}),
      })
      setDone(true)
    } catch (e) {
      setError(e instanceof APIError ? e.message : '제출 실패')
    } finally { setSubmitting(false) }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">로딩 중...</div>
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>
  if (done) return <div className="p-8 text-center text-green-600 font-semibold">응답이 제출되었습니다.</div>
  if (!data) return null

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-6 text-xl font-bold text-gray-900">가격 조정</h1>
      <div className="mb-6 rounded-lg bg-gray-50 p-4 text-sm">
        <p><span className="text-gray-500">상품:</span> {data.productName}</p>
        <p><span className="text-gray-500">고객:</span> {data.customerName}</p>
        <p><span className="text-gray-500">제안 가격:</span> <strong>{data.suggestedPrice.toLocaleString()}원</strong></p>
      </div>
      <div className="mb-4 space-y-2">
        {(Object.keys(LABELS) as SellerResponse[]).map((r) => (
          <label key={r} className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors ${response === r ? 'border-amber-500 bg-amber-50' : 'border-gray-200'}`}>
            <input type="radio" name="response" value={r} checked={response === r} onChange={() => setResponse(r)} className="accent-amber-500" />
            <span className="text-sm font-medium">{LABELS[r]}</span>
          </label>
        ))}
      </div>
      {response === 'counter' && (
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">역제안 금액</label>
          <input type="number" className="w-full rounded-md border border-gray-300 p-2 text-sm" value={counterPrice} onChange={(e) => setCounterPrice(e.target.value)} placeholder="금액 입력" />
        </div>
      )}
      <Button loading={submitting} disabled={!response} onClick={handleSubmit} className="w-full">제출</Button>
    </div>
  )
}
