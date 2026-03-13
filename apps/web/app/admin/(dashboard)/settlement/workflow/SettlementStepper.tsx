/**
 * 6단계 스텝 인디케이터
 * WHY: V2 동일 — 현재 정산 진행 단계 표시
 * HOW: step 번호 → 활성/완료/대기 상태
 * WHERE: WorkflowClient.tsx
 */
'use client'

import clsx from 'clsx'

const STEPS = [
  '매출장 업로드',
  '네이버 정산',
  '매칭',
  '대기열',
  '지급',
  '검토',
] as const

interface SettlementStepperProps {
  current: number
}

export default function SettlementStepper({ current }: SettlementStepperProps) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, idx) => {
        const step = idx + 1
        const done = step < current
        const active = step === current
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={clsx(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                done && 'bg-green-500 text-white',
                active && 'bg-amber-500 text-white',
                !done && !active && 'bg-gray-200 text-gray-500',
              )}
            >
              {done ? '✓' : step}
            </div>
            <span
              className={clsx(
                'text-sm',
                active ? 'font-semibold text-gray-900' : 'text-gray-500',
              )}
            >
              {label}
            </span>
            {idx < STEPS.length - 1 && (
              <div className={clsx('h-0.5 w-8', done ? 'bg-green-400' : 'bg-gray-200')} />
            )}
          </div>
        )
      })}
    </div>
  )
}
