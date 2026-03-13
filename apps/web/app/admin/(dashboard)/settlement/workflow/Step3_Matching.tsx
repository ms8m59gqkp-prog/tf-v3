/**
 * Step 3: 자동매칭 + 수동매칭
 * WHY: 3-tier 자동매칭 실행 후 미매칭건 수동 처리
 * HOW: POST /matching/auto → 결과 표시 → ManualMatchPanel
 * WHERE: WorkflowClient.tsx
 */
'use client'

import { useState } from 'react'
import Button from '@/components/Button'
import { api, APIError } from '@/lib/api/client'
import { useToast } from '@/components/Toast'
import ManualMatchPanel from './ManualMatchPanel'

import type { UnmatchedItem } from './ManualMatchPanel'

interface MatchResult {
  matched: number
  review: number
  unmatched: number
  unmatchedSales?: UnmatchedItem[]
  unmatchedNaver?: UnmatchedItem[]
}

interface Step3Props {
  onComplete: () => void
}

export default function Step3_Matching({ onComplete }: Step3Props) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<MatchResult | null>(null)
  const { toast } = useToast()

  async function runAutoMatch() {
    setRunning(true)
    try {
      const res = await api.post<MatchResult>('/api/admin/matching/auto', {})
      setResult(res)
      toast(`자동매칭 완료: ${res.matched}건 매칭`, 'success')
    } catch (err) {
      toast(err instanceof APIError ? err.message : '자동매칭 실패', 'error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-4">
      {!result ? (
        <div className="text-center">
          <p className="mb-4 text-sm text-gray-600">자동매칭을 실행하세요</p>
          <Button loading={running} onClick={runAutoMatch}>
            자동매칭 실행
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{result.matched}</p>
              <p className="text-xs text-green-600">매칭 완료</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{result.review}</p>
              <p className="text-xs text-amber-600">검토 필요</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{result.unmatched}</p>
              <p className="text-xs text-red-600">미매칭</p>
            </div>
          </div>

          {(result.review > 0 || result.unmatched > 0) && (
            <ManualMatchPanel
              salesItems={result.unmatchedSales ?? []}
              naverItems={result.unmatchedNaver ?? []}
              onMatchComplete={() => runAutoMatch()}
            />
          )}

          <div className="flex justify-end">
            <Button onClick={onComplete}>다음 단계</Button>
          </div>
        </>
      )}
    </div>
  )
}
