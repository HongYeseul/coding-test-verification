# 프로젝트 작업 규칙

- 문서와 코드 주석은 자연스럽고 간결한 한국어로 작성한다.
- 그룹 데이터는 서버와 PostgreSQL RLS에서 모두 `ACTIVE` 멤버십을 확인한다.
- `SUPABASE_SECRET_KEY` 같은 관리자 키를 브라우저 코드나 `NEXT_PUBLIC_*` 환경변수에 넣지 않는다.
- 서버의 사용자 인증에는 `getSession()` 결과를 신뢰하지 않고 `getClaims()` 또는 `getUser()`를 사용한다.
- 외부 코딩 플랫폼은 공식 API만 자동 연동한다. 크롤링을 금지한 플랫폼은 수동 검수로 처리한다.
- 기능 변경 시 `pnpm lint`, `pnpm typecheck`, `pnpm build`를 실행한다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
