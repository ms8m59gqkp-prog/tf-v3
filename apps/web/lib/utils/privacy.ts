/**
 * 개인정보 마스킹 유틸 (L1 Business Layer)
 * WHY: 공개 API 응답에서 민감 정보 보호
 * HOW: 이름/전화번호 등을 부분 가림 처리
 * WHERE: 공개 service (order-hold, consignment-adjust)에서 호출
 */

/** 이름 마스킹: "김명철" → "김*철", "김명" → "김*", "김" → "*" */
export function maskName(name: string | null | undefined): string {
  if (!name || name.length === 0) return ''
  if (name.length === 1) return '*'
  if (name.length === 2) return name[0] + '*'
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
}

/** 전화번호 마스킹: "010-1234-5678" → "010-****-5678" */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  return phone.replace(/(\d{2,3})-(\d{3,4})-(\d{4})/, '$1-****-$3')
}
