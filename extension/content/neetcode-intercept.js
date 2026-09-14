/**
 * NeetCode에서 제출이 정답으로 끝나는 순간을 알아냅니다.
 *
 * 이 파일만 페이지와 같은 세계(MAIN world)에서 돕니다. 나머지 콘텐츠 스크립트는
 * 격리된 세계에 있어 페이지의 window.fetch에 손댈 수 없기 때문입니다.
 * 여기서는 오직 '제출 요청 하나를 엿보고 결과를 알린다'만 하고, 화면은 건드리지 않습니다.
 *
 * 왜 DOM이 아니라 요청을 보나:
 *   NeetCode 에디터는 Monaco입니다. Monaco는 화면에 보이는 줄만 DOM에 두기 때문에
 *   거기서 코드를 긁으면 잘립니다. 반면 제출 요청에는 코드 전문이 그대로 실립니다.
 *   잘린 코드를 올리느니 요청을 보는 편이 정확합니다.
 *
 * 실제 제출로 확인한 계약 (2026-09-14, problems/duplicate-integer):
 *   제출 → POST /api/executeCodeFunctionHttp
 *          {"data":{"problemId":"duplicate-integer","rawCode":"...","lang":"python"}}
 *        ← {"data":{"status":{"id":11,"description":"Runtime Error (NZEC)"},
 *                   "test_case_count":34,"correct_test_case_count":0, ...}}
 *   실행 → POST /api/runCodeFunctionHttp  (testCases가 더 붙습니다)
 *
 *   status.id는 보지 않습니다. 위 id는 실제로 받아본 오답 응답의 값일 뿐이고,
 *   정답일 때의 번호는 확인하지 않았습니다. 번호를 짐작해 쓰는 대신 문구를 봅니다.
 *
 *   주소가 아예 달라서 '실행'을 정답으로 착각할 일이 없습니다.
 *   정답 판정은 NeetCode 자신이 쓰는 것과 같은 식입니다 — 번들의
 *   `get displayAccepted(){return "Accepted"===this.displayResponse?.status?.description}`
 *
 * 알아둘 것: 이 이벤트는 페이지도 흉내 낼 수 있습니다. MAIN world와 격리된 세계
 * 사이에는 이 방법뿐이라 막을 수 없습니다. 다만 이벤트가 하는 일은 카드를 띄우는
 * 것까지고, 실제로 남는 것은 사용자가 도장 찍기를 눌러야 생깁니다.
 */
(function () {
  const SUBMIT_PATH = "/api/executeCodeFunctionHttp";
  const original = window.fetch;

  window.fetch = async function (...args) {
    const response = await original.apply(this, args);
    try {
      announce(args, response);
    } catch {
      // 엿보다 실패해도 페이지는 그대로 돌아야 합니다. 카드가 안 뜰 뿐입니다.
    }
    return response;
  };

  function announce([resource, options], response) {
    const url = typeof resource === "string" ? resource : resource?.url;
    if (!url || !url.includes(SUBMIT_PATH)) return;
    // 요청 본문은 이미 문자열로 넘어와 있어 응답과 달리 소비할 것이 없습니다.
    const sent = typeof options?.body === "string" ? options.body : "";
    if (!sent) return;
    const { problemId, rawCode } = JSON.parse(sent)?.data ?? {};
    if (!problemId || !rawCode) return;

    // 응답은 페이지도 읽어야 하므로 사본을 씁니다.
    response
      .clone()
      .json()
      .then((body) => {
        if (body?.data?.status?.description !== "Accepted") return;
        window.dispatchEvent(
          new CustomEvent("dojang:neetcode-accepted", {
            detail: { problemId, code: rawCode },
          }),
        );
      })
      .catch(() => {});
  }
})();
