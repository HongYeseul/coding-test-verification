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
- 소유자의 검수자 지정·해제, 초대 링크를 유지하는 로그인 재시도·계정 전환
- Vercel 배포가 가능한 Next.js 기본 화면

그룹 생성과 초대 수락은 인증 사용자를 확인하는 PostgreSQL 함수에서 원자적으로 처리합니다. 그룹 데이터는 서버와 RLS에서 모두 `ACTIVE` 멤버십을 확인합니다.

사진을 올리면 검수 대기 풀이 기록이 생성됩니다. 플랫폼 계정·문제 URL은 필요하지 않고 제목은 선택입니다. JPG·PNG·WebP 원본을 20MB까지 선택할 수 있으며, 업로드 전에 브라우저에서 긴 변 1,920px 이하로 줄이고 WebP로 압축합니다. WebP 인코딩을 지원하지 않는 브라우저는 JPEG를 사용합니다. 약 500KB를 목표로 하되 가독성을 위해 더 크게 저장될 수 있고, 작은 원본이 압축본보다 작으면 원본을 사용합니다. 저장 한도는 6MB입니다.

사진의 문제명·풀이 날짜를 자동 추출하지 않으며 등록 시각을 기록합니다. 그룹의 `OWNER` 또는 `REVIEWER`가 사진을 확인합니다.

초대코드는 7일 동안 여러 사람이 사용할 수 있습니다. 새 코드를 만들면 이전 코드는 만료됩니다. 가입 신청은 로그인 사용자마다 15분에 5회까지 가능하며, 승인 전에는 그룹 기록을 볼 수 없습니다. 기존 대상 계정 초대 링크와 플랫폼 계정 기반 기록은 유지합니다.

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

제출자는 검수 전 기록만 삭제 후 다시 등록할 수 있습니다. 기록을 삭제한 뒤에만 사진을 삭제할 수 있고, 같은 경로의 파일 교체는 허용하지 않습니다. 작성자 본인은 자신의 인증을 승인할 수 없습니다. 사진은 활성 멤버 확인 후 발급한 60초 유효 서명 URL로 표시합니다.

DB 권한 회귀 테스트는 SQL Editor에서 `supabase/tests/invite_codes_and_photos.sql`을 실행합니다. 테스트 데이터는 트랜잭션 종료 시 모두 롤백됩니다.

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
