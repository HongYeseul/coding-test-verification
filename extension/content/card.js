/**
 * 정답을 맞힌 순간에 뜨는 카드입니다. 프로그래머스와 NeetCode가 함께 씁니다.
 *
 * 플랫폼마다 다른 것은 '정답을 어떻게 알아내고 코드를 어디서 읽느냐'뿐이고,
 * 그 뒤로 보여주고 보내는 일은 같습니다. 그래서 카드만 여기 모아 둡니다.
 * 한쪽을 고치다 다른 쪽만 옛 모습으로 남는 일을 막습니다.
 *
 * 부르는 쪽은 무엇을 남길지만 넘깁니다.
 *   dojangCard({ title, code, problemUrl, language, mount, onStamped })
 *
 * language는 제출한 코드의 언어 값입니다. GitHub 저장소에 올릴 때 파일 확장자만 정합니다.
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
  mount,
  onStamped,
}) {
  if (ownCard()) return;

  const card = el("div", "dojang-card");
  card.dataset.dojang = window.dojangWorld;
  const head = el("div", "dojang-head");
  head.append(seal(), el("span", null, "정답입니다"), closeButton());

  const body = el("div", "dojang-body");
  body.append(row("문제", title || "제목 없음"));
  body.append(row("코드", `${code.split("\n").length}줄 · ${code.length}자`));

  const tagWrap = el("div");
  tagWrap.append(el("label", null, "주제 태그 (쉼표로 구분, 선택)"));
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

  function tell(text, bad = false) {
    note.textContent = text;
    note.hidden = !text;
    note.classList.toggle("dojang-bad", bad);
  }

  card.append(head, body);
  (mount ?? document.body).append(card);
  // 방금 뜬 자리라 포커스가 아직 오가는 중일 수 있어 한 박자 뒤에 잡습니다.
  setTimeout(() => tags.focus(), 0);

  /** 스터디가 여럿이면 이 카드 안에서 고릅니다. */
  function askGroup(groups) {
    if (body.querySelector(".dojang-pick")) return;
    const wrap = el("div");
    wrap.append(el("label", null, "어느 스터디에 남길까요"));
    const picker = el("select", "dojang-pick");
    picker.append(new Option("고르기", ""));
    for (const group of groups) picker.append(new Option(group.name, group.id));
    wrap.append(picker);
    body.insertBefore(wrap, tagWrap);
    tell("스터디를 고르면 바로 남깁니다.");
    picker.addEventListener("change", () => {
      if (picker.value) void send(picker.value);
    });
    stamp.disabled = false;
    stamp.textContent = "도장 찍기";
  }

  async function send(groupId) {
    stamp.disabled = true;
    // 처음 누르면 GitHub 창이 열리므로 무엇을 기다리는지 알려줍니다.
    stamp.textContent = groupId ? "남기는 중…" : "연결하고 남기는 중…";
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
      tags: parseTags(topics),
      autoApproved: Boolean(result?.autoApproved),
      // 저장소를 골라 뒀으면 도장에 이어 풀이를 올립니다. 누르는 것은 여전히 도장 찍기 하나입니다.
      repo: result?.repo ?? null,
      upload: () =>
        sendToBackground({
          type: "push-code",
          code,
          title,
          problemUrl,
          language,
          tags: topics,
        }),
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
 * 등록을 백그라운드에 맡깁니다. 답을 받지 못해도 버튼이 '남기는 중'에 멈춰 있지
 * 않도록 실패를 결과로 바꿔 돌려줍니다.
 */
async function sendToBackground(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch {
    // 확장을 새 버전으로 바꾸기 전에 떠 있던 카드는 보낼 곳을 잃습니다.
    return {
      error: window.dojangConnected()
        ? "도장을 찍지 못했습니다. 다시 시도해주세요."
        : "확장 프로그램이 바뀌어 연결이 끊겼습니다. 페이지를 새로고침한 뒤 다시 제출해주세요.",
    };
  }
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
 * 무엇이 저장됐는지 보여주고 5초 뒤에 사라집니다. 읽는 중에는 멈춥니다.
 * 저장소에 올리는 중이면 끝날 때까지 기다리고, 실패하면 닫을 때까지 둡니다.
 */
function showResult(card, { title, tags, autoApproved, repo, upload }) {
  // 결과에는 입력칸이 없으니 붙어 있던 자리에서 빼내 body로 옮깁니다.
  // 모달이나 패널이 닫혀도 무엇이 저장됐는지는 남아 있어야 합니다.
  document.body.append(card);
  card.replaceChildren();
  card.classList.add("dojang-result");
  const head = el("div", "dojang-head");
  head.append(seal(), el("span", null, "도장을 찍었습니다"), closeButton());

  const body = el("div", "dojang-body");
  body.append(row("문제", title || "제목 없음"));
  body.append(row("내용", "풀이 코드"));
  if (tags.length) body.append(row("태그", tags.join(", ")));
  body.append(row("상태", autoApproved ? "자동 인정" : "검수 대기"));
  card.append(head, body);
  if (!repo) return countDown(card);

  // 올라갔는지 보기 전에 카드가 사라지면 확인할 길이 없어, 끝날 때까지 막대를 걸지 않습니다.
  const line = row("저장소", "올리는 중…");
  body.append(line);
  void pushToRepo(card, line, upload);
}

/** 저장소에 올리고 그 줄을 결과로 바꿉니다. 실패하면 이유와 다시 올리기를 둡니다. */
async function pushToRepo(card, line, upload) {
  const value = line.lastChild;
  value.classList.remove("dojang-bad");
  value.textContent = "올리는 중…";
  const result = await upload();
  if (!result || result.error) {
    value.textContent = "올리지 못했습니다";
    value.classList.add("dojang-bad");
    const note = el(
      "p",
      "dojang-note dojang-bad",
      result?.error ?? "저장소에 올리지 못했습니다.",
    );
    const retry = el("button", "dojang-retry", "다시 올리기");
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
  // 움직임을 줄이기로 한 사용자에게는 막대가 움직이지 않으므로 시간으로 지웁니다.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setTimeout(() => card.remove(), 5000);
    return;
  }
  const timer = el("div", "dojang-timer");
  card.append(timer);
  timer.addEventListener("animationend", () => card.remove());
}
