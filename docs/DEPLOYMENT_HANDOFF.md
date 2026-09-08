# 배포 인수인계

마지막 확인: 2026-09-08

## 운영 연결

- GitHub: `HongYeseul/coding-test-verification` (Public, `main`)
- Vercel: `hongyeseuls-projects/coding-test-verification`
- Vercel 프로젝트 ID: `prj_F67rErRW8oBwkLTComzHn4g23qzi`
- 운영 URL: https://coding-test-verification.vercel.app
- Supabase 프로젝트: `dzibporiiexvsndungkx` (`coding-test-verification-seoul`, Free)
- Supabase 리전: Seoul (`ap-northeast-2`)
- Vercel 함수 리전: `vercel.json`의 Seoul (`icn1`) 한 곳. Hobby 무료 플랜을 유지합니다.
- GitHub OAuth 앱: https://github.com/settings/applications/3837795

`main` push 시 Vercel Production에 자동 배포됩니다. GitHub OAuth 제공자는 활성화되어 있으며 Client Secret은 Supabase에만 저장했습니다. Vercel Production에 프로젝트 URL, Publishable Key, 사이트 URL을 등록했습니다. Preview에는 운영 DB 환경변수를 등록하지 않았습니다.

## 인증 주소

- Supabase Site URL: `https://coding-test-verification.vercel.app`
- GitHub OAuth callback: `https://dzibporiiexvsndungkx.supabase.co/auth/v1/callback`. OAuth App은 콜백을 10개까지 등록할 수 있어 리전 이전 중에는 구·신 두 개를 같이 두었습니다. 삭제된 프로젝트를 가리키는 콜백이 아직 하나 남아 있는데, 동작하지 않으므로 정리만 하면 됩니다.
- 허용된 앱 callback: `https://coding-test-verification.vercel.app/auth/callback**`, `http://localhost:3000/auth/callback**`

초대 링크에서 로그인하거나 로그인이 만료되면 원래 경로로 복귀합니다. 초대 대상 확인에는 `auth.identities`의 GitHub 계정과 확인된 이메일을 사용합니다.

## 데이터베이스

SQL Editor 또는 Supabase MCP의 `apply_migration`으로 아래 마이그레이션에 해당하는 스키마와 함수를 적용했습니다.

- `20260904000000_initial_schema.sql`
- `20260905000000_core_workflows.sql`
- `20260905010000_verified_identity_and_roles.sql`
- `20260905020000_invite_codes_and_photos.sql`
- `20260905030000_group_overview.sql`
- `20260905040000_cancel_proof_safely.sql`
- `20260905050000_photo_storage_limit.sql`
- `20260905060000_group_overview_featured_photo.sql`
- `20260907000000_group_overview_week_range.sql`
- `20260907010000_problem_links.sql`
- `20260907020000_member_profiles.sql`
- `20260907030000_group_overview_activity_order.sql`
- `20260907040000_group_overview_stable_order.sql`
- `20260908000000_group_problem_titles.sql`
- `20260909000000_auto_approve_proofs.sql`
- `20260909010000_public_group_board.sql`

적용 버전은 `supabase_migrations.schema_migrations`에도 등록합니다. 기존 마이그레이션을 재실행하지 않고 새 마이그레이션부터 적용합니다.

MCP의 `apply_migration`은 버전을 실행 시각으로 기록하므로 저장소 파일명과 어긋납니다. 적용 후 `schema_migrations`의 해당 행을 파일명의 버전으로 고쳐야 나중에 같은 파일을 다시 적용하지 않습니다.

`20260907000000_group_overview_week_range.sql`은 `get_group_overview`에 인자를 추가하므로 기존 1인자 함수를 지우고 다시 만듭니다. 두 정의가 공존하지 않도록 한 트랜잭션으로 실행하며, 새 코드가 2인자로 호출하기 때문에 `main` 배포보다 먼저 적용해야 합니다.

`20260907010000_problem_links.sql`은 컬럼을 더하지 않고 기존 `problem_url`에 CHECK 제약과 부분 인덱스만 추가합니다. 구버전 코드는 이 컬럼을 비워두므로 배포 순서와 무관하게 동작하지만, 제약이 없는 상태로 새 코드가 뜨면 검증이 앱에만 남으므로 `main` 배포보다 먼저 적용했습니다. 적용 전 `problem_url`이 `https`가 아니거나 500자를 넘는 행이 없는지 확인해야 제약 추가가 실패하지 않습니다(적용 시점 운영 데이터는 기록 5건 중 링크 0건).

`20260907030000_group_overview_activity_order.sql`은 `get_group_overview`의 `jsonb_agg` 정렬 절 한 줄만 바꿉니다. 시그니처와 응답 구조가 그대로라 화면 코드 변경이 없고, 적용하는 순간 배포와 무관하게 순서가 바뀝니다.

`20260907040000_group_overview_stable_order.sql`은 그 정렬을 다시 `user_id`로만 되돌립니다. 표시 순서를 화면으로 옮겼기 때문이며, 화면이 어차피 다시 정렬하므로 배포 순서와 무관합니다. 두 마이그레이션 모두 `jsonb_agg`의 집계 ORDER BY만 건드리고 스키마·권한은 그대로입니다.

`20260907020000_member_profiles.sql`은 `profiles`에 `github_login`·`bio`를 더하고, 기존 `display_name` CHECK를 앞뒤 공백·제어문자까지 막도록 바꿉니다. `get_group_overview`는 시그니처를 유지한 채 `members`에 두 값을 더합니다. 새 코드가 두 컬럼을 조회하므로 `main` 배포보다 먼저 적용해야 하며, 구버전 코드는 두 컬럼을 읽지도 쓰지도 않아 적용 후에도 그대로 동작합니다. 적용 전 기존 `display_name`이 새 CHECK를 통과하는지, GitHub 아이디가 형식에 맞는지 읽기 전용으로 확인했습니다(프로필 6건 모두 통과).

`20260908000000_group_problem_titles.sql`은 `group_problem_titles` 테이블과 RLS 정책 네 개를 만듭니다. 기존 테이블과 권한은 건드리지 않아 구버전 코드에 영향이 없습니다. 이번에는 코드가 먼저 배포돼 적용 전까지 문제 목록의 ‘제목 넣기’ 저장이 오류 안내로 끝났습니다. 목록 조회는 실패해도 빈 결과로 떨어지므로 화면 자체는 정상이었습니다. MCP `apply_migration`으로 적용한 뒤 `schema_migrations`의 버전을 실행 시각에서 `20260908000000`으로 고쳤습니다. 적용 후 정책 4개·RLS 활성·`authenticated` 권한과 `anon` 권한 없음을 확인했고, `proofs`의 `authenticated` 권한이 여전히 SELECT·INSERT뿐인 것도 함께 확인했습니다.

커밋 `ae1b6ab`에 다른 세션의 작업과 섞여 들어갔던 `20260908000000_problem_title_by_reviewer.sql`은 `proofs`에 `problem_title` UPDATE 권한을 여는 방식이었고, 적용하지 않은 채 위 설계로 바꿨습니다. 저장소에서 지웠으니 이력에서 발견하더라도 적용하지 않습니다.

`20260909000000_auto_approve_proofs.sql`은 `groups.auto_approve` 컬럼과 `proofs`의 `AUTO_APPROVED` 상태를 더하고, 등록·검수·취소 정책과 현황판 집계를 그 상태까지 다루도록 넓힙니다. 기본값이 꺼짐이고 정책은 넓히기만 하므로 구버전 코드와 그대로 호환됩니다. 다만 새 코드가 `groups.auto_approve`를 조회하므로 적용 전에 배포하면 그룹 페이지가 404가 됩니다. 그래서 이번에는 배포보다 먼저 적용했고, 적용 직후 자동 인정을 켠 그룹은 0개라 기존 동작이 바뀌지 않았습니다. `schema_migrations`의 버전은 `20260909000000`으로 고쳤습니다.

`20260909010000_public_group_board.sql`은 `groups.is_public` 컬럼과 `list_group_directory()`·`get_public_group_board()` 두 함수를 더하고 이 함수에만 `anon` 실행 권한을 줍니다. 표 권한은 그대로 두어 `anon`은 여전히 `groups`·`profiles`·`proofs`를 직접 조회할 수 없습니다. 적용 후 `anon` 역할로 두 함수와 표 접근을 확인했고, 공개로 켠 그룹은 0개라 실제로 공개된 데이터는 없습니다.

그룹 생성·초대 수락·가입 승인·검수자 지정 함수가 연결되어 있습니다. 그룹 데이터는 ACTIVE 멤버만 조회하며, 작성자 본인의 풀이 검수는 차단됩니다.

## 도구 접근 제약

- Vercel MCP는 `hongyeseuls-projects` 스코프에 인증돼 있지 않습니다. 2026-09-07 재확인 결과 `list_teams`는 빈 배열, 운영 프로젝트 `get_project`는 403입니다. 배포는 `main` push로 하고 상태는 `gh api repos/HongYeseul/coding-test-verification/deployments`로 확인합니다. MCP로 배포를 다루려면 해당 스코프로 다시 인증해야 합니다.
- 운영 DB에 쓰기 형태의 SQL은 실행 정책에서 차단됩니다. 제약 검증은 스키마 조회와 읽기 전용 평가로 대신하고, 데이터를 넣는 회귀 테스트는 SQL Editor에서 직접 실행합니다.

## 로컬 실행과 검증

Node.js 24에서 `pnpm test`, `pnpm check`를 실행합니다. 로컬 `.env.local`에는 현재 프로젝트의 공개 연결값이 설정되어 있으며 Git에서 제외됩니다.

- 실제 Supabase에서 초대 대상 위조, PENDING 데이터 접근, 비소유자 승인, 자기 검수 차단 확인
- 가입 승인, 검수자 역할 지정, 다른 멤버의 풀이 검수 확인
- 비활성 소유자 권한 차단 확인
- DB 시나리오 테스트 데이터 전체 롤백
- 비로그인 공개 키 요청의 그룹 조회 거부(401) 확인
- 로그인 복귀 URL 검증 테스트 및 lint·타입 검사·빌드 통과
- 운영 브라우저에서 GitHub 로그인, 대시보드 진입, 그룹 생성과 ACTIVE 소유자 화면 확인
- 주간 이동 배포(2026-09-07): 운영 DB에서 지난 주 집계, 주 중간 날짜의 월요일 정규화, 미래 주와 그룹 생성 이전 주 제한 확인. 함수는 `get_group_overview(uuid, date)` 하나만 남고 `authenticated`만 실행 가능. 운영 화면에서 화살표 이동, 첫 주에서 `←` 비활성, `이번 주로` 복귀, 주소의 `week` 값과 풀이 기록 필터가 함께 유지되는 것까지 확인

## 문제 링크

- 풀이 등록 시 문제 링크를 선택으로 받습니다. 허용 플랫폼은 프로그래머스(`programmers.co.kr`, `school.programmers.co.kr`), 백준(`acmicpc.net`), LeetCode, Codeforces, AtCoder, HackerRank, Codewars입니다. 호스트는 `www.`만 떼고 정확히 비교하므로 `acmicpc.net.evil.com` 같은 주소는 통과하지 않습니다.
- 저장할 때 쿼리·프래그먼트·끝 슬래시를 지워 언어 선택 파라미터가 달라도 같은 문제로 모입니다. 자격증명과 포트도 함께 떨어집니다.
- 브라우저가 `proofs`에 직접 INSERT할 수 있으므로 검증을 두 겹으로 둡니다. DB의 `proofs_problem_url_format`은 `https` 시작과 500자 이하만 허용하고, 허용 호스트 판단은 저장할 때와 화면에 그릴 때 모두 앱에서 합니다. 허용 밖 링크가 어떤 경로로 들어와도 화면에서는 클릭 가능한 링크로 나오지 않습니다.
- 호스트 목록을 SQL에 넣지 않았으므로 플랫폼 추가는 `src/lib/proof-input.ts` 수정만으로 끝나고 마이그레이션이 필요 없습니다.
- 그룹 화면의 ‘우리 그룹이 푼 문제’는 링크를 남긴 기록을 최근 200건까지 모아 같은 문제로 묶고 등록한 멤버와 본인 등록 여부를 보여줍니다. 반려·취소 처리 중인 기록은 제외하며 풀이 기록 목록의 검색·필터와 무관하게 그룹 전체를 봅니다. 조회는 검수·플랫폼 계정 조회와 같은 `Promise.all`에 넣어 왕복이 늘지 않습니다.
- 문제 제목은 사용자가 직접 입력합니다. 크롤링을 금지한 플랫폼이 있어 링크에서 제목을 가져오지 않습니다. 링크는 참고용이며 검수 대상은 사진입니다.
- 등록한 기록의 링크는 나중에 고칠 수 없습니다. `proofs`에 UPDATE 권한과 정책이 없어 사후 편집을 열려면 RLS를 새로 설계해야 합니다.
- 회귀 테스트: `tests/proof-input.test.mjs`의 스킴·호스트 위조·정규화·길이, `tests/group-problems.test.mjs`의 묶기와 제외, `tests/group-page-queries.test.mjs`의 문제 목록 조회 조건. DB 제약은 `supabase/tests/problem_links.sql`로 검증하며 데이터는 롤백합니다.
- 문제 링크 배포(2026-09-07): 마이그레이션을 운영에 먼저 적용하고 `schema_migrations` 버전을 `20260907010000`으로 맞췄습니다. `pg_constraint`와 `pg_indexes`에서 제약식·인덱스 정의를 확인했고, 제약식을 읽기 전용으로 평가해 `http`·`javascript:`·500자 초과가 걸러지는 것을 확인했습니다. 적용 후 새로 생긴 보안 권고는 없습니다. 커밋 `c7e5939`가 Production에 배포됐고 `/`와 `/dashboard`가 200을 반환합니다.
- 운영 브라우저에서 링크 입력·문제 목록 표시는 아직 확인하지 않았습니다. 적용 시점에 링크를 남긴 기록이 없어 문제 목록은 빈 상태 안내를 표시합니다.

## 사진 등록과 초대코드

- 소유자는 그룹 상단의 `멤버 초대` 버튼에서 초대 링크 복사와 코드 발급을 할 수 있습니다. 하단 `멤버 관리` 절에서 가입 승인과 검수자 지정을 함께 처리하며 대상이 있을 때만 표시합니다.
- 5자리 공유 코드로 가입 신청 후 소유자가 승인합니다. 7일 만료, 재발급 시 이전 코드 무효화, 사용자당 15분에 5회 입력 제한을 적용합니다.
- 플랫폼 계정 없이 JPG·PNG·WebP 원본을 20MB까지 선택하거나 캡처를 복사해 붙여넣습니다. 긴 변 최대 1,440px, 120KB 목표로 압축하며 필요하면 1,200px·1,024px까지 줄입니다. 압축이 끝나면 바로 등록할 수 있고 미리보기로 글자를 확인할 수 있습니다. 새 파일의 저장 상한은 브라우저와 Storage 버킷 모두 300KB입니다. 기존 사진과 검수·취소는 유지합니다. 제목은 선택이고 사진 속 문제명·날짜 자동 추출은 하지 않습니다.
- 실제 DB에서 코드 공유·재발급·시도 제한, 승인 전 접근 차단, 사진 제출·검수·삭제 권한을 검증했습니다. SQL 테스트는 `supabase/tests/invite_codes_and_photos.sql`에 있으며 데이터는 롤백합니다.
- 검수 취소는 본인의 PENDING 기록만 가능하며, CANCELING 상태에서 사진 삭제를 확인한 뒤 기록을 삭제합니다. 삭제 실패 시 같은 버튼으로 재시도하고 현황판 집계에서는 제외합니다.
- `tests/cancel-proof-action.test.mjs`는 반복 취소·Storage 실패·응답 유실을 검증합니다. `supabase/tests/cancel_proof.sql`은 실제 DB의 취소 권한과 검수 차단을 검증하고 롤백합니다. SQL 테스트의 사진 삭제는 Storage 메타데이터 경로 변경으로 모사합니다.
- 기존 플랫폼 계정 기록과 대상 계정 초대 링크는 유지합니다. 공식 API 자동 확인과 영상 업로드 화면은 현재 범위에 포함하지 않습니다.

환경변수 설정 방법과 Storage 경로 계약은 [README.md](../README.md)를 참고합니다. 관리자 키, OAuth Client Secret, DB 비밀번호, 인증 토큰은 저장소에 추가하지 않습니다.

## 그룹 현황판

- 그룹 화면 상단에 오늘 참여 인원과 멤버별 주간 인증 매트릭스를 표시합니다. 멤버가 행, 월~일이 열이며 이름 아래에 누적 승인과 검수 대기를, 오른쪽 끝 열에 선택한 주의 승인 건수를 둡니다.
- `get_group_overview`는 호출자의 ACTIVE 멤버십을 확인하고 RLS를 적용해 전체 기록을 집계합니다. 날짜는 한국시간의 인증 등록일이며 주간 범위는 월~일입니다.
- 상단 화살표로 다른 주를 봅니다. 선택한 주는 주소의 `week` 값으로 유지하며 `get_group_overview(target_group_id, target_week_start)`가 그 주 월요일로 맞추고 그룹 생성 주와 이번 주 사이로 제한합니다. 응답의 `weekEnd`·`currentWeekStart`·`firstWeekStart`로 화살표 활성 여부를 정합니다.
- 주간 승인과 인증 매트릭스는 선택한 주를 따르고, 오늘 참여·누적 승인·검수 대기는 시점과 무관한 현재 값입니다. 취소 처리 중(CANCELING) 기록은 오늘 참여에서 제외합니다.
- 현재 ACTIVE 멤버만 집계하고 인증이 없는 멤버도 0건으로 표시합니다. 새로고침 버튼으로 다른 멤버의 변경을 갱신합니다.
- 멤버 행은 선택한 주의 승인 건수 내림차순, 같으면 누적 승인 내림차순, 그다음 닉네임순입니다. 닉네임까지 같을 때를 대비해 `userId`로 마지막을 고정합니다.
- 정렬은 `src/components/group-overview.tsx`의 `sortedMembers`가 합니다. 표시 규칙이라 바꿀 때마다 마이그레이션이 필요하지 않도록 DB에서 화면으로 옮겼습니다. `get_group_overview`는 같은 요청에 같은 배열이 나오도록 `user_id`로만 정렬합니다. 응답에 `weekApproved`·`totalApproved`가 이미 들어 있어 화면이 추가 조회 없이 정렬할 수 있고, 전체 멤버를 내려주므로 DB에서 미리 정렬할 이유도 없습니다(페이지네이션이 생기면 다시 DB로 옮겨야 합니다).
- 화면 정렬은 `localeCompare(…, "ko")`를 쓰므로 한글 닉네임이 라틴 문자보다 **앞**에 옵니다. DB의 `en_US` ICU 콜레이션과 반대이며, 한국어 화면에는 이쪽이 맞습니다. 풀이 기록 이름 검색이 쓰는 `toLocaleLowerCase("ko-KR")`와도 기준이 맞습니다.
- 정렬 기준을 화면에서 알 수 있도록 멤버 열 머리글에 `· 이번 주 승인순`(지난 주를 볼 때는 `· 선택한 주 승인순`)을 적고, 마우스를 올리면 동점 규칙까지 카드로 보여줍니다. hover가 없는 환경을 위해 표의 `sr-only` 캡션에도 같은 설명을 넣었습니다.
- 기록이 있는 칸은 검수 대기 `◷`, 승인 `✓`, 반려 `×` 중 하나와 두 건 이상일 때의 건수를 보여주고, 누르면 그 멤버와 날짜로 좁힌 풀이 기록으로 이동합니다. 사진은 매트릭스가 아니라 기록 목록의 썸네일과 상세 모달에서 지연 로딩하며, 열 때 그룹 권한을 다시 확인합니다. `get_group_overview`가 돌려주는 `featuredProofId`·`featuredDate`는 화면에서 더 쓰지 않지만 함수는 그대로 둡니다.
- 최근 50개 풀이 기록은 현재 그룹 전체 작성자의 기록이며, 현황판 집계에는 이 개수 제한을 적용하지 않습니다.
- 회귀 테스트: `tests/group-overview-week.test.mjs`의 주간·누적·닉네임 정렬 순서와 머리글 정렬 안내. `supabase/tests/group_overview.sql`의 1,000건 초과 집계, 주간 경계, 지난 주 집계와 월요일 정규화, 미래 주·생성 이전 주 제한, 상태 구분, 비로그인·가입 대기·탈퇴·타 그룹 접근 차단. 화면의 주간 이동 링크는 `tests/group-overview-week.test.mjs`로 확인합니다.
- 활동순 정렬 배포(2026-09-07): 마이그레이션을 운영에 적용하고 `schema_migrations` 버전을 `20260907030000`으로 맞췄습니다. MCP `apply_migration`이 응답을 돌려주기 전에 끊겼지만 `pg_get_functiondef`로 정렬 절이 반영된 것을 확인했습니다. 운영 데이터로 새 순서를 계산해 이번 주 승인 1건인 `hyunn515`가 4번째에서 1번째로 올라오고 0건인 다섯 명은 닉네임순을 유지하는 것을 확인했습니다. 적용 후 새로 생긴 보안 권고는 없습니다. 커밋 `5ce2ac2`가 Production에 배포됐고(배포 `6316763259`, 상태 `success`) `/`, `/dashboard`, `/settings/profile`이 200을 반환합니다. 화면 코드 변경은 없어 마이그레이션 적용 시점부터 순서가 바뀌었습니다.
- 정렬 위치 이동 배포(2026-09-08): 마이그레이션을 운영에 적용하고 `schema_migrations` 버전을 `20260907040000`으로 맞췄습니다. `pg_get_functiondef`로 응답 정렬이 `user_id`만 남고 활동 정렬이 사라진 것을 확인했습니다. 커밋 `cd72f73`이 Production에 배포됐고(배포 `6316898600`, 상태 `success`) `/`, `/dashboard`, `/settings/profile`이 200을 반환하며 배포된 CSS에 `group-hover/sort:block`이 들어 있습니다. 빌드 CSS 기반 정적 미리보기에서 운영과 같은 값으로 순서(hyunn515 → 홍예슬 → 5bus123 → angyeongjin → Apeirogon99 → swprk)와 머리글 안내 카드를 확인했습니다.
- 화면 위계 정리(2026-09-08): 화면 전체가 1px 테두리와 회색 텍스트로만 이루어져 무엇이 중요한지 구분되지 않던 문제를 손봤습니다. 새 색 토큰은 만들지 않고 `globals.css`에 이미 있던 `--primary`·`--warn`·`--danger`를 쓰기만 했습니다.
  - 현황 카드 위쪽에 오늘 인증·선택한 주 승인·검수 대기를 28px 숫자로 둡니다. 세 값 모두 `get_group_overview` 응답에 있어 조회가 늘지 않습니다. 표 제목 `<h2>`는 `sr-only`로 남기고 주 표시는 이동 컨트롤 옆으로 옮겼습니다.
  - 매트릭스 셀이 상태와 무관하게 모두 `bg-brand-soft text-brand`였습니다. 글자만 `◷`·`✓`·`×`로 갈리고 색이 같아 **반려도 승인과 같은 초록 칸**으로 보였습니다. 승인은 `bg-primary` 채움, 검수 대기와 반려는 테두리로 나눴습니다. 반려 기록이 매트릭스에 뜬 적이 없어 드러나지 않던 문제입니다.
  - 오늘 열에 `bg-brand-soft/50` 배경을 줍니다. 이전에는 머리글 글자만 브랜드 색이었습니다. 미등록 `·`와 예정 `–`은 `opacity`를 낮춰 노이즈를 줄입니다.
  - `우리 그룹이 푼 문제`의 `풀어보기`에서 `btn-primary`를 뺐습니다. 외부로 나가는 링크가 화면에서 가장 강한 요소였고 개수도 많아 `+ 풀이 인증하기`와 경쟁했습니다. 이제 채운 버튼은 등록 버튼 하나입니다.
  - 풀이 기록 행에 상태 색 막대(`border-l-[3px]`)를 두고 썸네일을 34px에서 52px로 키웠습니다. 사진 인증이 핵심인데 목록에서 사진이 거의 보이지 않았습니다.
  - `풀이 기록` 제목 옆의 `이번 주 승인 N건`은 카드 지표와 중복이라 지웠습니다.
  - 남은 항목: 간격 값이 `mt-[5px]`·`pb-[17px]`처럼 20곳 넘게 하드코딩돼 있고, `ProofRecordList`의 `min-h-[360px]`은 기록이 적을 때 빈 공간을 만듭니다. 둘 다 이번 범위에 넣지 않았습니다.
  - 배포: 커밋 `0990dae`가 Production에 배포됐고(배포 `6317698562`, 상태 `success`) `/`, `/dashboard`, `/settings/profile`이 200을 반환합니다. 배포된 CSS에서 `text-[28px]`, `bg-brand-soft/50`, `bg-primary`, `border-l-primary`·`border-l-warn`·`border-l-danger`, `size-[44px]`·`sm:size-[52px]`, `grid-cols-[44px_minmax(0,1fr)_60px_12px]`을 확인했습니다. 마이그레이션과 환경변수 변경은 없습니다.
  - 배포 전 빌드 CSS 기반 정적 미리보기로 라이트 1100px, 다크 모드, 모바일 375px에서 지표 줄바꿈과 매트릭스 가로 폭, 상태 막대를 확인했습니다. 운영 브라우저에서 로그인 후 확인은 아직 하지 않았습니다.
- 2단 레이아웃(2026-09-08): 그룹 화면을 `lg`(1024px) 이상에서 `lg:grid-cols-[minmax(0,1fr)_280px]` 두 칸으로 나눕니다. 왼쪽에 주간 현황과 풀이 기록, 오른쪽 `<aside>`에 문제 목록을 두고 `lg:sticky lg:top-6`으로 스크롤을 따라오게 했습니다. 문제가 많아져 패널이 화면보다 길어질 때를 대비해 `lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto`를 겁니다.
  - 매트릭스를 좁혀도 되는지가 관건이었습니다. 1024px에서 표가 945px에서 599px로, 멤버 열이 307px에서 204px로 줄지만 여섯 멤버 모두 `scrollWidth === clientWidth`로 이름이 잘리지 않습니다. 날짜 열은 72px에서 48px이 되어 셀(30px) 주변 여백만 줄고 밀도는 오히려 좋아집니다.
  - 문제 목록은 280px에 가로 배치가 들어가지 않아 `[플랫폼] / 제목 ↗ / 등록자` 세로 배치로 바꿨습니다. `풀어보기` 버튼을 없애고 항목 전체를 `<a>`로 감쌌으며, 제목이 링크로 보이도록 `group-hover/problem:underline`을 겁니다.
  - 소유자의 `멤버 관리`는 2단 밖 아래에 그대로 둡니다. 사이드로 옮기면 소유자와 일반 멤버의 레이아웃 뼈대가 달라집니다.
  - 1024px 미만에서는 `display:block`으로 돌아가 sticky가 풀리고 문제 목록이 기록 아래로 쌓입니다. DOM 순서가 그대로라 모바일 순서에 별도 처리가 필요 없습니다.
  - 배포: 커밋 `32caf74`가 Production에 배포됐고(배포 `6318050226`, 상태 `success`) `/`, `/dashboard`, `/settings/profile`이 200을 반환합니다. 배포된 CSS에서 `lg:grid-cols-[minmax(0,1fr)_280px]`, `lg:sticky`, `lg:overflow-y-auto`, `group-hover/problem:underline`을 확인했습니다. 마이그레이션과 환경변수 변경은 없습니다.
- 글자 크기 확대와 빈 공간 정리(2026-09-08): 화면이 작아 보인다는 지적에 daum 첫 화면의 글자 크기 분포를 실제로 세어 기준으로 삼았습니다. daum은 17px이 122건으로 주력이고 14px·15px이 뒤를 잇는데, 우리는 12px(`text-xs`)이 66곳으로 가장 많고 본문이 14px이었습니다.
  - 본문 14px→15px, 풀이 제목 14px→17px, 문제 제목 13px→16px, 보조 12px→13px, 메타 11px→12px, `h1` 26px→30px, `h2` 16px→19px, `h3` 18px→21px으로 올렸습니다. 컴포넌트 126곳을 한 번에 치환했으며, 단계별로 나눠 치환하면 `text-xs`→`text-[13px]`→`text-[15px]`처럼 중복 적용되므로 한 번의 정규식 패스로 처리했습니다.
  - 버튼 높이 36px→40px, 셀렉트 34px→38px, 매트릭스 행 52px→58px, 칸 30px→34px을 함께 키웠습니다.
  - 글자를 키우자 1024px에서 `angyeongjin @angyeongjin`이 14px, `Apeirogon99 @apeirogon99`가 20px 모자라 잘렸습니다. 멤버 열을 34%→38%(228px)로 넓혀 해결했습니다.
  - 모바일에서는 날짜 열이 24px이라 칸을 키우면 열보다 넓어집니다. 칸 확대를 `sm:` 이상으로 제한하고 모바일 멤버 열은 36%로 두어 여유 2px을 확보했습니다.
  - `ProofRecordList`의 목록 래퍼에서 `min-h-[360px]`을 없앴습니다. 기록이 적을 때 200px 가까운 빈 공간이 생기던 문제입니다. 기록이 없을 때의 안내는 `py-14`로 여백만 남깁니다.
  - 검증: 1024px에서 멤버 열 228px·날짜 열 44px·칸 34px·이름 잘림 0건, 375px에서 멤버 열 120px·날짜 열 26px·칸 24px, 양쪽 모두 가로 스크롤 없음. 목록 컨테이너 높이가 행 높이 합계와 같고 `min-height`가 `0px`인 것도 확인했습니다.
  - 배포: 커밋 `5946d52`가 Production에 배포됐고(배포 `6318165561`, 상태 `success`) `/`, `/dashboard`, `/settings/profile`이 200을 반환합니다. 배포된 CSS에서 `body`의 `font: 15px/1.6`, `h1`의 `font-size:30px`, 풀이 제목 17px, 문제 제목 16px, 지표 32px, 멤버 열 38%, 칸 34px을 확인했고 옛 값(멤버 열 34%·28%)은 사라졌습니다. 마이그레이션과 환경변수 변경은 없습니다.
  - Tailwind v4는 Markdown도 스캔합니다. 이 문서에 클래스명을 적으면 코드에서 지운 클래스라도 CSS에 다시 생깁니다(현재 `min-h-[360px]` 규칙이 그렇게 남아 있습니다). 화면에 그 클래스를 쓰는 요소가 없어 동작에는 영향이 없고 크기도 수십 바이트지만, 배포된 CSS로 코드 상태를 확인할 때는 문서 언급 때문일 수 있다는 점을 감안해야 합니다. 확인은 소스 `grep`을 함께 봐야 정확합니다.
- 간격·테마·말풍선·주 이동(2026-09-08)
  - 하드코딩 간격 40곳을 4px 배수로 스냅했습니다(`mt-[5px]`→`mt-1`, `pb-[17px]`→`pb-4` 등). `src`에 px 단위 간격 클래스가 남아 있지 않습니다.
  - 테마 수동 전환은 `:root[data-theme="light"|"dark"]`에 `color-scheme`만 지정합니다. 색을 전부 `light-dark()`로 정의해둔 덕분에 토큰을 다시 쓰지 않고 두 줄로 전체가 바뀝니다. 선택은 `localStorage`에 저장하고 `layout.tsx`의 인라인 스크립트가 첫 페인트 전에 적용해 새로고침 번쩍임을 막습니다. 버튼은 `AppShell` 상단바에 둡니다. 우측 하단 플로팅은 sticky 문제 목록 패널과 겹쳐서 쓰지 않았습니다.
  - 아이콘은 인라인 SVG로 직접 그립니다(시스템=왼쪽 반쪽 채운 원, 라이트=해, 다크=초승달). `☀`·`☾`·`◐` 글리프는 기기 폰트에 따라 굵기가 달라지거나 이모지로 대체되고, `◐`는 `시스템`으로 읽히지도 않았습니다. `currentColor`를 써서 라이트·다크를 함께 따라갑니다.
  - 아이콘 배포: 커밋 `5597e1d`가 Production에 배포됐고(배포 `6318458152`, 상태 `success`) 세 경로가 200을 반환하며 첫 화면 HTML에 SVG와 `aria-label`이 들어 있고 옛 글리프는 남아 있지 않습니다.
  - 라벨 없이 아이콘만 둡니다. 상단바의 `프로필`·`그룹 목록`이 텍스트 이동 링크라, 세 번째 텍스트를 더하면 이동과 설정이 구분되지 않고 상태에 따라 라벨 길이가 달라져 상단바 폭도 흔들렸습니다. 설명은 `title`과 `aria-label`에 담습니다.
  - `ThemeToggle`은 `useSyncExternalStore`로 저장소를 구독합니다. `useEffect` 안에서 `setState`를 부르면 프로젝트 ESLint 규칙(cascading renders)에 걸립니다.
  - 한 줄 소개 말풍선을 이름 아래에서 오른쪽(`left-full`)으로 옮기고 `rotate-45` 꼬리를 달았습니다. 말풍선 왼쪽 끝이 멤버 칸 오른쪽 끝과 일치하고 세로 중앙에 옵니다.
  - 주 이동 시 화면 전체가 깜빡이던 원인은 `src/app/groups/[slug]/loading.tsx`였습니다. `loading.js`는 `page.js` 전체를 Suspense로 감싸고, 같은 경로의 `?week=` 변경도 새 내비게이션이라 화면 전체가 스켈레톤으로 교체됩니다. 게다가 쿠키를 쓰는 동적 경로는 기본 `prefetch="auto"`에서 loading 경계까지만 프리페치되어 데이터가 아니라 스켈레톤만 미리 받습니다.
  - 배포: 커밋 `0438024`가 Production에 배포됐고(배포 `6318341475`, 상태 `success`) `/`, `/dashboard`, `/settings/profile`이 200을 반환합니다. 배포된 CSS에서 `:root[data-theme=light|dark]`의 `color-scheme`과 Lightning CSS가 붙인 `light-dark()` 폴리필 변수, 말풍선의 `left-full`을 확인했고 첫 화면 HTML에 테마 부트스트랩 스크립트가 들어 있습니다. 마이그레이션과 환경변수 변경은 없습니다.
  - 배포 CSS에 `mt-[5px]`·`pb-[17px]` 규칙이 남아 있지만 소스에는 없습니다. 이 문서가 두 클래스를 예시로 적고 있어 Tailwind가 Markdown에서 주워 생성한 것입니다(위 Markdown 스캔 항목과 같은 원인).
  - 이 파일을 지워 폴백을 없앴습니다. 폴백이 없으면 새 페이지가 준비될 때까지 현재 화면이 유지되어 깜빡임이 사라집니다. 대신 Next 문서가 이 상황에 권장하는 `useLinkStatus`로 주 이동 화살표에만 진행 표시를 답니다(`LinkPendingDot`). 트레이드오프로 그룹 화면 첫 진입에도 스켈레톤이 뜨지 않고 이전 화면이 유지됩니다. 첫 진입 로딩 표시가 필요하면 `loading.tsx`를 되살리되 깜빡임이 함께 돌아옵니다.
## 성능

- 이동 전 측정(2026-09-08, 한국에서): 같은 도메인의 정적 CSS는 서울 엣지(`x-vercel-id`의 `icn1`)에서 16ms에 오는데, HTML은 273ms입니다. HTML의 `x-vercel-id`는 `icn1::syd1`이라 요청이 서울 엣지에 닿은 뒤 시드니 함수로 넘어갑니다. 차이 약 257ms가 서울↔시드니 왕복입니다. 병목은 코드가 아니라 함수 리전입니다.
- `vercel.json`의 `syd1`은 Supabase가 시드니라서 고른 값이었습니다. 함수만 서울로 옮기면 그룹 화면의 순차 DB 대기 8단계가 전부 국제 왕복이 되어 훨씬 느려집니다. 그래서 DB와 함수를 함께 옮겼습니다.
- 이동 후 측정(2026-09-08): `x-vercel-id`가 `icn1::syd1` → `icn1::icn1`로 바뀌었고 정적 자산 62ms, HTML `/` 179ms(중앙값, n=20)입니다. 측정 시점 네트워크가 이전보다 느려 절대값끼리는 비교할 수 없으므로 **함수가 더하는 시간**으로 봅니다. 약 257ms → 약 117ms입니다. 정적으로 프리렌더되는 `/dashboard`가 207ms로 `/`와 사실상 같다는 점이 방증입니다.
- 남은 117ms는 국제 왕복이 아니라 함수 자체의 렌더 시간과 서울 안에서의 DB 왕복입니다. 더 줄이려면 그룹 화면의 순차 DB 대기를 손봐야 합니다.
- 전환 검증(2026-09-08): 운영에서 GitHub 로그인 → 대시보드 → 그룹 화면까지 통과했고 멤버 6명·기록 6건·문제 링크 1건이 이전과 같이 보입니다. 증빙 사진은 새 프로젝트가 발급한 서명 URL로 열립니다. 프로필 저장도 동작합니다. 세션은 이관하지 않아 전환 시점에 전원 로그아웃됐습니다.
- `requireUser`와 `getOptionalUser`가 쓰던 `getUser()`를 `getClaims()`로 바꿨습니다. `getUser()`는 호출마다 Auth 서버에 왕복하지만, 이 프로젝트는 JWKS에 ES256 키가 있는 비대칭 서명이라 `getClaims()`는 로컬 검증만 합니다. 대칭 키로 바뀌면 `getClaims()`도 서버에 물어보므로 어느 쪽이든 느려지지 않습니다. 프록시는 이전부터 `getClaims()`를 쓰고 있었습니다.
- 화면에 넘기는 사용자 값은 `SessionUser`(`id`·`email`·`githubUserName`)로 좁혔습니다. 초대 화면이 쓰던 `user_metadata.user_name`은 표시 전용이며 권한 판단에는 쓰지 않습니다.
- `@vercel/speed-insights`를 넣어 실제 방문자의 TTFB·LCP를 봅니다. 리전을 옮길지 판단할 근거가 필요해서 추가했습니다. 방문자 수 집계(`@vercel/analytics`)는 6명 그룹에서 얻을 정보가 적어 넣지 않았습니다.
- 수집은 이미 되고 있습니다. 리전 이전 직후 기준값은 Real Experience Score 62, `/groups/[slug]` 58, `/` 100(이벤트 14개)이며 대부분 이전 전에 쌓인 값입니다. 이전 효과는 하루쯤 뒤에 다시 봅니다. 국가별·저조 경로 상세는 유료 플랜(Plus)에서만 보입니다.
- Vercel MCP는 여전히 `hongyeseuls-projects` 스코프 권한이 없습니다. `list_teams`는 빈 배열, `get_runtime_logs`는 403이라 함수 실행 시간을 직접 볼 수 없어 위 수치는 모두 외부에서 잰 값입니다.

- 스터디 소통 채널은 카카오톡입니다. 카카오톡 알림, 공동 목표, 응원 반응, 연속 참여 집계는 아직 구현하지 않았습니다.

## 화면 개편

- 참고 시안에 맞춰 그룹 화면을 다시 짰습니다. 폭 1024px 한 칸에 상단바, 그룹 헤더, 주간 현황, 풀이 기록을 세로로 쌓고 그림자 카드 대신 1px 테두리와 12px 라운드만 씁니다. 색은 `src/app/globals.css`에 `light-dark()` 토큰 한 벌로 두어 라이트·다크를 함께 처리합니다. Lightning CSS가 이를 `prefers-color-scheme` 폴리필로 컴파일하므로 구형 브라우저에서도 동작합니다.
- 기본 엘리먼트 규칙은 반드시 `@layer base`에 둡니다. 레이어 밖에 두면 명시도와 무관하게 Tailwind 유틸리티(`@layer utilities`)를 항상 이겨서 `w-36` 같은 지정이 먹지 않습니다. Tailwind v4의 important 표기는 접미사(`w-36!`)이며 v3의 `!w-36`은 클래스가 생성되지 않습니다.
- 풀이 기록은 전체·검수 대기·내 기록 탭과 이름 검색·멤버·상태·기간 필터를 씁니다. 탭과 필터는 모두 주소 질의값이라 링크 공유와 뒤로 가기가 되고, 선택을 바꾸면 바로 적용합니다. 스크립트가 없으면 `적용` 버튼으로 제출합니다.
- 기록 한 줄을 누르면 네이티브 `<dialog>` 상세 모달이 열립니다. 검수·취소는 기존 서버 액션(`reviewProofAction`, `deleteProofAction`)을 그대로 호출하므로 권한 판단은 서버와 RLS에 남습니다. 반려는 앱에서 이유 입력을 요구하고, 서버는 기존대로 500자 상한만 봅니다. 풀이 등록도 헤더 버튼으로 여는 모달이며 등록을 마치면 아래쪽 알림으로 결과를 알립니다.
- 데이터 조회 경로는 바꾸지 않았습니다. 쿼리 순서·조건과 `get_group_overview` 호출은 그대로이며 `tests/group-page-queries.test.mjs`가 이를 확인합니다.
- 화면 개편 배포(2026-09-07): 커밋 `d2091ba`와 후속 수정 `ad74e54`가 Production에 배포됐고 배포 상태는 `success`입니다. `/`, `/dashboard`, `/join/<code>`가 200을 반환하고, 배포된 CSS에서 `@layer base` → `@layer utilities` 순서와 `light-dark()` 폴리필을 확인했습니다. 마이그레이션과 환경변수 변경은 없습니다.
- 운영 브라우저에서 로그인과 그룹 화면 렌더는 확인했습니다(2026-09-08, 리전 이전 검증). 상세 모달 동작은 아직 확인하지 않았습니다. 로컬에서는 매트릭스, 탭·필터, 상세 모달의 검수 화면, 등록 모달, 다크 모드, 375px 모바일 폭까지 확인했습니다.

## 프로필

- 상단바의 `프로필`에서 본인 닉네임(40자)과 한 줄 소개(80자)를 정합니다. 소개는 비워둘 수 있고 닉네임 중복은 허용합니다.
- 기존 멤버 6명의 닉네임은 가입 시 받은 GitHub 아이디 그대로이며 마이그레이션이 값을 바꾸지 않습니다. 그대로 초기 닉네임이 됩니다.
- 닉네임이 사용자 입력이 되면서 신원 확인 수단이 사라지므로 `profiles.github_login`을 더했습니다. `auth.identities`에서 소문자로 채우고 `user_metadata`는 사용하지 않습니다. 사용자가 바꿀 수 있는 값이라 초대 대상 확인에 쓰지 않는 것과 같은 이유입니다.
- 신규 가입과 GitHub 아이디 변경은 `auth.identities`의 `on_auth_identity_github_synced` 트리거가 따라갑니다. `auth.users` 삽입 트리거가 만든 `profiles` 행이 identity보다 먼저 생기므로 UPDATE로 채웁니다.
- RLS는 행 단위라 컬럼을 막지 못합니다. `profiles`의 UPDATE 권한을 `display_name`·`bio`로, INSERT 권한을 `id`·`display_name`·`bio`로 좁혀 브라우저가 직접 요청해도 `github_login`·`avatar_url`이 바뀌지 않게 했습니다.
- 저장은 서버 액션 `updateProfileAction`이 처리하고, 앱에서 공백 정리와 보이지 않는 문자 제거를 합니다. 글자 순서를 뒤집어 사칭할 수 있는 양방향 제어문자는 앱에서 지우고, DB는 공백만으로 된 이름·제어문자·길이 초과를 CHECK로 막습니다.
- GitHub 아이디는 주간 현황 매트릭스의 멤버 이름 옆, 소유자의 가입 승인·검수자 지정 화면, 풀이 상세 모달 작성자 옆에 나옵니다. 이름 옆에 아이디가 붙으면서 멤버 열 폭을 `36%`(모바일)·`34%`(데스크톱)로 넓혔습니다.
- 한 줄 소개는 매트릭스 행 높이를 늘리지 않도록 이름 칸에 마우스를 올렸을 때 나오는 카드로만 보여줍니다. 카드가 마지막 행에서 잘리지 않도록 `<section>`의 `overflow-hidden`을 빼고 헤더에 `rounded-t-[11px]`을 직접 줬습니다. 소개가 없는 멤버는 카드를 만들지 않으며, hover가 없는 터치 화면에서는 상세 모달과 프로필 화면에서 확인합니다.
- `get_group_overview`는 시그니처를 바꾸지 않고 `members`에 `githubLogin`·`bio`만 더했습니다. 구버전 화면은 이 값을 읽지 않으므로 배포 전에 적용해도 문제가 없습니다.
- 회귀 테스트: `tests/profile-input.test.mjs`의 공백·제어문자·길이·GitHub 아이디 형식, `tests/group-page-queries.test.mjs`의 프로필 조회 컬럼, `tests/group-overview-week.test.mjs`의 이름 칸 표시. DB 제약과 컬럼 권한, 아이디 동기화는 `supabase/tests/member_profiles.sql`로 검증하며 데이터는 롤백합니다.
- 프로필 사진 업로드는 범위에 넣지 않았습니다. `avatar_url`은 가입 때 받은 GitHub 값이 그대로 남아 있고 화면에서 쓰지 않습니다.
- 프로필 배포(2026-09-07): 마이그레이션을 `main` 배포보다 먼저 적용하고 `schema_migrations` 버전을 `20260907020000`으로 맞췄습니다. 적용 후 프로필 6건 모두 `github_login`이 GitHub 아이디 소문자로 채워졌고 `display_name`·`bio`는 그대로입니다. `information_schema.column_privileges`에서 `authenticated`의 UPDATE 권한이 `display_name`·`bio` 두 컬럼뿐인 것과 `on_auth_identity_github_synced` 트리거를 확인했으며, 새 CHECK를 읽기 전용으로 평가해 공백만인 이름·앞뒤 공백·제어문자·길이 초과·형식이 틀린 GitHub 아이디가 걸러지는 것을 확인했습니다. 적용 후 새로 생긴 보안 권고는 없습니다. 커밋 `85b0769`가 Production에 배포됐고(배포 `6310323371`, 상태 `success`) `/`, `/dashboard`, `/settings/profile`이 200을 반환합니다. 로그아웃 상태에서 `/settings/profile`은 프로필 내용을 내려주지 않고 `next=%2Fsettings%2Fprofile`로 로그인에 복귀합니다.
- 이름 옆 아이디·소개 카드 배포(2026-09-07): 커밋 `039ee01`이 Production에 배포됐고(배포 `6310640761`, 상태 `success`) `/`, `/dashboard`, `/settings/profile`이 200을 반환합니다. 배포된 CSS에서 `group-hover/member:block`과 헤더의 `rounded-t-[11px]`을 확인했습니다. 빌드 CSS로 만든 정적 미리보기에서 1100px·800px·375px 폭의 이름·아이디 표시와 소개 카드, 마지막 행 카드가 잘리지 않는 것까지 확인했습니다. 마이그레이션과 환경변수 변경은 없습니다.
- 운영 브라우저에서 닉네임 저장을 확인했습니다(2026-09-08). 값을 바꾸지 않고 같은 값으로 저장해 쓰기 경로만 확인했고 `profiles.updated_at`이 갱신됐습니다. 다른 멤버 화면 반영은 아직 확인하지 않았습니다. `supabase/tests/member_profiles.sql`은 `auth.users`에 데이터를 넣으므로 MCP가 아니라 SQL Editor에서 실행합니다.

## 화면 전환과 무료 운영

- DB와 Vercel 함수를 모두 서울로 옮겼습니다(2026-09-08). 둘을 떨어뜨려 두면 그룹 화면의 순차 DB 대기가 전부 국제 왕복이 됩니다.
- 대시보드에는 `loading.tsx`가 있어 데이터 조회 중 로딩 화면을 표시합니다. 그룹 화면은 주 이동 깜빡임 때문에 제거했습니다.
- 초대코드는 본문과 병렬 조회하고 플랫폼 계정은 표시할 풀이에서 참조한 계정만 조회합니다. ACTIVE 멤버십 검사와 RLS는 유지합니다.
- 유료 이미지 변환·관측 도구·추가 DB를 사용하지 않습니다. Vercel Hobby는 비상업적 개인 용도이며 무료 사용량 초과 시 제한될 수 있습니다.
- Supabase Free의 주요 한도는 DB 500MB, 파일 1GB, egress 5GB와 cached egress 5GB입니다. 한도와 사용량은 운영 대시보드에서 확인하며 자동 유료 전환은 신청하지 않습니다.
