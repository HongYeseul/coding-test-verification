const view = Object.fromEntries(
  ["connect", "settings", "repo", "repo-link", "create", "repo-name", "create-button", "signout", "status"]
    .map((id) => [id, document.getElementById(id)]),
);
const NEW_REPO = "new";
let revision = 0;

document.getElementById("seal").append(window.dojangSeal({ size: 26 }));

function say(message, bad = false) {
  view.status.textContent = message;
  view.status.classList.toggle("error", bad);
}

async function request(message) {
  try {
    return (await chrome.runtime.sendMessage(message)) ?? { error: "요청을 마치지 못했습니다. 다시 시도해주세요." };
  } catch {
    return { error: "확장 프로그램에 연결하지 못했습니다. 팝업을 다시 열어주세요." };
  }
}

async function render() {
  const current = ++revision;
  const state = await request({ type: "github-state" });
  if (current !== revision) return;
  if (state.error) return say(state.error, true);
  view.connect.hidden = state.connected;
  view.connect.textContent = state.repo ? "GitHub 다시 연결" : "GitHub로 로그인";
  view.settings.hidden = !state.connected;
  view.signout.hidden = !state.connected && !state.repo;
  view.create.hidden = true;
  if (!state.connected) {
    say(state.repo ? "연결이 풀렸습니다. 다시 로그인하면 선택한 저장소를 이어서 사용합니다." : "GitHub로 로그인하고 저장소를 선택해주세요.");
    return;
  }
  view["repo-link"].hidden = !state.repo;
  if (state.repo) {
    view["repo-link"].href = state.url;
    view["repo-link"].textContent = state.repo;
  }
  view.repo.disabled = true;
  const result = await request({ type: "list-repos" });
  if (current !== revision) return;
  if (result.error) {
    view.connect.hidden = false;
    view.connect.textContent = "GitHub 다시 연결";
    return say(result.error, true);
  }
  const repos = [...new Set([...(state.repo ? [state.repo] : []), ...result.repos])];
  view.repo.replaceChildren(
    new Option("저장소 고르기", ""),
    ...repos.map((name) => new Option(name, name)),
    new Option("새 저장소 만들기…", NEW_REPO),
  );
  view.repo.value = state.repo ?? "";
  view.repo.disabled = false;
  say(state.repo ? "정답 제출 시 이 저장소에 자동으로 올립니다." : "풀이를 올릴 저장소를 선택해주세요.");
}

view.connect.addEventListener("click", async () => {
  view.connect.disabled = true;
  say("GitHub 창에서 권한을 허용해주세요. 창이 닫히면 도장 아이콘을 다시 눌러주세요.");
  // 로그인 창 때문에 팝업이 닫혀도 background에서 연결을 마칩니다.
  const result = await request({ type: "connect-github" });
  view.connect.disabled = false;
  if (result.error) return say(result.error, true);
  await render();
});

view.repo.addEventListener("change", async () => {
  view.create.hidden = view.repo.value !== NEW_REPO;
  if (view.repo.value === NEW_REPO) return view["repo-name"].focus();
  if (!view.repo.value) return;
  view.repo.disabled = true;
  const state = await request({ type: "choose-repo", repo: view.repo.value });
  view.repo.disabled = false;
  if (state.error) return say(state.error, true);
  await render();
});

view["create-button"].addEventListener("click", async () => {
  view["create-button"].disabled = true;
  const state = await request({ type: "create-repo", name: view["repo-name"].value });
  view["create-button"].disabled = false;
  if (state.error) return say(state.error, true);
  await render();
});

view.signout.addEventListener("click", async () => {
  const result = await request({ type: "disconnect-github" });
  if (result.error) return say(result.error, true);
  await render();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes["dojang.github"]) void render();
});
void render();
