# 프로젝트 작업 규칙

- 문서와 코드 주석은 자연스럽고 간결한 한국어로 작성한다.
- 화면에 보이는 문구는 README의 `용어` 표를 따른다. 기록을 남기는 행동은 `도장 찍기`다.
- 그룹 데이터는 서버와 PostgreSQL RLS에서 모두 `ACTIVE` 멤버십을 확인한다.
- `SUPABASE_SECRET_KEY` 같은 관리자 키를 브라우저 코드나 `NEXT_PUBLIC_*` 환경변수에 넣지 않는다.
- 서버의 사용자 인증에는 `getSession()` 결과를 신뢰하지 않고 `getClaims()` 또는 `getUser()`를 사용한다.
- 외부 코딩 플랫폼은 서버에서 긁지 않는다. 자동 연동은 사용자가 직접 연 페이지에서 확장 프로그램이 하고, 읽는 것은 **본인이 제출한 코드와 채점 결과**, 그리고 문제를 가리키는 **식별 정보(번호·제목·난이도)**뿐이다. 문제 지문·모범답안 같은 플랫폼 콘텐츠는 읽지도 저장하지도 않고, 사용자의 GitHub 저장소에도 올리지 않는다. **예외는 하나다** — 프로그래머스 코딩테스트 연습 문제의 지문. 프로그래머스가 공식 안내(고객센터 '프로그래머스의 문제를 외부에 게시할 수 있나요?')에서 광고 없는 GitHub 같은 비상업·비영리 게시를 허용하고 출처 표기를 요구하므로, 분류가 `코딩테스트 연습`이고 별도 저작권 표시가 없을 때만 확장이 읽어 사용자 저장소 README에 출처와 함께 올린다. 테스트케이스·모범답안은 읽지 않고, 지문은 우리 서버로 보내지도 저장하지도 않는다(저장소에 올리는 `push-code`에만 싣고 도장을 찍는 `submit-code`에는 싣지 않는다). 다른 플랫폼은 그런 허락을 확인하기 전에는 같은 일을 하지 않는다.
- 자동 감지는 사용자가 연 페이지에서 사용자가 누른 제출과 그 결과만 보고, 플랫폼에 요청을 따로 보내지 않는다(제출 기록 조회·문제 불러오기 금지). 약관의 `크롤링`·`스크래핑` 금지 조항만으로는 빼지 않는다 — 같은 조항이 프로그래머스·LeetCode 모두에 있고, 이 방식은 그 조항이 겨누는 일이 아니다. 약관이 브라우저 확장이나 외부 도구 자체를 금지하거나 운영자가 멈춰 달라고 한 플랫폼은 화면 캡처와 수동 검수로 돌린다. 대회 제출은 감지하지 않는다.
- 기능 변경 시 `pnpm lint`, `pnpm typecheck`, `pnpm build`를 실행한다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
