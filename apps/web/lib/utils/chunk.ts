/**
 * 배열 청크 분할 유틸리티
 * WHY: V2 _batch_progress 배치 처리에서 대용량 배열 분할 필요
 * HOW: 배열을 지정 크기의 청크로 분할
 * WHERE: 배치 업로드, 대량 처리에서 사용
 */

export function chunk<T>(array: T[], size: number): T[][] {
  if (size <= 0) throw new Error('청크 크기는 1 이상이어야 합니다')
  const result: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  return result
}
