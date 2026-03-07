/**
 * 엑셀 파싱 유틸리티
 * WHY: V2 excel_uploads 기반 엑셀 데이터 처리
 * HOW: 행/열 변환, 헤더 매핑
 * WHERE: 엑셀 업로드 API에서 사용
 */

export interface ExcelRow {
  [key: string]: string | number | boolean | null
}

export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_가-힣]/g, '')
}

export function mapHeaders(
  headers: string[],
  mapping: Record<string, string>
): Record<string, number> {
  const result: Record<string, number> = {}
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header)
    const mapped = mapping[normalized]
    if (mapped) {
      result[mapped] = index
    }
  })
  return result
}

export function parseExcelDate(serial: number): Date {
  const utcDays = Math.floor(serial - 25569)
  return new Date(utcDays * 86400 * 1000)
}

export function isEmptyRow(row: ExcelRow): boolean {
  return Object.values(row).every(
    (v) => v === null || v === undefined || v === ''
  )
}
