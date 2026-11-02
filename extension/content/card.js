/** 정답을 감지하면 선택한 GitHub 저장소에 올립니다. 토큰은 background에서만 다룹니다. */
window.dojangWorld = window.dojangWorld ?? crypto.randomUUID();
window.dojangUploads = window.dojangUploads ?? new Map();

window.dojangCard = function dojangCard({
  title, code, problemUrl, language, level, grading, catalog, statement, mount, onStamped,
}) {
  const key = JSON.stringify([problemUrl, language, code]);
  const previous = ownCard();
  if (previous?.dojangKey === key) return;
  previous?.remove();

  const card = el("div", "dojang-card");
  card.dataset.dojang = window.dojangWorld;
  card.dojangKey = key;
  const head = el("div", "dojang-head");
  head.append(seal(), el("span", "dojang-heading", "정답입니다"), closeButton());
  const body = el("div", "dojang-body");
  const note = el("p", "dojang-note");
  note.hidden = true;

  async function upload() {
    const state = await sendToBackground({ type: "github-state" });
    if (state.error) return state;
    const uploadKey = JSON.stringify([key, state.repo]);
    let pending = window.dojangUploads.get(uploadKey);
    if (!pending) {
      pending = sendToBackground({
        type: "push-code",
        code,
        title,
        problemUrl,
        language,
        tags: "",
        level,
        grading,
        catalog,
        statement,
      });
      window.dojangUploads.set(uploadKey, pending);
    }
    const result = await pending;
    if (window.dojangUploads.get(uploadKey) === pending)
      window.dojangUploads.delete(uploadKey);
    if (!result.error) onStamped?.();
    return result;
  }

  const repo = pickAndPush(card, note, upload);
  body.append(titleRow(title), row("코드", `${code.split("\n").length}줄 · ${code.length}자`), repo, note);
  card.append(head, body);
  (mount ?? document.body).append(card);
  window.dojangConfetti?.();
};

/**
 * 결과를 보여주는 중인지 봅니다. 감지 쪽이 카드를 함부로 치우지 않게 하는 표시입니다.
 * 막대로 보지 않습니다. 저장소에 올리는 동안이나 실패했을 때는 막대가 없어도 결과입니다.
 */
window.dojangCardShowingResult = function dojangCardShowingResult() {
  return Boolean(ownCard()?.classList.contains("dojang-result"));
};

window.dojangCardRemove = function dojangCardRemove() {
  ownCard()?.remove();
};

/**
 * 확장과 아직 이어져 있는지 봅니다. 끊긴 스크립트에서는 chrome.runtime이 사라집니다.
 * 감지하는 쪽은 이 값이 거짓이면 스스로 멈추고, 새로 들어온 스크립트가 뒤를 잇습니다.
 */
window.dojangConnected = function dojangConnected() {
  return Boolean(chrome.runtime?.id);
};

/** 이 세계가 띄운 카드입니다. 끊긴 옛 스크립트가 남긴 카드는 건드리지 않습니다. */
function ownCard() {
  return document.querySelector(
    `.dojang-card[data-dojang="${window.dojangWorld}"]`,
  );
}

/**
 * 할 일을 백그라운드에 맡깁니다. 답을 받지 못해도 올리는 중에 멈춰 있지
 * 않도록 실패를 결과로 바꿔 돌려줍니다. failure는 무엇을 못 했는지 말하는 문장입니다.
 */
async function sendToBackground(
  message,
  failure = "저장소에 올리지 못했습니다. 다시 시도해주세요.",
) {
  try {
    return (await chrome.runtime.sendMessage(message)) ?? { error: failure };
  } catch {
    // 확장을 새 버전으로 바꾸기 전에 떠 있던 카드는 보낼 곳을 잃습니다.
    return {
      error: window.dojangConnected()
        ? failure
        : "확장 프로그램이 새 버전으로 바뀌어 이 카드는 쓸 수 없습니다. 페이지를 새로고침한 뒤 다시 제출해주세요.",
    };
  }
}

/** 카드 아래 안내 줄에 쓰는 함수를 돌려줍니다. 빈 문장이면 줄을 숨깁니다. */
function teller(note) {
  return function tell(text, bad = false) {
    note.textContent = text;
    note.hidden = !text;
    note.classList.toggle("dojang-bad", bad);
  };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function row(name, value) {
  const line = el("div", "dojang-row");
  line.append(el("span", null, name), el("span", null, value));
  return line;
}

/** 문제 줄입니다. 제목이 길면 말줄임표로 줄어드니 마우스를 올리면 전체가 보이게 합니다. */
function titleRow(title) {
  const line = row("문제", title || "제목 없음");
  line.lastChild.title = title || "";
  return line;
}

function seal() {
  const node = el("span", "dojang-seal");
  node.setAttribute("aria-hidden", "true");
  node.append(window.dojangSeal({ size: 22 }));
  return node;
}

function closeButton() {
  const button = el("button", "dojang-close", "×");
  button.type = "button";
  button.setAttribute("aria-label", "닫기");
  button.addEventListener("click", window.dojangCardRemove);
  return button;
}

/** 저장소 연결·선택은 background에 맡기고, 고른 저장소만 화면에 표시합니다. */
function repoRow({ tell, onChosen, onReady }) {
  const NEW_REPO = "new";
  const line = el("div", "dojang-row");
  const value = el("span", "dojang-repo");
  line.append(el("span", null, "저장소"), value);
  let current = null;

  function button(className, text, onClick) {
    const node = el("button", className, text);
    node.type = "button";
    node.addEventListener("click", () => onClick(node));
    return node;
  }

  function show(state) {
    current = state.repo;
    if (state.connected && state.repo) {
      const link = el("a", null, state.repo);
      link.href = state.url;
      link.target = "_blank";
      link.rel = "noopener";
      value.replaceChildren(link, button("dojang-text", "바꾸기", pick));
    } else if (state.connected) {
      value.replaceChildren(button("dojang-small", "저장소 고르기", pick));
    } else if (state.repo) {
      // 토큰이 거절됐어도 고른 저장소는 남아 있습니다. 같은 계정으로 다시 연결하면 이어 씁니다.
      value.replaceChildren(
        el("span", "dojang-muted", state.repo),
        button("dojang-small", "다시 연결", connect),
      );
    } else {
      value.replaceChildren(
        button("dojang-small", "GitHub로 로그인", connect),
      );
    }
  }

  /** 정해진 저장소를 보여 주고 알립니다. */
  function chosen(state) {
    show(state);
    onChosen?.(state);
  }

  async function refresh() {
    const state = await sendToBackground(
      { type: "github-state" },
      "GitHub 연결 상태를 읽지 못했습니다.",
    );
    if (state.error) {
      tell(state.error, true);
      value.replaceChildren(button("dojang-small", "다시 시도", refresh));
    } else {
      show(state);
      onReady?.(state);
    }
  }

  async function connect(node) {
    const label = node.textContent;
    node.disabled = true;
    node.textContent = "연결하는 중…";
    tell("GitHub 창에서 권한을 허용해주세요.");
    const result = await sendToBackground(
      { type: "connect-github" },
      "GitHub 연결을 마치지 못했습니다. 다시 시도해주세요.",
    );
    if (result.error) {
      node.disabled = false;
      node.textContent = label;
      tell(result.error, true);
      return;
    }
    tell("");
    // 같은 계정으로 다시 연결했으면 전에 고른 저장소가 그대로입니다.
    const state = await sendToBackground(
      { type: "github-state" },
      "GitHub 연결 상태를 읽지 못했습니다.",
    );
    if (!state.error && state.connected && state.repo) return chosen(state);
    await pick();
  }

  /** 저장소 줄을 고르는 칸으로 바꿉니다. */
  async function pick() {
    const picker = el("div", "dojang-repo-pick");
    const select = el("select");
    select.append(new Option("저장소를 불러오는 중…", ""));
    select.disabled = true;
    // 고르지 않고 닫는 길입니다. 이미 고른 저장소를 그대로 두고 싶을 때도 씁니다.
    const head = el("div", "dojang-pick-head");
    head.append(
      el("label", null, "어느 저장소에 올릴까요?"),
      button("dojang-text", "취소", () => close()),
    );
    picker.append(head, select);
    line.replaceWith(picker);

    function close(state) {
      picker.replaceWith(line);
      if (state) chosen(state);
    }

    const result = await sendToBackground(
      { type: "list-repos" },
      "저장소 목록을 불러오지 못했습니다.",
    );
    if (result.error) {
      tell(result.error, true);
      return close();
    }
    select.replaceChildren(
      ...(current ? [] : [new Option("고르기", "")]),
      ...result.repos.map((name) => new Option(name, name)),
      new Option("새 저장소 만들기…", NEW_REPO),
    );
    // 목록 100개 밖의 저장소를 골라 뒀어도 지금 값은 보이게 합니다.
    if (current && !result.repos.includes(current))
      select.prepend(new Option(current, current));
    select.value = current ?? "";
    select.disabled = false;
    select.focus();

    let create = null;
    select.addEventListener("change", async () => {
      create?.remove();
      create = null;
      if (select.value === NEW_REPO) {
        create = newRepoForm((state) => close(state));
        picker.append(create);
        create.querySelector("input").focus();
        return;
      }
      if (!select.value) return;
      select.disabled = true;
      const state = await sendToBackground(
        { type: "choose-repo", repo: select.value },
        "저장소를 고르지 못했습니다.",
      );
      select.disabled = false;
      if (state.error) return tell(state.error, true);
      tell("");
      close(state);
    });
  }

  /** 새 저장소 이름을 받는 칸입니다. 공개 저장소로 만들고 바로 올릴 곳으로 정합니다. */
  function newRepoForm(done) {
    const form = el("div", "dojang-repo-pick");
    const name = el("input");
    name.placeholder = "새 저장소 이름";
    name.maxLength = 100;
    const make = button("dojang-secondary", "공개 저장소로 만들기", async () => {
      make.disabled = true;
      const state = await sendToBackground(
        { type: "create-repo", name: name.value },
        "저장소를 만들지 못했습니다.",
      );
      make.disabled = false;
      if (state.error) return tell(state.error, true);
      tell("");
      done(state);
    });
    form.append(name, make);
    return form;
  }

  void refresh();
  return { line };
}

/** 저장소가 이미 정해져 있거나 이 카드에서 고르면 바로 올립니다. */
function pickAndPush(card, note, upload) {
  let started = false;
  function start(state) {
    if (!state.repo || started) return;
    started = true;
    card.classList.add("dojang-result");
    // 입력이 끝났으므로 모달이 닫혀도 진행 상황을 볼 수 있게 옮깁니다.
    if (card.parentElement) document.body.append(card);
    const status = row("저장소", "올리는 중…");
    line.replaceWith(status);
    void pushToRepo(card, status, upload);
  }
  const line = repoRow({
    tell: teller(note),
    onChosen: start,
    onReady: start,
  }).line;
  return line;
}

/**
 * 저장소에 올리고 그 줄을 결과로 바꿉니다. 실패하면 이유와 다음 할 일을 카드 맨 아래에
 * 둡니다 — 줄 사이에 끼우면 찍기 전과 줄 순서가 달라집니다. 연결이 풀려 못 올렸으면
 * ‘다시 올리기’ 대신 ‘GitHub 다시 연결’을 두고, 연결되면 바로 이어 올립니다.
 */
async function pushToRepo(card, line, upload) {
  const value = line.lastChild;
  value.classList.remove("dojang-bad");
  value.textContent = "올리는 중…";
  const result = await upload();
  if (result.error) {
    value.textContent = "올리지 못했습니다";
    value.classList.add("dojang-bad");
    const note = el("p", "dojang-note dojang-bad", result.error);
    const tell = teller(note);
    const action = el(
      "button",
      "dojang-secondary",
      result.reconnect ? "GitHub 다시 연결" : "다시 올리기",
    );
    action.type = "button";
    action.addEventListener("click", async () => {
      if (result.reconnect) {
        action.disabled = true;
        action.textContent = "연결하는 중…";
        tell("GitHub 창에서 권한을 허용해주세요.");
        const connected = await sendToBackground(
          { type: "connect-github" },
          "GitHub 연결을 마치지 못했습니다. 다시 시도해주세요.",
        );
        if (connected.error) {
          action.disabled = false;
          action.textContent = "GitHub 다시 연결";
          tell(connected.error, true);
          return;
        }
        // 다른 계정으로 연결했으면 저장소를 다시 골라야 합니다. 고르면 이어서 올립니다.
        if (!connected.repo) {
          action.remove();
          tell("");
          line.replaceWith(pickAndPush(card, note, upload));
          return;
        }
      }
      note.remove();
      action.remove();
      void pushToRepo(card, line, upload);
    });
    line.parentElement.append(note, action);
    return;
  }
  const link = el(
    "a",
    null,
    result.unchanged ? `${result.repo} · 바뀐 것 없음` : result.repo,
  );
  link.href = result.url;
  link.target = "_blank";
  link.rel = "noopener";
  value.replaceChildren(link);
  card.querySelector(".dojang-heading").textContent = "저장소에 올렸습니다";
  countDown(card);
}

/** 5초 뒤에 사라집니다. 그 사이 닫고 새 카드가 떴으면 새 카드는 건드리지 않습니다. */
function countDown(card) {
  hold(card);
  // 움직임을 줄이기로 한 사용자에게는 막대가 움직이지 않으므로 시간으로 지웁니다.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    card.dojangCountdown = setTimeout(() => card.remove(), 5000);
    return;
  }
  const timer = el("div", "dojang-timer");
  card.append(timer);
  timer.addEventListener("animationend", () => card.remove());
}

/** 사라지기를 멈춥니다. 사용자가 카드에서 무언가를 하는 동안 카드가 없어지면 안 됩니다. */
function hold(card) {
  clearTimeout(card.dojangCountdown);
  card.querySelector(".dojang-timer")?.remove();
}
