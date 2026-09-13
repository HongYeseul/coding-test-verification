/**
 * 프로그래머스 채점 결과를 지켜보다가, 정답이면 오른쪽 위에 '도장 찍기' 버튼을 띄웁니다.
 *
 * 읽는 것은 두 가지뿐입니다.
 *   1) 채점 결과 문구 — 버튼을 띄울지 말지 정하는 데만 쓰고 서버로 보내지 않습니다.
 *   2) 사용자가 작성한 코드 — 사용자 본인의 저작물입니다.
 * 문제 설명·입출력 예시 같은 플랫폼 콘텐츠는 읽지 않습니다.
 *
 * 선택자는 사이트 UI가 바뀌면 깨집니다. 깨지면 버튼이 안 뜰 뿐이고, 그때는
 * 지금까지처럼 확장 아이콘을 눌러 화면 캡처로 등록하면 됩니다.
 */
(function () {
  const POLL_MS = 1500;
  const PASS_WORDS = ["정답입니다", "정답"];
  let lastCode = "";

  function resultText() {
    const nodes = document.querySelectorAll(
      ".modal-header h4, #modal-dialog h4, [class*='modal'] h4",
    );
    for (const node of nodes) {
      const text = node.textContent?.trim();
      if (text) return text;
    }
    return "";
  }

  function passed() {
    const text = resultText();
    if (!text) return false;
    if (text.includes("실패") || text.includes("오답")) return false;
    return PASS_WORDS.some((word) => text.includes(word));
  }

  /**
   * 에디터와 동기화된 textarea에서만 읽습니다.
   * CodeMirror는 화면에 보이는 줄만 DOM에 두기 때문에, 거기서 긁으면 코드가
   * 잘린 채로 올라갑니다. 잘린 코드를 올리느니 버튼을 안 띄우는 편이 낫습니다.
   */
  function solutionCode() {
    const textarea = document.querySelector(
      "textarea#code, textarea[name='code']",
    );
    const value = textarea?.value?.trim();
    return value ? textarea.value : "";
  }

  function problemTitle() {
    const heading = document.querySelector(
      ".algorithm-title, .challenge-title, h1",
    );
    return heading?.textContent?.trim().slice(0, 160) ?? "";
  }

  /** 저장 형식에 맞춰 쿼리와 끝 슬래시를 지웁니다. */
  function problemUrl() {
    const { hostname, pathname } = window.location;
    const host = hostname.replace(/^www\./, "");
    return `https://${host}${pathname.replace(/\/+$/, "")}`;
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
      button.classList.add("dojang-done");
      label.textContent = result?.autoApproved
        ? "도장을 찍었습니다"
        : "검수 대기로 남겼습니다";
      setTimeout(removeButton, 4000);
    });

    document.body.append(button);
  }

  setInterval(() => {
    if (!passed()) return;
    const code = solutionCode();
    if (!code || code === lastCode) return;
    lastCode = code;
    showButton(code);
  }, POLL_MS);
})();
