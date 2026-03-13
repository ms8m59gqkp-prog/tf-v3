/**
 * 정산 워크플로우 페이지
 * WHY: 6단계 정산 프로세스 관리
 * HOW: Server Component → WorkflowClient
 * WHERE: /admin/settlement/workflow
 */
import WorkflowClient from './WorkflowClient'

export const metadata = { title: 'TF Admin — 정산 워크플로우' }

export default function WorkflowPage() {
  return <WorkflowClient />
}
