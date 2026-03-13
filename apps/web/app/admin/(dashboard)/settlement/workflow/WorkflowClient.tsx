/**
 * 정산 워크플로우 클라이언트
 * WHY: 6단계 정산 프로세스 통합 관리
 * HOW: step 상태로 각 Step 컴포넌트 전환
 * WHERE: settlement/workflow/page.tsx
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SettlementStepper from './SettlementStepper'
import Step1_SalesLedger from './Step1_SalesLedger'
import Step2_NaverSettle from './Step2_NaverSettle'
import Step3_Matching from './Step3_Matching'
import Step4_Queue from './Step4_Queue'
import Step5_Payout from './Step5_Payout'
import Step6_Review from './Step6_Review'

export default function WorkflowClient() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [settlementId, setSettlementId] = useState('')

  function renderStep() {
    switch (step) {
      case 1:
        return <Step1_SalesLedger onComplete={() => setStep(2)} />
      case 2:
        return <Step2_NaverSettle onComplete={() => setStep(3)} />
      case 3:
        return <Step3_Matching onComplete={() => setStep(4)} />
      case 4:
        return <Step4_Queue onComplete={() => setStep(5)} />
      case 5:
        return <Step5_Payout onComplete={(id) => { setSettlementId(id); setStep(6) }} />
      case 6:
        return (
          <Step6_Review
            settlementId={settlementId}
            onComplete={() => router.push('/admin/settlement')}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <SettlementStepper current={step} />
      <div className="rounded-lg bg-white p-6 shadow">
        {renderStep()}
      </div>
    </div>
  )
}
