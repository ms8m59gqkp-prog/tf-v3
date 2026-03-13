/**
 * 매출 업로드 + 위탁 감지 클라이언트
 * WHY: 매출 데이터 업로드 및 위탁 감지를 한 화면에서 관리
 * HOW: SalesUploadPanel + 위탁 감지 API + 세션 삭제
 * WHERE: sales/page.tsx
 */
'use client'

import { useState, useCallback } from 'react'
import { Search, Trash2 } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useToast } from '@/components/Toast'
import Button from '@/components/Button'
import SalesUploadPanel from './SalesUploadPanel'

interface DetectResult { matched: number; unmatched: number; details: Record<string, unknown>[] }
interface UploadSession { sessionId: string; inserted: number; uploadedAt: string }

export default function SalesClient() {
  const { toast } = useToast()
  const [sessions, setSessions] = useState<UploadSession[]>([])
  const [batchId, setBatchId] = useState('')
  const [detectResult, setDetectResult] = useState<DetectResult | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleUploadComplete = useCallback((sessionId: string, inserted: number) => {
    setSessions((prev) => [{ sessionId, inserted, uploadedAt: new Date().toISOString().slice(0, 19) }, ...prev])
  }, [])

  const handleDetect = useCallback(async () => {
    if (!batchId.trim() || detecting) return
    setDetecting(true)
    try {
      const result = await api.get<DetectResult>(
        `/api/admin/sales/detect-consignment?batchId=${encodeURIComponent(batchId)}`,
      )
      setDetectResult(result)
      toast(`위탁 감지 완료: ${result.matched}건 매칭`, 'success')
    } catch { toast('위탁 감지 실패', 'error') }
    finally { setDetecting(false) }
  }, [batchId, detecting, toast])

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    if (deleting) return
    setDeleting(true)
    try {
      const res = await api.delete<{ deleted: number }>(`/api/admin/sales/${sessionId}`)
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId))
      toast(`${res.deleted}건 삭제 완료`, 'success')
    } catch { toast('세션 삭제 실패', 'error') }
    finally { setDeleting(false) }
  }, [deleting, toast])

  return (
    <div className="space-y-6">
      <SalesUploadPanel onComplete={handleUploadComplete} />

      {/* 위탁 감지 */}
      <section className="rounded-lg border border-gray-200 p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">위탁 감지</h3>
        <div className="flex items-end gap-3">
          <input
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            placeholder="Batch ID 입력"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <Button onClick={handleDetect} loading={detecting} className="gap-1">
            <Search className="h-4 w-4" /> 감지
          </Button>
        </div>
        {detectResult && (
          <p className="mt-2 text-sm text-gray-600">
            매칭 {detectResult.matched}건 / 미매칭 {detectResult.unmatched}건
          </p>
        )}
      </section>

      {sessions.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">업로드 세션</h3>
          {sessions.map((s) => (
            <div key={s.sessionId} className="flex items-center justify-between rounded border border-gray-100 px-3 py-2 text-sm">
              <span>{s.sessionId.slice(0, 8)}… — {s.inserted}건 ({s.uploadedAt})</span>
              <button onClick={() => handleDeleteSession(s.sessionId)} disabled={deleting} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
