/**
 * 배열 분할 (Supabase .in() 제한 대응)
 * WHY: Supabase .in() 약 100개 제한 → 초과 시 자동 분할
 * HOW: chunkArray(array, size) → T[][]
 * WHERE: 모든 리포지토리에서 .in() 사용 시
 */

/**
 * 배열을 지정된 크기의 청크로 분할한다.
 */
export function chunkArray<T>(array: readonly T[], size: number): T[][] {
  if (size <= 0) throw new Error('chunk size must be positive')
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
