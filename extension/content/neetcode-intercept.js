/**
 * NeetCode에서 제출이 정답으로 끝나는 순간을 알아냅니다.
 *
 * 이 파일만 페이지와 같은 세계(MAIN world)에서 돕니다. 나머지 콘텐츠 스크립트는
 * 격리된 세계에 있어 페이지의 통신에 손댈 수 없기 때문입니다.
 * 여기서는 오직 '제출 요청 하나를 엿보고 결과를 알린다'만 하고, 화면은 건드리지 않습니다.
 *
 * 왜 DOM이 아니라 요청을 보나:
 *   NeetCode 에디터는 Monaco입니다. Monaco는 화면에 보이는 줄만 DOM에 두기 때문에
 *   거기서 코드를 긁으면 잘립니다. 반면 제출 요청에는 코드 전문이 그대로 실립니다.
 *
 * 실제 제출로 확인한 계약 (2026-09-14, problems/duplicate-integer):
 *   제출 → POST /api/executeCodeFunctionHttp
 *          {"data":{"problemId":"duplicate-integer","rawCode":"...","lang":"python"}}
 *        ← {"data":{"status":{"description":"Accepted"},"test_case_count":34, ...}}
 *   실행 → POST /api/runCodeFunctionHttp  (testCases가 더 붙습니다)
 *
 *   주소가 아예 달라서 '실행'을 정답으로 착각할 일이 없습니다.
 *   정답 판정은 NeetCode 자신이 쓰는 것과 같은 식입니다 — 번들의
 *   `get displayAccepted(){return "Accepted"===this.displayResponse?.status?.description}`
 *   status.id는 보지 않습니다. 번호는 짐작하지 않고 문구를 봅니다.
 *
 * XMLHttpRequest와 fetch를 모두 봅니다. NeetCode는 Angular HttpClient를 쓰고
 * 그 기본값이 XHR이라, 실제로 제출이 나가는 길은 XHR입니다(라이브에서 확인).
 * fetch 쪽은 HttpClient가 withFetch()로 바뀌어도 카드가 계속 뜨게 하는 대비입니다.
 *
 * 알아둘 것: 이 이벤트는 페이지도 흉내 낼 수 있습니다. MAIN world와 격리된 세계
 * 사이에는 이 방법뿐이라 막을 수 없습니다. 다만 이벤트가 하는 일은 카드를 띄우는
 * 것까지고, 실제로 남는 것은 사용자가 도장 찍기를 눌러야 생깁니다.
 */
(function () {
  // 설치하거나 새 버전으로 바꿀 때 background가 이미 열린 탭에 이 파일을 다시 넣습니다.
  // 페이지 쪽 세계는 하나뿐이라, 이미 감쌌으면 또 감싸지 않습니다. 겹쳐 감싸면 정답
  // 한 번에 알림이 여러 번 갑니다. 그래서 이 파일을 고치면 새로고침한 탭부터 적용됩니다.
  if (window.dojangIntercepting) return;
  window.dojangIntercepting = true;

  const SUBMIT_PATH = "/api/executeCodeFunctionHttp";

  function isSubmit(url) {
    return typeof url === "string" && url.includes(SUBMIT_PATH);
  }

  /** 보낸 코드와 받은 판정을 맞춰 보고, 정답일 때만 알립니다. */
  function announce(sentBody, received) {
    if (received?.data?.status?.description !== "Accepted") return;
    const { problemId, rawCode } = JSON.parse(sentBody)?.data ?? {};
    if (!problemId || !rawCode) return;
    window.dispatchEvent(
      new CustomEvent("dojang:neetcode-accepted", {
        detail: { problemId, code: rawCode },
      }),
    );
  }

  /**
   * 응답을 읽는 방법이 responseType마다 다릅니다.
   * 'json'으로 받았을 때 responseText를 건드리면 예외가 납니다.
   * NeetCode는 지금 'text'로 받습니다.
   */
  function readResponse(request) {
    const type = request.responseType;
    if (type === "" || type === "text") return JSON.parse(request.responseText);
    if (type === "json") return request.response;
    return null;
  }

  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    // send에서 주소를 알 수 없어 여기서 들고 있습니다.
    this.dojangUrl = url;
    return open.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (body) {
    try {
      if (isSubmit(this.dojangUrl) && typeof body === "string") {
        this.addEventListener("load", () => {
          try {
            announce(body, readResponse(this));
          } catch {
            // 엿보다 실패해도 페이지는 그대로 돌아야 합니다. 카드가 안 뜰 뿐입니다.
          }
        });
      }
    } catch {
      // 위와 같습니다.
    }
    return send.call(this, body);
  };

  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const [resource, options] = args;
      const url = typeof resource === "string" ? resource : resource?.url;
      // 요청 본문은 이미 문자열로 넘어와 있어 응답과 달리 소비할 것이 없습니다.
      const sent = typeof options?.body === "string" ? options.body : "";
      if (isSubmit(url) && sent) {
        // 응답은 페이지도 읽어야 하므로 사본을 씁니다.
        response
          .clone()
          .json()
          .then((received) => announce(sent, received))
          .catch(() => {});
      }
    } catch {
      // 위와 같습니다.
    }
    return response;
  };
})();
