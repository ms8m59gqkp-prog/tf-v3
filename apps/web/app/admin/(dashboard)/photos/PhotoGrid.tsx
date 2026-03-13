/**
 * 사진 그리드 (썸네일 + 선택)
 * WHY: 업로드된 사진 시각적 표시 및 선택
 * HOW: grid 레이아웃 + 체크박스 토글
 * WHERE: PhotoClient 하단
 */
'use client'

import { Image as ImageIcon } from 'lucide-react'
import clsx from 'clsx'
import type { PhotoUpload } from '@/lib/types/domain/photo'

interface Props {
  photos: PhotoUpload[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
}

export default function PhotoGrid({ photos, selectedIds, onToggle }: Props) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-800">
        업로드된 사진 ({photos.length}건)
      </h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {photos.map((photo) => {
          const selected = selectedIds.has(photo.id)
          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => onToggle(photo.id)}
              className={clsx(
                'flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors',
                selected
                  ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500'
                  : 'border-gray-200 bg-white hover:border-gray-300',
              )}
            >
              {/* 썸네일 또는 아이콘 */}
              <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded bg-gray-50">
                {photo.fileUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.fileUrl}
                    alt={photo.fileName}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <ImageIcon className="h-8 w-8 text-gray-300" />
                )}
              </div>
              {/* 파일명 + 체크 */}
              <div className="flex w-full items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected}
                  readOnly
                  className="h-4 w-4 rounded border-gray-300 text-amber-600"
                />
                <span className="truncate text-xs text-gray-700">
                  {photo.fileName}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
