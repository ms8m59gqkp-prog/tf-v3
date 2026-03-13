/**
 * 매출 섹션 탭 레이아웃
 * WHY: 매출 관리 / ERP 연동 / 매출 장부 간 탭 네비게이션 제공
 * HOW: usePathname 기반 활성 탭 + Link 전환
 * WHERE: /admin/sales/* 모든 하위 페이지
 */
'use client'

import { type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const TABS = [
  { href: '/admin/sales', label: '매출 관리' },
  { href: '/admin/sales/erp', label: 'ERP 연동' },
  { href: '/admin/sales/ledger', label: '매출 장부' },
] as const

export default function SalesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-4">
      <nav className="flex gap-6 border-b border-gray-200">
        {TABS.map(({ href, label }) => {
          const active = href === '/admin/sales'
            ? pathname === href
            : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'pb-2 text-sm font-medium transition-colors',
                active
                  ? 'border-b-2 border-amber-500 text-amber-600'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {label}
            </Link>
          )
        })}
      </nav>
      {children}
    </div>
  )
}
