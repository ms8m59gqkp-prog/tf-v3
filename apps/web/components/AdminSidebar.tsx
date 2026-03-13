/**
 * 어드민 사이드바 네비게이션
 * WHY: 페이지 간 이동
 * HOW: lucide-react 아이콘 + Next.js Link + usePathname 활성 상태
 * WHERE: app/admin/(dashboard)/layout.tsx
 */
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Calculator,
  Camera,
  Tag,
  Bell,
  BarChart3,
  Database,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { label: '대시보드', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: '위탁 관리', href: '/admin/consignments', icon: Package },
  { label: '주문 관리', href: '/admin/orders', icon: ShoppingCart },
  { label: '정산', href: '/admin/settlement', icon: Calculator },
  { label: '사진 관리', href: '/admin/photos', icon: Camera },
  { label: '상품 관리', href: '/admin/products', icon: Tag },
  { label: '알림', href: '/admin/notifications', icon: Bell },
  { label: '매출', href: '/admin/sales', icon: BarChart3 },
  { label: '시세 DB', href: '/admin/database', icon: Database },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex w-60 flex-col border-r border-gray-200 bg-white">
      {/* 로고 */}
      <div className="flex h-16 items-center border-b border-gray-200 px-5">
        <span className="text-xl font-bold text-amber-700">TF Admin</span>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = pathname.startsWith(href)

            return (
              <li key={href}>
                <Link
                  href={href}
                  className={clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-amber-50 text-amber-800'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                  )}
                >
                  <Icon
                    size={18}
                    className={clsx(
                      isActive ? 'text-amber-600' : 'text-gray-400',
                    )}
                  />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
