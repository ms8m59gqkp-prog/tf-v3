/**
 * 사진 배경제거 + 상품매칭 패널
 * WHY: 선택된 사진에 대한 편집/매칭 액션
 * HOW: POST /api/admin/photos/edit, match
 * WHERE: PhotoClient 편집/매칭 탭
 */
'use client'

import { useState } from 'react'
import { Eraser, LinkIcon } from 'lucide-react'
import Button from '@/components/Button'
import { useToast } from '@/components/Toast'
import { api, APIError } from '@/lib/api/client'
import type { PhotoUpload } from '@/lib/types/domain/photo'

interface Props {
  selectedIds: string[]
  photos: PhotoUpload[]
}

interface EditResult { processed: number }
interface MatchResult { matched: number }

export default function PhotoEditPanel({ selectedIds, photos }: Props) {
  const [removing, setRemoving] = useState(false)
  const [matching, setMatching] = useState(false)
  const { toast } = useToast()

  const hasSelection = selectedIds.length > 0

  async function handleRemoveBg() {
    if (removing || !hasSelection) return
    setRemoving(true)
    try {
      const result = await api.post<EditResult>('/api/admin/photos/edit', {
        photoIds: selectedIds,
      })
      toast(`${result.processed}건 배경 제거 완료`, 'success')
    } catch (err) {
      toast(err instanceof APIError ? err.message : '배경 제거 실패', 'error')
    } finally {
      setRemoving(false)
    }
  }

  async function handleMatch() {
    if (matching || !hasSelection) return
    setMatching(true)
    try {
      const groups = selectedIds.map((id) => {
        const photo = photos.find((p) => p.id === id)
        return {
          groupId: id,
          images: [{ fileName: photo?.fileName ?? '', fileUrl: photo?.fileUrl ?? '' }],
        }
      })
      const result = await api.post<MatchResult>('/api/admin/photos/match', {
        photoGroups: groups,
        products: [],
      })
      toast(`${result.matched}건 매칭 완료`, 'success')
    } catch (err) {
      toast(err instanceof APIError ? err.message : '상품 매칭 실패', 'error')
    } finally {
      setMatching(false)
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">편집 / 매칭</h3>
        <span className="text-xs text-gray-500">
          {hasSelection ? `${selectedIds.length}건 선택됨` : '사진을 선택하세요'}
        </span>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleRemoveBg} loading={removing} disabled={!hasSelection}>
          <Eraser className="mr-1.5 h-4 w-4" /> 배경 제거
        </Button>
        <Button variant="secondary" onClick={handleMatch} loading={matching} disabled={!hasSelection}>
          <LinkIcon className="mr-1.5 h-4 w-4" /> 상품 매칭
        </Button>
      </div>
    </div>
  )
}
