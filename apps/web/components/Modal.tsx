/**
 * 모달 래퍼 컴포넌트
 * WHY: alert()/confirm() 금지 — 커스텀 모달 사용
 * HOW: Portal + backdrop + ESC 닫기
 * WHERE: 검수, 발송, 매칭 등 모달 UI
 */
'use client'

import { type ReactNode, useEffect, useCallback, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'

type ModalSize = 'sm' | 'md' | 'lg'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: ModalSize
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
}

const subscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  if (!open || !mounted) return null

  return createPortal(
    <div
      className={clsx(
        'fixed inset-0 z-50 flex items-center justify-center',
        'bg-black/50 transition-opacity duration-200',
        open ? 'opacity-100' : 'opacity-0',
      )}
      onClick={onClose}
    >
      <div
        className={clsx(
          'w-full rounded-lg bg-white p-6 shadow-xl',
          'transition-transform duration-200',
          SIZE_CLASSES[size],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  )
}
