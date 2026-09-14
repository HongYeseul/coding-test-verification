/**
 * 프로그래머스 채점 결과를 지켜보다가, 정답이면 카드를 띄웁니다.
 * 카드는 content/card.js가 그립니다. 여기는 정답을 알아내는 일만 합니다.
 *
 * 읽는 것은 두 가지뿐입니다.
 *   1) 채점 결과 모달의 제목 — 카드를 띄울지 정하는 데만 쓰고 서버로 보내지 않습니다.
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

  setInterval(() => {
    const modal = visibleModal();
    if (!modal || !passed(modal)) {
      // 모달이 닫히면 카드도 함께 치웁니다. 결과를 보여주는 중이면 그대로 둡니다.
      if (!window.dojangCardShowingResult()) window.dojangCardRemove();
      return;
    }
    const code = submittedCode();
    if (!code || code === registeredCode) return;
    // 카드를 모달 안에 넣는 이유가 있습니다. 부트스트랩 모달은 document에
    // focusin을 걸어 두고 모달 바깥으로 나간 포커스를 도로 끌어옵니다
    // (enforceFocus). body에 붙이면 태그 입력칸을 눌러도 포커스가 곧바로
    // 모달로 되돌아가 글자가 한 자도 들어가지 않습니다. jQuery가 캡처 단계에서
    // 잡기 때문에 stopPropagation으로는 막지 못합니다. 모달 안에 있으면
    // contains() 검사를 통과해 그냥 놔둡니다.
    window.dojangCard({
      title: problemTitle(),
      code,
      problemUrl: problemUrl(),
      mount: modal,
      onStamped: () => {
        registeredCode = code;
      },
    });
  }, POLL_MS);
})();
