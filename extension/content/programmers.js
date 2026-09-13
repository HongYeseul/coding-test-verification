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

  function removeButton() {
    document.querySelector(".dojang-float")?.remove();
  }

  function showButton(code) {
    if (document.querySelector(".dojang-float")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dojang-float";
    // innerHTML 대신 DOM으로 만듭니다. 페이지 CSP와 스토어 심사 모두에서 안전합니다.
    const seal = document.createElement("span");
    seal.className = "dojang-seal";
    seal.setAttribute("aria-hidden", "true");
    seal.textContent = "✓";
    const label = document.createElement("span");
    label.className = "dojang-label";
    label.textContent = "도장 찍기";
    button.append(seal, label);

    button.addEventListener("click", async () => {
      button.disabled = true;
      label.textContent = "남기는 중…";
      const result = await chrome.runtime.sendMessage({
        type: "submit-code",
        solutionCode: code,
        problemUrl: problemUrl(),
        title: problemTitle(),
      });
      if (result?.error) {
        button.disabled = false;
        label.textContent = result.error;
        return;
      }
      // 같은 코드로 다시 뜨지 않게 기억합니다.
      registeredCode = code;
      button.classList.add("dojang-done");
      label.textContent = result?.autoApproved
        ? "도장을 찍었습니다"
        : "검수 대기로 남겼습니다";
      setTimeout(removeButton, 4000);
    });

    document.body.append(button);
  }

  setInterval(() => {
    const modal = visibleModal();
    if (!modal || !passed(modal)) {
      // 모달이 닫히면 버튼도 함께 치웁니다.
      if (!document.querySelector(".dojang-float.dojang-done")) removeButton();
      return;
    }
    const code = submittedCode();
    if (!code || code === registeredCode) return;
    showButton(code);
    // 버튼과 같은 자리에서 터뜨려 둘이 한 동작으로 읽히게 합니다.
    window.dojangConfetti?.();
  }, POLL_MS);
})();
