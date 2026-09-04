# 배포 인수인계

마지막 정리: 2026-09-05

이 문서는 다른 PC에서 Vercel 배포를 이어가기 위한 현재 상태만 기록합니다. 프로젝트 구성과 Supabase 설정 방법은 [`README.md`](../README.md)를 참고합니다.

## 현재 상태

- GitHub 저장소: `https://github.com/HongYeseul/coding-test-verification`
- 저장소 공개 범위: Private
- 기본 브랜치: `main`
- 인수인계 작성 전 원격 HEAD: `86ed0ec18ab3e98e49deef23c49e5d0fbd9958b7`
- Vercel 워크스페이스 slug: `hongyeseuls-projects`
- Vercel 프로젝트와 배포 URL은 아직 생성되지 않았습니다.

Vercel 대시보드에서 GitHub 연결을 시작했고, GitHub App 접근 범위를 `HongYeseul/coding-test-verification` 한 저장소로 제한했습니다. 설치 마지막 단계에서 GitHub sudo mode의 Passkey 본인 확인이 필요해 중단됐습니다. 다른 PC에서는 GitHub App 설치 상태를 먼저 확인하고, 미완료라면 같은 범위로 다시 설치합니다.

Vercel MCP 연결도 확인했지만 당시 세션에서는 다음 제약이 있었습니다.

- `list_teams`가 빈 배열을 반환했습니다.
- `list_projects`에 `hongyeseuls-projects`를 전달해도 조회가 실패했습니다.
- `deploy_to_vercel` 쓰기 호출은 해당 작업의 승인 정책에 차단됐습니다.

새 PC의 새 작업에서는 MCP 연결과 계정 범위를 다시 확인합니다. MCP 직접 배포는 GitHub 자동 배포 연결을 보장하지 않으므로, 지속 배포가 목적이면 Vercel 대시보드에서 이 GitHub 저장소를 Import하는 방식이 우선입니다.

## 이어서 진행할 순서

1. GitHub CLI를 `HongYeseul` 계정으로 로그인합니다.
2. 저장소를 clone하고 `main` 최신 상태를 확인합니다.
3. Node.js 24를 사용해 아래 검증을 실행합니다.

   ```bash
   nvm use
   corepack enable
   pnpm install --frozen-lockfile
   pnpm check
   ```

4. Vercel의 `hongyeseuls-projects` 워크스페이스에서 GitHub 저장소를 Import합니다.
5. 프로젝트 이름은 `coding-test-verification`, Framework Preset은 Next.js, Root Directory는 저장소 루트로 둡니다.
6. Supabase 프로젝트가 아직 없으면 환경변수를 빈 값으로 만들지 않고 첫 배포를 진행합니다. 이 상태에서는 랜딩 화면이 열리고 GitHub 로그인 버튼만 비활성화됩니다.
7. Production 배포가 끝나면 실제 URL에서 HTTP 200과 `오늘 푼 문제를 함께 확인합니다.` 문구를 확인합니다.
8. 생성된 Vercel 프로젝트 ID와 Production URL을 이 문서에 추가해 커밋합니다.

## 이후 Supabase 연결

Supabase 프로젝트를 만든 다음 마이그레이션 적용, GitHub OAuth 설정, Vercel 환경변수 등록 순서로 진행합니다. 필요한 값과 callback URL은 [`README.md`](../README.md)에 정리되어 있습니다.

다음 값은 저장소에 커밋하지 않습니다.

- `.env.local`
- Supabase 관리자 키
- GitHub OAuth Client Secret
- Vercel 인증 토큰

## 확인된 검증 결과

- `pnpm lint`, `pnpm typecheck`, `pnpm build` 통과
- PostgreSQL 17 환경에서 초기 마이그레이션 적용 통과
- ACTIVE 멤버 RLS, 타인 플랫폼 계정 제출 차단, 자기 검수 차단, 검수 완료 증빙 삭제 차단 확인
- `86ed0ec`은 검증 완료 뒤 `package.json`의 패키지 이름만 변경한 커밋입니다.

## Suggested skills

- 배포 빌드가 실패하거나 동작이 예상과 다를 때: `diagnosing-bugs`
- 다음 작업도 다른 세션으로 넘겨야 할 때: `handoff`
