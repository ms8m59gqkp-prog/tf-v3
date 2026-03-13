/**
 * 정산 엑셀 내보내기 서비스 (L1 Business Layer)
 * WHY: 정산 상세를 2-시트 엑셀로 변환 — 건별 상세 + 셀러별 요약
 * HOW: settlement.repo.findById → xlsx 라이브러리로 워크북 생성
 * WHERE: POST /api/admin/settlements/export
 */
import * as XLSX from 'xlsx'
import { AppError } from '../errors'
import * as settlementRepo from '../db/repositories/settlement.repo'

/** 엑셀 내보내기 결과 */
export interface ExportResult {
  fileName: string
  buffer: Buffer
}

/** 정산 엑셀 내보내기 */
export async function exportToExcel(settlementId: string): Promise<ExportResult> {
  const result = await settlementRepo.findById(settlementId)
  if (result.error !== null) {
    throw new AppError('NOT_FOUND', `정산 ID ${settlementId} 조회 실패: ${result.error}`)
  }

  const settlement = result.data
  if (!settlement.settlement_items || settlement.settlement_items.length === 0) {
    throw new AppError('VALIDATION', `정산 ID ${settlementId}에 정산 항목이 없습니다`)
  }

  const sellerName = settlement.sellers?.name ?? '알수없음'

  // Sheet1: 건별 상세
  const detailRows = settlement.settlement_items.map((item) => ({
    '상품명': item.sold_items.productName,
    '상품번호': item.sold_items.productNumber ?? '',
    '판매가': item.sold_items.salePrice,
    '수량': item.sold_items.quantity,
    '수수료율(%)': Math.round(settlement.commissionRate * 100),
    '수수료': Math.round(item.sold_items.salePrice * settlement.commissionRate),
    '지급액': item.sold_items.salePrice - Math.round(
      item.sold_items.salePrice * settlement.commissionRate,
    ),
  }))
  const detailSheet = XLSX.utils.json_to_sheet(detailRows)

  // Sheet2: 셀러별 요약 (단건 정산이므로 1행)
  const summaryRows = [{
    '셀러명': sellerName,
    '건수': settlement.itemCount,
    '총 판매액': settlement.totalSales,
    '총 수수료': settlement.commissionAmount,
    '반품 차감': settlement.returnDeduction,
    '순 지급액': settlement.settlementAmount,
    '정산기간': `${settlement.settlementPeriodStart} ~ ${settlement.settlementPeriodEnd}`,
    '상태': settlement.status ?? '',
  }]
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, detailSheet, '건별 상세')
  XLSX.utils.book_append_sheet(wb, summarySheet, '셀러별 요약')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const dateStr = settlement.settlementPeriodStart.replace(/-/g, '')
  const fileName = `정산_${sellerName}_${dateStr}.xlsx`

  console.log(`[settlement-export] 엑셀 생성 완료: ${fileName} (${detailRows.length}건)`)
  return { fileName, buffer: buf }
}
