/**
 * SMS 알림 템플릿
 * WHY: V2 notification_logs 패턴 기반 SMS 메시지 생성
 * HOW: 이벤트별 템플릿 함수
 * WHERE: 위탁 상태 변경 시 SMS 발송에서 사용
 */

export function consignmentReceivedTemplate(params: {
  sellerName: string
  productName: string
}): string {
  return `[TF] ${params.sellerName}님, ${params.productName} 위탁 접수가 완료되었습니다. 검수 후 결과를 안내드리겠습니다.`
}

export function consignmentApprovedTemplate(params: {
  sellerName: string
  productName: string
  price: number
}): string {
  return `[TF] ${params.sellerName}님, ${params.productName} 검수 완료. 판매 예정가: ${params.price.toLocaleString()}원. 승인해주세요.`
}

export function consignmentCompletedTemplate(params: {
  sellerName: string
  productName: string
  productNumber: string
}): string {
  return `[TF] ${params.sellerName}님, ${params.productName}(${params.productNumber}) 상품 등록 완료되었습니다.`
}

export function consignmentRejectedTemplate(params: {
  sellerName: string
  productName: string
  reason?: string
}): string {
  const reasonText = params.reason ? ` 사유: ${params.reason}` : ''
  return `[TF] ${params.sellerName}님, ${params.productName} 위탁이 반려되었습니다.${reasonText}`
}

export function settlementPaidTemplate(params: {
  sellerName: string
  amount: number
}): string {
  return `[TF] ${params.sellerName}님, 정산금 ${params.amount.toLocaleString()}원이 입금되었습니다.`
}
