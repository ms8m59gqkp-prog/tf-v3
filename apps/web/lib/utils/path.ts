/**
 * 파일 경로 안전 검증
 * WHY: Path Traversal + symlink 공격 방지 (SEC-03)
 * HOW: basename으로 디렉토리 탈출 차단 + realpathSync로 symlink 해석
 * WHERE: 파일 업로드 라우트
 */
import path from 'path'
import fs from 'fs'

/**
 * 사용자 입력 경로를 안전하게 검증한다.
 * basePath 밖으로의 경로 탈출(../, symlink 등)을 차단한다.
 */
export function sanitizePath(basePath: string, userInput: string): string {
  const fileName = path.basename(userInput)
  const fullPath = path.join(basePath, fileName)
  const realBase = fs.realpathSync(basePath)
  const realPath = fs.realpathSync(fullPath)
  if (!realPath.startsWith(realBase)) {
    throw new Error(`경로 탈출 시도 차단: ${userInput}`)
  }
  return realPath
}
