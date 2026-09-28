/**
 * 정답을 맞힌 순간에 뜨는 카드입니다. 프로그래머스·NeetCode·LeetCode가 함께 씁니다.
 *
 * 플랫폼마다 다른 것은 '정답을 어떻게 알아내고 코드를 어디서 읽느냐'뿐이고,
 * 그 뒤로 보여주고 보내는 일은 같습니다. 그래서 카드만 여기 모아 둡니다.
 * 한쪽을 고치다 다른 쪽만 옛 모습으로 남는 일을 막습니다.
 *
 * 부르는 쪽은 무엇을 남길지만 넘깁니다.
 *   dojangCard({ title, code, problemUrl, language, level, grading, mount, onStamped })
 *
 * language·level·grading은 GitHub 저장소에 올릴 때만 씁니다. language는 파일 확장자를,
 * level(난이도)과 grading(채점 결과)은 커밋 메시지를 정합니다.
 *
 * 두 카드의 줄은 늘 같은 순서입니다 — 문제, 코드, 저장소, 태그, 그리고 찍은 뒤에만 상태.
 * 같은 자리에 같은 것이 있어야 찍기 전후를 견주지 않고 읽습니다.
 * mount는 카드를 붙일 자리입니다. 프로그래머스는 결과 모달 안에 넣어야 하고
 * (programmers.js에 이유가 적혀 있습니다), 나머지는 body면 됩니다.
 * onStamped는 도장이 실제로 찍힌 뒤에만 부릅니다. 실패했을 때는 부르지 않아,
 * 감지하는 쪽이 '이미 남긴 풀이'로 착각하지 않게 합니다.
 */

// 이 스크립트 묶음이 띄운 카드에 붙이는 표시입니다.
//
// 확장을 새 버전으로 바꾸면 이미 열린 탭에 붙어 있던 옛 스크립트는 확장과 끊긴 채
// 페이지에 남아 계속 돕니다. background가 새 스크립트를 넣어 주지만 둘은 서로의 전역을
// 볼 수 없는 다른 격리 세계에서 돌고, 페이지 DOM만 같이 씁니다. 그래서 카드마다 어느
// 쪽이 띄웠는지 적어 두고 저마다 자기 카드만 다룹니다. 같은 세계에 두 번 들어오면
// 값을 이어받아 한 벌처럼 움직입니다.
window.dojangWorld = window.dojangWorld ?? crypto.randomUUID();

window.dojangCard = function dojangCard({
  title,
  code,
  problemUrl,
  language,
  level,
  grading,
  mount,
  onStamped,
}) {
  if (ownCard()) return;

  const card = el("div", "dojang-card");
  card.dataset.dojang = window.dojangWorld;
  const head = el("div", "dojang-head");
  head.append(seal(), el("span", null, "정답입니다"), closeButton());

  const size = `${code.split("\n").length}줄 · ${code.length}자`;
  const body = el("div", "dojang-body");
  body.append(row("문제", title || "제목 없음"));
  body.append(row("코드", size));

  const tagWrap = el("div");
  tagWrap.append(el("label", null, "주제 태그 (쉼표로 구분 · 5개까지 · 선택)"));
  const tags = el("input");
  tags.placeholder = "예: 해시, 정렬";
  tagWrap.append(tags);
  body.append(tagWrap);

  const stamp = el("button", "dojang-stamp", "도장 찍기");
  stamp.type = "button";
  // 무엇을 하는 카드인지는 이미 보고 있으므로 기본 설명은 두지 않습니다.
  // 스터디를 골라야 하거나 실패했을 때만 아래 줄이 뜹니다.
  const note = el("p", "dojang-note");
  note.hidden = true;
  body.append(stamp, note);

  const tell = teller(note);

  // 저장소 줄은 코드 아래, 태그 위입니다. 연결하는 동안에는 도장 찍기를 잠가 로그인 창이
  // 둘 뜨지 않게 합니다 — 로그인하지 않은 채 누르면 도장 찍기도 GitHub 창을 엽니다.
  let heldStamp = false;
  const repoView = repoRow({
    tell,
    onBusy(busy) {
      if (busy && !stamp.disabled) {
        stamp.disabled = true;
        heldStamp = true;
      } else if (!busy && heldStamp) {
        stamp.disabled = false;
        heldStamp = false;
      }
    },
  });
  body.insertBefore(repoView.line, tagWrap);

  card.append(head, body);
  (mount ?? document.body).append(card);
  // 방금 뜬 자리라 포커스가 아직 오가는 중일 수 있어 한 박자 뒤에 잡습니다.
  setTimeout(() => tags.focus(), 0);

  /** 스터디가 여럿이면 이 카드 안에서 고릅니다. */
  function askGroup(groups) {
    if (body.querySelector(".dojang-pick")) return;
    const wrap = el("div");
    wrap.append(el("label", null, "어느 스터디에 찍을까요?"));
    const picker = el("select", "dojang-pick");
    picker.append(new Option("고르기", ""));
    for (const group of groups) picker.append(new Option(group.name, group.id));
    wrap.append(picker);
    body.insertBefore(wrap, tagWrap);
    tell("스터디를 고르면 바로 도장을 찍습니다.");
    picker.addEventListener("change", () => {
      if (picker.value) void send(picker.value);
    });
    stamp.disabled = false;
    stamp.textContent = "도장 찍기";
  }

  async function send(groupId) {
    stamp.disabled = true;
    // 로그인이 필요하면 GitHub 창이 따로 뜨므로 여기서는 하는 일만 말합니다.
    stamp.textContent = "도장 찍는 중…";
    tell("");
    const result = await sendToBackground({
      type: "submit-code",
      solutionCode: code,
      problemUrl,
      title,
      tags: tags.value,
      groupId,
    });
    if (result?.chooseGroup) return askGroup(result.chooseGroup);
    if (result?.error) {
      stamp.disabled = false;
      stamp.textContent = "다시 시도";
      tell(result.error, true);
      return;
    }
    onStamped?.();
    const topics = tags.value;
    showResult(card, {
      title,
      size,
      tags: parseTags(topics),
      autoApproved: Boolean(result?.autoApproved),
      // 저장소를 골라 뒀으면 도장에 이어 풀이를 올립니다. 누르는 것은 여전히 도장 찍기 하나입니다.
      repo: result?.repo ?? null,
      upload: () =>
        sendToBackground(
          {
            type: "push-code",
            code,
            title,
            problemUrl,
            language,
            tags: topics,
            level,
            grading,
          },
          "저장소에 올리지 못했습니다. 다시 시도해주세요.",
        ),
    });
  }

  stamp.addEventListener("click", () => {
    if (!stamp.disabled) void send();
  });

  // 버튼과 같은 자리에서 터뜨려 둘이 한 동작으로 읽히게 합니다.
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
 * 할 일을 백그라운드에 맡깁니다. 답을 받지 못해도 버튼이 '도장 찍는 중'에 멈춰 있지
 * 않도록 실패를 결과로 바꿔 돌려줍니다. failure는 무엇을 못 했는지 말하는 문장입니다.
 */
async function sendToBackground(
  message,
  failure = "도장을 찍지 못했습니다. 다시 시도해주세요.",
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

/** 쉼표로 나눈 태그를 화면에 되비추기 위한 것입니다. 서버가 다시 정리합니다. */
function parseTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * 저장소 줄입니다. 정답 카드와 결과 카드가 같은 자리 — 코드 아래 — 에 둡니다.
 *
 * 확장 팝업을 열어 보지 않은 사람도 정답 순간에 GitHub에 올릴 수 있다는 것을 알도록 늘
 * 보입니다. 연결 전이면 연결 단추, 연결했으면 저장소 이름(누르면 그 저장소로)과 바꾸기를
 * 둡니다. 고르는 것도 카드 안에서 합니다. 연결·목록·고르기·만들기는 background가 하고
 * 토큰은 카드로 오지 않습니다.
 *
 * onChosen은 이 줄에서 저장소가 정해질 때 부릅니다. 결과 카드는 여기서 방금 찍은 풀이를
 * 올립니다. onBusy는 연결하는 동안 참입니다.
 */
function repoRow({ tell, onChosen, onBusy }) {
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
        button("dojang-small", "GitHub 저장소 연결", connect),
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
    // 상태를 못 읽으면 줄을 치웁니다. 도장 찍기는 저장소와 상관없이 돼야 합니다.
    if (state.error) line.remove();
    else show(state);
  }

  async function connect(node) {
    const label = node.textContent;
    node.disabled = true;
    node.textContent = "연결하는 중…";
    tell("GitHub 창에서 권한을 허용해주세요.");
    onBusy?.(true);
    const result = await sendToBackground(
      { type: "connect-github" },
      "GitHub 연결을 마치지 못했습니다. 다시 시도해주세요.",
    );
    onBusy?.(false);
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

  /** 저장소 줄을 고르는 칸으로 바꿉니다. 스터디를 고르는 칸과 같은 모양입니다. */
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

/**
 * 무엇이 저장됐는지 보여주고 5초 뒤에 사라집니다. 읽는 중에는 멈춥니다.
 * 저장소에 올리는 중이면 끝날 때까지 기다리고, 실패하면 닫을 때까지 둡니다.
 * 줄은 정답 카드와 같은 순서이고 상태만 맨 끝에 더합니다.
 */
function showResult(card, { title, size, tags, autoApproved, repo, upload }) {
  // 결과에는 입력칸이 없으니 붙어 있던 자리에서 빼내 body로 옮깁니다.
  // 모달이나 패널이 닫혀도 무엇이 저장됐는지는 남아 있어야 합니다.
  document.body.append(card);
  card.replaceChildren();
  card.classList.add("dojang-result");
  const head = el("div", "dojang-head");
  head.append(seal(), el("span", null, "도장을 찍었습니다"), closeButton());

  const body = el("div", "dojang-body");
  const note = el("p", "dojang-note");
  note.hidden = true;
  let line;
  if (repo) {
    // 올라갔는지 보기 전에 카드가 사라지면 확인할 길이 없어, 끝날 때까지 막대를 걸지 않습니다.
    line = row("저장소", "올리는 중…");
    void pushToRepo(card, line, upload);
  } else {
    // 찍을 때 연결돼 있지 않았으면 여기서도 연결할 수 있고, 정하면 방금 찍은 풀이를 올립니다.
    // 연결하거나 고르는 동안은 카드가 사라지지 않게 막대를 거둡니다.
    const tell = teller(note);
    line = repoRow({
      tell,
      onBusy: () => hold(card),
      onChosen() {
        const status = row("저장소", "올리는 중…");
        line.replaceWith(status);
        void pushToRepo(card, status, upload);
      },
    }).line;
    line.addEventListener("click", () => hold(card));
  }
  body.append(row("문제", title || "제목 없음"), row("코드", size), line);
  if (tags.length) body.append(row("태그", tags.join(", ")));
  body.append(row("상태", autoApproved ? "자동 인정" : "검수 대기"), note);
  card.append(head, body);
  if (!repo) countDown(card);
}

/** 저장소에 올리고 그 줄을 결과로 바꿉니다. 실패하면 이유와 다시 올리기를 둡니다. */
async function pushToRepo(card, line, upload) {
  const value = line.lastChild;
  value.classList.remove("dojang-bad");
  value.textContent = "올리는 중…";
  const result = await upload();
  if (result.error) {
    value.textContent = "올리지 못했습니다";
    value.classList.add("dojang-bad");
    const note = el("p", "dojang-note dojang-bad", result.error);
    const retry = el("button", "dojang-secondary", "다시 올리기");
    retry.type = "button";
    retry.addEventListener("click", () => {
      note.remove();
      retry.remove();
      void pushToRepo(card, line, upload);
    });
    line.after(note, retry);
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
