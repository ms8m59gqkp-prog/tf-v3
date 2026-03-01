#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
WEB="$ROOT/apps/web"

# 검사 대상(필요하면 추가/수정)
TARGETS=(
  "$WEB/app"
  "$WEB/lib"
  "$WEB/scripts"
)

fail() { echo "❌ $1"; exit 1; }
warn() { echo "⚠️  $1"; }

echo "== (grep-guards) tf-v3 policy checks =="

# 공통 grep 헬퍼
# -n: 라인표시, -R: 재귀, -I: 바이너리 무시, --exclude-dir: node_modules 등 제외
GREP_BASE=(grep -nRIP --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=coverage)

# 0) 기본 경로 존재 확인
[[ -d "$WEB" ]] || fail "apps/web 경로가 없습니다: $WEB"

# 1) 금지: PostgREST .or(`...`) 템플릿 리터럴 (인젝션 위험)
echo "-- check: forbid .or(\` ... \`)"
if "${GREP_BASE[@]}" "\.or\(\`" "${TARGETS[@]}" >/dev/null 2>&1; then
  "${GREP_BASE[@]}" "\.or\(\`" "${TARGETS[@]}" || true
  fail "금지 패턴 발견: .or(\`... \`)"
fi

# 2) 금지: services에서 NextRequest/NextResponse import (레이어 위반)
echo "-- check: services must not import NextRequest/NextResponse"
if "${GREP_BASE[@]}" "from ['\"]next/server['\"]" "$WEB/lib/services" >/dev/null 2>&1; then
  "${GREP_BASE[@]}" "from ['\"]next/server['\"]" "$WEB/lib/services" || true
  fail "레이어 위반: lib/services 에서 next/server import 발견"
fi

# 3) 금지: 이미지 경로 하드코딩 (/uploads/photos 등)
#    - getPhotoUrl() 헬퍼 사용 강제하려면 이 체크를 유지하세요.
echo "-- check: forbid hardcoded photo paths"
if "${GREP_BASE[@]}" "/uploads/photos" "${TARGETS[@]}" >/dev/null 2>&1; then
  "${GREP_BASE[@]}" "/uploads/photos" "${TARGETS[@]}" || true
  fail "금지 패턴 발견: /uploads/photos 하드코딩"
fi

# 4) 권장(경고): readFileSync/writeFileSync 사용 (서버리스/빌드 환경 이슈)
echo "-- check: discourage readFileSync/writeFileSync"
if "${GREP_BASE[@]}" "\b(readFileSync|writeFileSync)\b" "${TARGETS[@]}" >/dev/null 2>&1; then
  "${GREP_BASE[@]}" "\b(readFileSync|writeFileSync)\b" "${TARGETS[@]}" || true
  warn "fs sync IO 사용 발견(검토 권장)"
fi

# 5) 권장(경고): SELECT * (과다 조회)
echo "-- check: discourage SELECT *"
if "${GREP_BASE[@]}" "SELECT\s+\*" "${TARGETS[@]}" >/dev/null 2>&1; then
  "${GREP_BASE[@]}" "SELECT\s+\*" "${TARGETS[@]}" || true
  warn "SELECT * 패턴 발견(검토 권장)"
fi

echo "✅ (grep-guards) passed"
