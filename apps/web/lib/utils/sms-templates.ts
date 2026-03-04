/**
 * SMS 메시지 템플릿 빌더
 * WHY: V2 전화번호 하드코딩 + 메시지 포맷 분산
 * HOW: 템플릿 타입 + buildSmsMessage 함수 (환경변수 기반)
 * WHERE: notification 서비스
 */

export type SmsTemplate =
  | 'CONSIGNMENT_RECEIVED'
  | 'CONSIGNMENT_APPROVED'
  | 'CONSIGNMENT_REJECTED'
  | 'SETTLEMENT_CONFIRMED'
  | 'ORDER_SHIPPED'

const TEMPLATES: Record<SmsTemplate, string> = {
  CONSIGNMENT_RECEIVED:
    '[트레이딩플로어] {{sellerName}}님, 위탁 상품이 접수되었습니다. 문의: {{warehousePhone}}',
  CONSIGNMENT_APPROVED:
    '[트레이딩플로어] {{sellerName}}님, 위탁 상품 검수가 완료되어 승인되었습니다.',
  CONSIGNMENT_REJECTED:
    '[트레이딩플로어] {{sellerName}}님, 위탁 상품 검수 결과 반려되었습니다. 문의: {{warehousePhone}}',
  SETTLEMENT_CONFIRMED:
    '[트레이딩플로어] {{sellerName}}님, {{period}} 정산이 확정되었습니다. 정산액: {{amount}}',
  ORDER_SHIPPED:
    '[트레이딩플로어] {{customerName}}님, 주문하신 상품이 발송되었습니다. 운송장: {{trackingNumber}}',
}

/**
 * 템플릿과 파라미터를 조합하여 SMS 메시지 생성.
 * warehousePhone 등 모든 값은 params로 전달 (하드코딩 금지).
 */
export function buildSmsMessage(
  template: SmsTemplate,
  params: Record<string, string>,
): string {
  let message = TEMPLATES[template]
  for (const [key, value] of Object.entries(params)) {
    message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return message
}
