/**
 * 프로그래머스 채점 결과를 지켜보다가, 정답이면 오른쪽 위에 '도장 찍기' 버튼을 띄웁니다.
 *
 * 읽는 것은 두 가지뿐입니다.
 *   1) 채점 결과 모달의 제목 — 버튼을 띄울지 정하는 데만 쓰고 서버로 보내지 않습니다.
 *   2) 사용자가 제출한 코드 — 사용자 본인의 저작물입니다.
 * 문제 설명·입출력 예시 같은 플랫폼 콘텐츠는 읽지 않습니다.
 *
 * 실제 DOM에서 확인한 사실 (2026-09-13, lessons/42576):
 *   - 결과 모달은 `#modal-dialog.modal.fade.show` 안의 `h4.modal-title`이다.
 *   - 모달을 닫아도 문구는 DOM에 남고 `show` 클래스만 빠진다.
 *     그래서 문구만 보면 첫 정답 이후 계속 뜬다. 보이는 동안만 인정해야 한다.
 *   - `textarea#code`는 타이핑 중에는 CodeMirror와 어긋나지만,
 *     제출할 때 동기화된다. 우리가 읽는 시점은 언제나 제출 직후라 안전하다.
 */
(function () {
  const POLL_MS = 1000;
  const PASS_WORDS = ["정답입니다"];
  const FAIL_WORDS = ["실패", "오답", "런타임 에러", "시간 초과"];
  let registeredCode = "";

  /**
   * 지금 화면에 떠 있는 결과 모달만 돌려줍니다.
   * offsetParent로 판단하면 안 됩니다. 부트스트랩 모달은 position:fixed라
   * 보이는 중에도 offsetParent가 항상 null입니다.
   */
  function visibleModal() {
    for (const modal of document.querySelectorAll("#modal-dialog, .modal")) {
      if (!modal.classList.contains("show")) continue;
      if (getComputedStyle(modal).display === "none") continue;
      return modal;
    }
    return null;
  }

  function passed(modal) {
    const title = modal.querySelector(".modal-title, .modal-header h4, h4");
    const text = title?.textContent?.trim() ?? "";
    if (!text) return false;
    if (FAIL_WORDS.some((word) => text.includes(word))) return false;
    return PASS_WORDS.some((word) => text.includes(word));
  }

  /** 제출 직후라 CodeMirror와 같은 값입니다. */
  function submittedCode() {
    const textarea = document.querySelector(
      "textarea#code, textarea[name='code']",
    );
    return textarea?.value?.trim() ? textarea.value : "";
  }

  function problemTitle() {
    const heading = document.querySelector(".algorithm-title, .challenge-title");
    return heading?.textContent?.trim().slice(0, 160) ?? "";
  }

  /** 저장 형식에 맞춰 쿼리와 끝 슬래시를 지웁니다. */
  function problemUrl() {
    const host = window.location.hostname.replace(/^www\./, "");
    return `https://${host}${window.location.pathname.replace(/\/+$/, "")}`;
  }

  function removeCard() {
    document.querySelector(".dojang-card")?.remove();
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

  /**
   * 정답을 맞히면 우측 상단에 카드를 띄웁니다.
   * 무엇이 올라가는지 먼저 보여주고, 태그를 적어 함께 보낼 수 있게 합니다.
   * 이 카드는 저절로 사라지지 않습니다. 적던 태그가 날아가면 안 되고,
   * 5초를 놓쳤다고 인증을 못 남기게 되면 더 곤란합니다.
   *
   * 카드를 모달 안에 넣는 이유가 있습니다. 부트스트랩 모달은 document에
   * focusin을 걸어 두고 모달 바깥으로 나간 포커스를 도로 끌어옵니다
   * (enforceFocus). body에 붙이면 태그 입력칸을 눌러도 포커스가 곧바로
   * 모달로 되돌아가 글자가 한 자도 들어가지 않습니다. jQuery가 캡처 단계에서
   * 잡기 때문에 stopPropagation으로는 막지 못합니다. 모달 안에 있으면
   * contains() 검사를 통과해 그냥 놔둡니다.
   */
  function showCard(code) {
    if (document.querySelector(".dojang-card")) return;
    const card = el("div", "dojang-card");
    const head = el("div", "dojang-head");
    const seal = el("span", "dojang-seal");
    seal.setAttribute("aria-hidden", "true");
    seal.append(window.dojangSeal({ size: 22 }));
    const close = el("button", "dojang-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "닫기");
    close.addEventListener("click", removeCard);
    head.append(seal, el("span", null, "정답입니다"), close);

    const body = el("div", "dojang-body");
    const title = problemTitle();
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
    (visibleModal() ?? document.body).append(card);
    // 모달이 뜬 직후라 포커스가 아직 오가는 중일 수 있어 한 박자 뒤에 잡습니다.
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
      const result = await chrome.runtime.sendMessage({
        type: "submit-code",
        solutionCode: code,
        problemUrl: problemUrl(),
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
      registeredCode = code;
      showResult(card, {
        title,
        tags: parseTags(tags.value),
        autoApproved: Boolean(result?.autoApproved),
      });
    }

    stamp.addEventListener("click", () => {
      if (!stamp.disabled) void send();
    });
  }

  /** 쉼표로 나눈 태그를 화면에 되비추기 위한 것입니다. 서버가 다시 정리합니다. */
  function parseTags(value) {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  /** 무엇이 저장됐는지 보여주고 5초 뒤에 사라집니다. 읽는 중에는 멈춥니다. */
  function showResult(card, { title, tags, autoApproved }) {
    // 결과에는 입력칸이 없으니 모달 밖으로 옮깁니다.
    // 모달을 닫아도 무엇이 저장됐는지는 남아 있어야 합니다.
    document.body.append(card);
    card.replaceChildren();
    const head = el("div", "dojang-head");
    const seal = el("span", "dojang-seal");
    seal.setAttribute("aria-hidden", "true");
    seal.append(window.dojangSeal({ size: 22 }));
    const close = el("button", "dojang-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "닫기");
    close.addEventListener("click", removeCard);
    head.append(seal, el("span", null, "도장을 찍었습니다"), close);

    const body = el("div", "dojang-body");
    body.append(row("문제", title || "제목 없음"));
    body.append(row("내용", "풀이 코드"));
    if (tags.length) body.append(row("태그", tags.join(", ")));
    body.append(
      row("상태", autoApproved ? "바로 인정됨" : "검수 대기"),
    );
    const timer = el("div", "dojang-timer");
    card.append(head, body, timer);

    // 움직임을 줄이기로 한 사용자에게는 막대가 움직이지 않으므로 시간으로 지웁니다.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      timer.remove();
      setTimeout(removeCard, 5000);
      return;
    }
    timer.addEventListener("animationend", removeCard);
  }

  setInterval(() => {
    const modal = visibleModal();
    if (!modal || !passed(modal)) {
      // 모달이 닫히면 카드도 함께 치웁니다. 결과를 보여주는 중이면 그대로 둡니다.
      if (!document.querySelector(".dojang-timer")) removeCard();
      return;
    }
    const code = submittedCode();
    if (!code || code === registeredCode) return;
    showCard(code);
    // 버튼과 같은 자리에서 터뜨려 둘이 한 동작으로 읽히게 합니다.
    window.dojangConfetti?.();
  }, POLL_MS);
})();
