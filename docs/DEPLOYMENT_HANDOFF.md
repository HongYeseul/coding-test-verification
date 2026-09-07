# 배포 인수인계

마지막 확인: 2026-09-07

## 운영 연결

- GitHub: `HongYeseul/coding-test-verification` (Public, `main`)
- Vercel: `hongyeseuls-projects/coding-test-verification`
- Vercel 프로젝트 ID: `prj_F67rErRW8oBwkLTComzHn4g23qzi`
- 운영 URL: https://coding-test-verification.vercel.app
- Supabase 프로젝트: `lfukmjprduxmesciplrx` (`coding-test-verification`, Free)
- Supabase 리전: Sydney (`ap-southeast-2`)
- Vercel 함수 리전: `vercel.json`의 Sydney (`syd1`) 한 곳. Hobby 무료 플랜을 유지합니다.
- GitHub OAuth 앱: https://github.com/settings/applications/3837795

`main` push 시 Vercel Production에 자동 배포됩니다. GitHub OAuth 제공자는 활성화되어 있으며 Client Secret은 Supabase에만 저장했습니다. Vercel Production에 프로젝트 URL, Publishable Key, 사이트 URL을 등록했습니다. Preview에는 운영 DB 환경변수를 등록하지 않았습니다.

## 인증 주소

- Supabase Site URL: `https://coding-test-verification.vercel.app`
- GitHub OAuth callback: `https://lfukmjprduxmesciplrx.supabase.co/auth/v1/callback`
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

적용 버전은 `supabase_migrations.schema_migrations`에도 등록합니다. 기존 마이그레이션을 재실행하지 않고 새 마이그레이션부터 적용합니다.

MCP의 `apply_migration`은 버전을 실행 시각으로 기록하므로 저장소 파일명과 어긋납니다. 적용 후 `schema_migrations`의 해당 행을 파일명의 버전으로 고쳐야 나중에 같은 파일을 다시 적용하지 않습니다.

`20260907000000_group_overview_week_range.sql`은 `get_group_overview`에 인자를 추가하므로 기존 1인자 함수를 지우고 다시 만듭니다. 두 정의가 공존하지 않도록 한 트랜잭션으로 실행하며, 새 코드가 2인자로 호출하기 때문에 `main` 배포보다 먼저 적용해야 합니다.

`20260907010000_problem_links.sql`은 컬럼을 더하지 않고 기존 `problem_url`에 CHECK 제약과 부분 인덱스만 추가합니다. 구버전 코드는 이 컬럼을 비워두므로 배포 순서와 무관하게 동작하지만, 제약이 없는 상태로 새 코드가 뜨면 검증이 앱에만 남으므로 `main` 배포보다 먼저 적용했습니다. 적용 전 `problem_url`이 `https`가 아니거나 500자를 넘는 행이 없는지 확인해야 제약 추가가 실패하지 않습니다(적용 시점 운영 데이터는 기록 5건 중 링크 0건).

그룹 생성·초대 수락·가입 승인·검수자 지정 함수가 연결되어 있습니다. 그룹 데이터는 ACTIVE 멤버만 조회하며, 작성자 본인의 풀이 검수는 차단됩니다.

## 도구 접근 제약

- Vercel MCP는 `hongyeseuls-projects` 스코프에 인증돼 있지 않아 `list_deployments`가 403을 반환합니다. 배포 상태는 `gh api repos/HongYeseul/coding-test-verification/deployments`와 커밋 상태로 확인했습니다. MCP로 배포를 다루려면 해당 스코프로 다시 인증해야 합니다.
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

- 소유자는 그룹 상단의 `멤버 초대` 버튼에서 초대 링크 복사와 코드 발급을 할 수 있습니다. 하단 가입 승인 목록은 대기 중인 신청자가 있을 때만 표시합니다.
- 5자리 공유 코드로 가입 신청 후 소유자가 승인합니다. 7일 만료, 재발급 시 이전 코드 무효화, 사용자당 15분에 5회 입력 제한을 적용합니다.
- 플랫폼 계정 없이 JPG·PNG·WebP 원본을 20MB까지 선택합니다. 긴 변 최대 1,920px, 150KB 목표로 압축하며 필요하면 1,600px·1,280px까지 줄입니다. 미리보기에서 글자를 확인한 후 업로드하며 새 파일의 저장 상한은 브라우저와 Storage 버킷 모두 300KB입니다. 기존 사진과 검수·취소는 유지합니다. 제목은 선택이고 사진 속 문제명·날짜 자동 추출은 하지 않습니다.
- 실제 DB에서 코드 공유·재발급·시도 제한, 승인 전 접근 차단, 사진 제출·검수·삭제 권한을 검증했습니다. SQL 테스트는 `supabase/tests/invite_codes_and_photos.sql`에 있으며 데이터는 롤백합니다.
- 검수 취소는 본인의 PENDING 기록만 가능하며, CANCELING 상태에서 사진 삭제를 확인한 뒤 기록을 삭제합니다. 삭제 실패 시 같은 버튼으로 재시도하고 현황판 집계에서는 제외합니다.
- `tests/cancel-proof-action.test.mjs`는 반복 취소·Storage 실패·응답 유실을 검증합니다. `supabase/tests/cancel_proof.sql`은 실제 DB의 취소 권한과 검수 차단을 검증하고 롤백합니다. SQL 테스트의 사진 삭제는 Storage 메타데이터 경로 변경으로 모사합니다.
- 기존 플랫폼 계정 기록과 대상 계정 초대 링크는 유지합니다. 공식 API 자동 확인과 영상 업로드 화면은 현재 범위에 포함하지 않습니다.

환경변수 설정 방법과 Storage 경로 계약은 [README.md](../README.md)를 참고합니다. 관리자 키, OAuth Client Secret, DB 비밀번호, 인증 토큰은 저장소에 추가하지 않습니다.

## 그룹 현황판

- 그룹 화면 상단에 오늘 참여 인원·주간 승인·검수 대기와 멤버별 주간 달력을 표시합니다.
- `get_group_overview`는 호출자의 ACTIVE 멤버십을 확인하고 RLS를 적용해 전체 기록을 집계합니다. 날짜는 한국시간의 인증 등록일이며 주간 범위는 월~일입니다.
- 상단 화살표로 다른 주를 봅니다. 선택한 주는 주소의 `week` 값으로 유지하며 `get_group_overview(target_group_id, target_week_start)`가 그 주 월요일로 맞추고 그룹 생성 주와 이번 주 사이로 제한합니다. 응답의 `weekEnd`·`currentWeekStart`·`firstWeekStart`로 화살표 활성 여부를 정합니다.
- 주간 승인·발자취 달력·대표 사진은 선택한 주를 따르고, 오늘 참여·누적 승인·검수 대기는 시점과 무관한 현재 값입니다. 취소 처리 중(CANCELING) 기록은 오늘 참여에서 제외합니다.
- 현재 ACTIVE 멤버만 집계하고 인증이 없는 멤버도 0건으로 표시합니다. 새로고침 버튼으로 다른 멤버의 변경을 갱신합니다.
- 멤버별 선택한 주의 첫 사진 한 장을 해당 날짜의 대표 썸네일로 지연 로딩합니다. 사진을 누르면 그룹 권한을 다시 확인한 뒤 크게 보여줍니다.
- 최근 50개 풀이 기록은 현재 그룹 전체 작성자의 기록이며, 현황판 집계에는 이 개수 제한을 적용하지 않습니다.
- 회귀 테스트: `supabase/tests/group_overview.sql`의 1,000건 초과 집계, 주간 경계, 지난 주 집계와 월요일 정규화, 미래 주·생성 이전 주 제한, 상태 구분, 비로그인·가입 대기·탈퇴·타 그룹 접근 차단. 화면의 주간 이동 링크는 `tests/group-overview-week.test.mjs`로 확인합니다.
- 스터디 소통 채널은 카카오톡입니다. 카카오톡 알림, 공동 목표, 응원 반응, 연속 참여 집계는 아직 구현하지 않았습니다.

## 화면 전환과 무료 운영

- DB 프로젝트·리전·인증·사진은 이전하지 않습니다. Vercel 함수만 기존 DB와 가까운 `syd1`에 배포합니다.
- 목록과 그룹 화면에 `loading.tsx`가 있으며 데이터 조회 중 로딩 화면을 표시합니다.
- 초대코드는 본문과 병렬 조회하고 플랫폼 계정은 표시할 풀이에서 참조한 계정만 조회합니다. ACTIVE 멤버십 검사와 RLS는 유지합니다.
- 유료 이미지 변환·관측 도구·추가 DB를 사용하지 않습니다. Vercel Hobby는 비상업적 개인 용도이며 무료 사용량 초과 시 제한될 수 있습니다.
- Supabase Free의 주요 한도는 DB 500MB, 파일 1GB, egress 5GB와 cached egress 5GB입니다. 한도와 사용량은 운영 대시보드에서 확인하며 자동 유료 전환은 신청하지 않습니다.
