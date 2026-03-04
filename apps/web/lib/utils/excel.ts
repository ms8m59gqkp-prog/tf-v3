/**
 * 엑셀 파일 안전 파싱 + 헤더 검증
 * WHY: V2 엑셀 업로드 시 헤더 불일치 → 데이터 누락
 * HOW: parseExcelSafe (에러 래핑) + validateHeaders (필수 컬럼 확인)
 * WHERE: 매출 업로드, 네이버 정산 업로드
 */
import * as XLSX from 'xlsx'

/**
 * ArrayBuffer를 안전하게 파싱하여 첫 번째 워크시트 반환.
 * 파싱 실패 시 의미 있는 에러 메시지를 포함한다.
 */
export function parseExcelSafe(buffer: ArrayBuffer): XLSX.WorkSheet {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      throw new Error('워크시트가 없는 엑셀 파일입니다')
    }
    const sheet = workbook.Sheets[firstSheetName]
    if (!sheet) {
      throw new Error(`워크시트 "${firstSheetName}"를 읽을 수 없습니다`)
    }
    return sheet
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(`엑셀 파싱 실패: ${err.message}`)
    }
    throw new Error('엑셀 파싱 실패: 알 수 없는 오류')
  }
}

/**
 * 워크시트를 JSON 배열로 변환.
 */
export function sheetToJson<T extends Record<string, unknown>>(
  sheet: XLSX.WorkSheet,
): T[] {
  return XLSX.utils.sheet_to_json<T>(sheet, { defval: '' })
}

/**
 * 워크시트의 헤더가 필수 컬럼을 모두 포함하는지 검증.
 */
export function validateHeaders(
  sheet: XLSX.WorkSheet,
  requiredHeaders: readonly string[],
): { valid: boolean; missing: string[] } {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1')
  const headers: string[] = []

  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col })
    const cell = sheet[cellAddress] as XLSX.CellObject | undefined
    if (cell?.v !== undefined && cell.v !== null) {
      headers.push(String(cell.v).trim())
    }
  }

  const missing = requiredHeaders.filter((h) => !headers.includes(h))
  return { valid: missing.length === 0, missing }
}
