/**
 * 통계 카드 컴포넌트
 * WHY: 대시보드 KPI 표시
 * HOW: title + value + subtitle + trend
 * WHERE: admin/dashboard
 */

import { TrendingUp, TrendingDown } from 'lucide-react'
import clsx from 'clsx'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: { value: number; positive: boolean }
}

export default function StatCard({ title, value, subtitle, trend }: StatCardProps) {
  return (
    <div className="rounded-lg bg-white p-5 shadow">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>

      {(subtitle || trend) && (
        <div className="mt-2 flex items-center gap-2">
          {trend && (
            <span
              className={clsx(
                'inline-flex items-center gap-0.5 text-sm font-medium',
                trend.positive ? 'text-green-600' : 'text-red-600',
              )}
            >
              {trend.positive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {trend.value}%
            </span>
          )}
          {subtitle && <span className="text-sm text-gray-500">{subtitle}</span>}
        </div>
      )}
    </div>
  )
}
