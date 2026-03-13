/**
 * 사진 관리 메인 클라이언트
 * WHY: 업로드/편집 탭 전환 + 사진 목록 상태 관리
 * HOW: useState 탭 + PhotoUploadPanel/PhotoEditPanel 조건부 렌더링
 * WHERE: photos/page.tsx
 */
'use client'

import { useState, useCallback } from 'react'
import clsx from 'clsx'
import { Upload, Wand2 } from 'lucide-react'
import { useToast } from '@/components/Toast'
import type { PhotoUpload } from '@/lib/types/domain/photo'
import PhotoUploadPanel from './PhotoUploadPanel'
import PhotoEditPanel from './PhotoEditPanel'
import PhotoGrid from './PhotoGrid'

type Tab = 'upload' | 'edit'

const TABS: { key: Tab; label: string; icon: typeof Upload }[] = [
  { key: 'upload', label: '업로드', icon: Upload },
  { key: 'edit', label: '편집/매칭', icon: Wand2 },
]

export default function PhotoClient() {
  const [tab, setTab] = useState<Tab>('upload')
  const [photos, setPhotos] = useState<PhotoUpload[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  const handleUploadComplete = useCallback((uploaded: PhotoUpload[]) => {
    setPhotos((prev) => [...prev, ...uploaded])
    toast(`${uploaded.length}건 업로드 완료`, 'success')
  }, [toast])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">사진 관리</h2>

      {/* 탭 네비게이션 */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              'flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              tab === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* 패널 */}
      {tab === 'upload' && (
        <PhotoUploadPanel onUploadComplete={handleUploadComplete} />
      )}
      {tab === 'edit' && (
        <PhotoEditPanel
          selectedIds={Array.from(selectedIds)}
          photos={photos}
        />
      )}

      {/* 사진 그리드 */}
      {photos.length > 0 && (
        <PhotoGrid
          photos={photos}
          selectedIds={selectedIds}
          onToggle={toggleSelect}
        />
      )}
    </div>
  )
}
