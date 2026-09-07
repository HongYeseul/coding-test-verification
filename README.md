# Coding Proof

초대된 멤버끼리 코딩 테스트 풀이 기록을 제출하고 확인하는 비공개 스터디 서비스입니다.

진행 중인 Vercel 배포 상태는 [`docs/DEPLOYMENT_HANDOFF.md`](docs/DEPLOYMENT_HANDOFF.md)에서 확인합니다.

## 현재 범위

- GitHub OAuth 로그인을 위한 Supabase SSR 클라이언트
- 초대·멤버십·플랫폼 계정·풀이 인증·검수 데이터 모델
- `ACTIVE` 그룹 멤버 기준 PostgreSQL RLS
- 증빙 이미지·영상용 비공개 Storage 정책
- 그룹 생성, 5자리 초대코드 공유·가입 신청, 소유자 가입 승인
- 플랫폼 계정 없이 사진으로 풀이 등록, 승인·반려 검수 화면
- 풀이에 남긴 문제 링크와 그룹이 푼 문제 모음
- 그룹 현황판: 오늘 참여 인원, 멤버별 주간·누적 승인과 검수 대기, 주간 인증 매트릭스와 지난 주 이동
- 풀이 기록 탭·필터와 사진·검수를 한 화면에서 처리하는 상세 모달
- 소유자의 검수자 지정·해제, 초대 링크를 유지하는 로그인 재시도·계정 전환
- 본인 닉네임·한 줄 소개를 정하는 프로필 화면과 신원 확인용 GitHub 아이디 표시
- Vercel 배포가 가능한 Next.js 기본 화면

그룹 생성과 초대 수락은 인증 사용자를 확인하는 PostgreSQL 함수에서 원자적으로 처리합니다. 그룹 데이터는 서버와 RLS에서 모두 `ACTIVE` 멤버십을 확인합니다.

사진을 올리면 검수 대기 풀이 기록이 생성됩니다. 플랫폼 계정은 필요하지 않고 제목과 문제 링크는 선택입니다. JPG·PNG·WebP 원본을 20MB까지 선택할 수 있습니다. 브라우저에서 긴 변 최대 1,920px, 150KB 목표로 WebP 압축하며 필요하면 1,600px·1,280px까지 줄입니다. 작은 원본은 확대하지 않고, WebP 미지원 브라우저는 JPEG를 사용합니다. 압축본 미리보기에서 글자를 확인한 후 업로드합니다. 저장 한도는 300KB이며, 초과하면 필요한 부분만 잘라 다시 선택해야 합니다. 새 업로드는 Storage 버킷에서도 같은 한도를 적용합니다. 기존 사진은 변경하지 않습니다.

사진의 문제명·풀이 날짜를 자동 추출하지 않으며 등록 시각을 기록합니다. 그룹의 `OWNER` 또는 `REVIEWER`가 사진을 확인합니다.

## 화면 구성

폭 1024px 한 칸에 상단바, 그룹 헤더, 주간 현황, 풀이 기록을 세로로 쌓습니다. 그림자 없이 1px 테두리와 12px 라운드만 쓰고, 색은 `light-dark()` 토큰 한 벌로 정의해 라이트·다크를 함께 처리합니다. 색·간격·버튼 정의는 `src/app/globals.css`에 모여 있습니다.

주간 현황은 멤버를 행, 월요일부터 일요일까지를 열로 놓은 표입니다. 멤버는 선택한 주의 승인 건수가 많은 순으로 놓고, 건수가 같으면 닉네임순입니다. 주를 옮기면 그 주의 승인 건수로 순서를 다시 계산합니다. 기록이 있는 칸은 검수 대기 `◷`, 승인 `✓`, 반려 `×` 중 하나를 보여주고 두 건 이상이면 건수를 덧붙입니다. 칸을 누르면 그 멤버와 날짜로 좁힌 풀이 기록으로 이동합니다. 지나지 않은 날은 `–`, 기록 없는 날은 `·`입니다.

풀이 기록은 전체 기록·검수 대기·내 기록 탭과 이름 검색·멤버·상태·기간 필터를 씁니다. 탭과 필터는 모두 주소 질의값이라 링크를 공유하거나 뒤로 가기로 돌아갈 수 있고, 선택을 바꾸면 바로 적용합니다. 스크립트가 없으면 ‘적용’ 버튼으로 제출합니다.

기록 한 줄을 누르면 상세 모달이 열립니다. 왼쪽은 인증 사진, 오른쪽은 작성자·등록 시각·출처·문제 링크이며, 검수 권한이 있으면 피드백과 승인·반려 버튼이 함께 열립니다. 반려는 이유를 적어야 보냅니다. 본인의 검수 대기 기록에서는 취소를 여기서 처리하고, 이전·다음으로 목록 순서대로 넘길 수 있습니다. 풀이 등록도 헤더의 ‘풀이 인증하기’로 여는 모달입니다.

## 프로필

상단바의 ‘프로필’에서 자신의 닉네임과 한 줄 소개를 정합니다. 닉네임은 40자, 한 줄 소개는 80자까지이며 소개는 비워둘 수 있습니다. 저장할 때 앞뒤 공백과 연속 공백을 정리하고 보이지 않는 문자를 지웁니다. DB도 공백만으로 된 이름과 제어문자, 길이 초과를 막습니다.

닉네임은 같은 그룹 안에서 겹칠 수 있습니다. 대신 프로필에 로그인한 GitHub 아이디를 함께 보관해 이름을 바꿔도 누구인지 확인할 수 있게 합니다. 아이디는 주간 현황의 멤버 이름 옆, 소유자의 가입 승인·검수자 지정 화면, 풀이 상세 모달의 작성자 옆에 `@아이디`로 나옵니다. 한 줄 소개는 주간 현황에서 멤버 이름 칸에 마우스를 올리면 카드로 보여줍니다.

GitHub 아이디는 로그인 계정의 `auth.identities`에서만 채우며 사용자가 바꿀 수 없습니다. `profiles`의 UPDATE 권한을 `display_name`과 `bio` 두 컬럼으로만 열어 두었기 때문에 브라우저에서 직접 요청해도 아이디와 아바타 주소는 바뀌지 않습니다. RLS는 행 단위라 컬럼을 막지 못하므로 컬럼 단위 권한으로 처리합니다.

기존 멤버의 닉네임은 가입할 때 받은 GitHub 아이디 그대로이며 마이그레이션이 값을 바꾸지 않습니다.

## 문제 링크

풀이를 등록할 때 문제 링크를 선택으로 넣을 수 있습니다. 프로그래머스, 백준, LeetCode, Codeforces, AtCoder, HackerRank, Codewars의 `https` 주소만 받습니다. 호스트는 `www.`만 떼고 정확히 비교하므로 이름이 비슷한 다른 도메인은 통과하지 않습니다. 저장할 때 쿼리·프래그먼트·끝 슬래시를 지워 언어 선택 같은 파라미터가 달라도 같은 문제로 모입니다. DB는 `https`와 500자 상한을 확인하고, 허용 플랫폼 판단은 저장할 때와 화면에 그릴 때 모두 앱에서 처리합니다.

‘우리 그룹이 푼 문제’는 링크를 남긴 기록을 최근 200건까지 모아 같은 문제를 하나로 묶고, 등록한 멤버와 본인 등록 여부를 함께 보여줍니다. 반려·취소 처리 중인 기록은 제외하며 풀이 기록 목록의 검색·필터와는 무관하게 그룹 전체를 봅니다. 링크는 참고용이며 검수 대상은 사진입니다. 등록한 기록의 링크는 나중에 고칠 수 없습니다.

문제 제목은 사용자가 직접 입력합니다. 크롤링을 금지한 플랫폼이 있어 링크에서 제목을 가져오지 않습니다.

초대코드는 7일 동안 여러 사람이 사용할 수 있습니다. 새 코드를 만들면 이전 코드는 만료됩니다. 가입 신청은 로그인 사용자마다 15분에 5회까지 가능하며, 승인 전에는 그룹 기록을 볼 수 없습니다. 기존 대상 계정 초대 링크와 플랫폼 계정 기반 기록은 유지합니다.

현황판은 현재 `ACTIVE` 멤버의 전체 기록을 집계합니다. 한국시간의 인증 등록일을 기준으로 월요일부터 일요일까지 표시하며, 최근 50개 목록 제한과 무관합니다. 오늘 참여에는 승인·검수 대기를 포함하고 반려와 취소 처리 중인 기록은 제외합니다. 주간·누적 승인에는 승인된 기록만 포함하며, 검수 결과가 바뀌면 해당 등록일의 집계도 바뀝니다. 다른 멤버의 변경은 ‘현황 새로고침’으로 확인합니다.

현황판 상단의 화살표로 다른 주를 볼 수 있습니다. 선택한 주는 주소의 `week` 값으로 유지하므로 링크를 그대로 공유하거나 뒤로 가기로 돌아갈 수 있습니다. 그룹이 만들어진 주보다 이전과 아직 오지 않은 주는 열지 않으며, 어떤 날짜를 넣어도 그 주 월요일로 맞춥니다. 이 판단은 모두 `get_group_overview`에서 처리합니다. 주간 승인과 인증 매트릭스는 선택한 주를 따르고 오늘 참여·누적 승인·검수 대기는 시점과 무관하게 현재 값을 보여줍니다.

## 구성

- Next.js App Router, TypeScript, Tailwind CSS
- Supabase Auth, PostgreSQL, Storage
- Vercel
- Node.js 24, pnpm 11

별도 서버를 운영하지 않습니다. GitHub의 `main` 브랜치를 Vercel Production에 연결하고, 다른 브랜치와 Pull Request는 Preview 배포로 확인합니다.

## 로컬 실행

```bash
nvm install
nvm use
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

`http://localhost:3000`에서 확인합니다. Supabase 환경변수가 비어 있으면 화면은 열리지만 GitHub 로그인 버튼은 비활성화됩니다.

## 환경변수

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

프로젝트 URL과 Publishable Key는 Supabase의 Connect 화면에서 확인합니다. 관리자 키는 현재 필요하지 않으며 브라우저 환경변수로 추가하면 안 됩니다.

## Supabase 설정

1. Supabase 프로젝트를 생성합니다.
2. SQL Editor 또는 Supabase CLI로 `supabase/migrations`의 마이그레이션을 적용합니다.
3. Authentication > Providers에서 GitHub를 활성화합니다.
4. GitHub OAuth App의 callback URL을 아래 주소로 등록합니다.

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

5. Supabase URL Configuration에 주소를 등록합니다.

- Site URL: 운영 Vercel 주소
- Redirect URLs: `http://localhost:3000/**`, 운영 주소의 `/auth/callback`, 사용할 Preview 주소 패턴

GitHub OAuth callback은 Vercel 주소가 아니라 Supabase callback 주소라는 점에 주의합니다.

로그인 복귀 경로를 포함하려면 허용 목록에 `https://<운영 도메인>/auth/callback**`와 `http://localhost:3000/auth/callback**`를 등록합니다. 초대 대상 GitHub 아이디는 사용자가 수정할 수 있는 프로필 대신 OAuth 제공자가 확인한 `auth.identities`에서 검사합니다.

로컬 PostgreSQL 17 환경은 Docker 실행 후 아래 명령으로 시작합니다.

```bash
npx supabase start
```

## Vercel 배포

1. 이 저장소를 GitHub에 push합니다.
2. Vercel의 New Project에서 GitHub 저장소를 Import합니다.
3. Supabase 환경변수 세 개를 Development, Preview, Production 환경에 맞게 등록합니다.
4. 첫 배포 후 생성된 Production URL을 Supabase Site URL과 Redirect URLs에 반영합니다.
5. 환경변수나 OAuth URL을 바꿨다면 새로 배포합니다.

초기 기능은 사용자의 요청으로 동작하므로 Cron은 필요하지 않습니다. Codeforces 정기 동기화가 필요해질 때 별도로 추가합니다.

## 증빙 파일 경로

Storage의 `proof-evidence` 버킷은 비공개입니다. 파일 경로는 다음 계약을 사용합니다.

```text
<group-id>/<user-id>/<file-id>.<extension>
```

`ACTIVE` 그룹 멤버만 읽을 수 있고, 작성자는 자신의 경로에만 업로드할 수 있습니다. 증빙은 공개 URL로 제공하지 않습니다.

제출자는 검수 대기 중인 본인 기록을 취소할 수 있습니다. 취소를 시작하면 검수를 막고 사진 삭제를 확인한 뒤 업로드 기록을 삭제합니다. 사진 삭제에 실패하면 기록의 ‘삭제 다시 시도’를 눌러 완료할 수 있습니다. 같은 경로의 파일 교체와 작성자 본인의 인증 승인은 허용하지 않습니다. 사진은 활성 멤버 확인 후 발급한 60초 유효 서명 URL로 표시합니다.

DB 권한 회귀 테스트는 SQL Editor에서 `supabase/tests/invite_codes_and_photos.sql`을 실행합니다. 테스트 데이터는 트랜잭션 종료 시 모두 롤백됩니다.

현황판 전체 집계·한국시간 주간 경계·주간 이동 범위·접근 권한은 `supabase/tests/group_overview.sql`로 검증합니다. 이 테스트도 데이터를 모두 롤백합니다.

문제 링크의 DB 제약은 `supabase/tests/problem_links.sql`로 검증합니다.

실제 브라우저 압축 검증은 `node tests/photo-compression-server.mjs` 실행 후 `http://127.0.0.1:3913`에서 진행합니다. 생성한 이미지로 압축 크기·해상도·손상 파일 처리를 확인하며 운영 DB와 Storage는 사용하지 않습니다.

## 명령어

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
pnpm check
pnpm test
```

## 디렉터리

```text
src/app/                 화면과 Route Handler
src/components/          공용 UI
src/lib/supabase/        브라우저·서버·Proxy 클라이언트
supabase/migrations/     데이터 모델과 RLS
```
