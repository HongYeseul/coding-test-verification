import { signOut } from "./auth.js";
import {
  chooseRepoByName,
  connectGithub,
  disconnectGithub,
  createAndChooseRepo,
  githubState,
  repoNames,
  uploadSolution,
} from "./github.js";
import { injectIntoOpenTabs } from "./inject.js";
import { readable } from "./errors.js";

chrome.runtime.onInstalled.addListener((details) => {
  void injectIntoOpenTabs(details);
});

// 여러 탭에서 동시에 정답이 나와도 같은 저장소의 커밋을 순서대로 올립니다.
let uploads = Promise.resolve();
function enqueueUpload(input) {
  const pending = uploads.then(() => uploadSolution(input));
  uploads = pending.catch(() => {});
  return pending;
}

const TASKS = new Map([
  [
    "push-code",
    { run: enqueueUpload, fallback: "저장소에 올리지 못했습니다." },
  ],
  [
    "disconnect-github",
    {
      run: async () => {
        await signOut();
        await disconnectGithub();
        return githubState();
      },
      fallback: "로그아웃하지 못했습니다.",
    },
  ],
  [
    "connect-github",
    { run: connectGithub, fallback: "GitHub 연결을 마치지 못했습니다." },
  ],
  [
    "github-state",
    { run: githubState, fallback: "GitHub 연결 상태를 읽지 못했습니다." },
  ],
  [
    "list-repos",
    { run: repoNames, fallback: "저장소 목록을 불러오지 못했습니다." },
  ],
  [
    "choose-repo",
    {
      run: ({ repo }) => chooseRepoByName(repo),
      fallback: "저장소를 고르지 못했습니다.",
    },
  ],
  [
    "create-repo",
    {
      run: ({ name }) => createAndChooseRepo(name),
      fallback: "저장소를 만들지 못했습니다.",
    },
  ],
]);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const task = TASKS.get(message?.type);
  if (!task) return false;
  task.run(message).then(sendResponse, (error) =>
    sendResponse({
      error: readable(error, task.fallback),
      // 저장소 연결이 풀려 못 했으면 카드가 ‘GitHub 다시 연결’을 띄웁니다.
      ...(error?.reconnect ? { reconnect: true } : {}),
    }),
  );
  // 비동기로 답하므로 채널을 열어둡니다.
  return true;
});
