/**
 * LeetCode에서 제출이 정답으로 끝나는 순간을 알아냅니다.
 *
 * NeetCode와 같은 방식입니다. 이 파일만 페이지와 같은 세계(MAIN world)에서 돌고, 페이지가
 * 이미 주고받는 제출 요청과 채점 응답을 엿볼 뿐 화면은 건드리지 않습니다.
 * LeetCode에 따로 요청을 보내지 않습니다 — 문제를 더 불러오지도, 제출 기록을 조회하지도
 * 않습니다. 사용자가 누른 제출 한 건이 오가는 것을 볼 뿐입니다.
 *
 * 왜 DOM이 아니라 요청을 보나:
 *   에디터가 Monaco라 DOM에는 화면에 보이는 줄만 있습니다. 제출 요청에는 코드 전문이 실립니다.
 *
 * 실제 제출로 확인한 계약 (2026-09-29, problems/two-sum):
 *   제출 → POST /problems/two-sum/submit/  {"lang":"cpp","question_id":"1","typed_code":"..."}
 *        ← {"submission_id": 2156492751}
 *   채점 → GET /submissions/detail/2156492751/v2/check/  (끝날 때까지 여러 번 묻습니다)
 *        ← {"state":"PENDING"} → {"state":"STARTED"} →
 *          {"state":"SUCCESS","status_msg":"Accepted","total_correct":65,"total_testcases":65,
 *           "status_runtime":"4 ms","status_memory":"14.9 MB", ...}
 *   실행 → POST /problems/two-sum/interpret_solution/ ← {"interpret_id":"runcode_..."}
 *          GET /submissions/detail/runcode_.../check/  (v2가 없습니다)
 *   세 요청 모두 fetch로 나갑니다. NeetCode처럼 XHR로 바뀔 때를 대비해 둘 다 봅니다.
 *
 *   실행(Run) 결과도 state가 SUCCESS, status_msg가 "Accepted"로 옵니다. 그래서 채점 응답만
 *   보고 판단하지 않고, 제출 응답이 돌려준 번호의 채점만 봅니다. 실행 번호는 runcode_로
 *   시작해 모양부터 다릅니다. 채점 주소는 v2가 붙은 것과 안 붙은 것을 모두 받습니다.
 *
 *   오답이면 같은 응답에 틀린 테스트의 입력과 기대 출력(last_testcase·expected_output)이
 *   실립니다. 플랫폼의 테스트 데이터라 꺼내지 않습니다. 정답일 때 통과 수·시간·메모리만 씁니다.
 *
 *   대회 문제는 /contest/ 아래에서 제출되어 여기 걸리지 않습니다. 대회 중에는 풀이를 공개하면
 *   안 되니 일부러 넓히지 않습니다.
 *
 * 알아둘 것: 이 이벤트는 페이지도 흉내 낼 수 있습니다. 이벤트가 하는 일은 카드를 띄우는
 * 것까지이고, 실제로 남는 것은 사용자가 도장 찍기를 눌러야 생깁니다.
 */
(function () {
  // 설치하거나 새 버전으로 바꿀 때 background가 이미 열린 탭에 이 파일을 다시 넣습니다.
  // 페이지 쪽 세계는 하나뿐이라, 이미 감쌌으면 또 감싸지 않습니다.
  if (window.dojangLeetcodeIntercepting) return;
  window.dojangLeetcodeIntercepting = true;

  const SUBMIT = /^\/problems\/([a-z0-9][a-z0-9-]*)\/submit\/?$/;
  const CHECK = /^\/submissions\/detail\/(\d+)\/(?:v2\/)?check\/?$/;

  // 제출 번호 → 그때 보낸 코드. 채점이 끝나면 지웁니다.
  const pending = new Map();

  function pathOf(url) {
    try {
      return new URL(url, window.location.href).pathname;
    } catch {
      return "";
    }
  }

  function watched(url) {
    const path = pathOf(url);
    return SUBMIT.test(path) || CHECK.test(path);
  }

  /** 제출 응답이 오면 번호와 보낸 코드를 짝지어 둡니다. */
  function onSubmitted(slug, sentBody, received) {
    const id = received?.submission_id;
    if (id == null) return;
    const { lang, typed_code: code } = JSON.parse(sentBody) ?? {};
    if (typeof code !== "string" || !code.trim()) return;
    pending.set(String(id), {
      slug,
      code,
      language: typeof lang === "string" ? lang : "",
    });
  }

  /** 채점이 끝난 응답만 봅니다. 정답일 때만 알리고, 끝났으면 짝은 버립니다. */
  function onChecked(id, received) {
    const sent = pending.get(id);
    // 채점 중에는 state가 PENDING·STARTED로 옵니다.
    if (!sent || received?.state !== "SUCCESS") return;
    pending.delete(id);
    if (received.status_msg !== "Accepted") return;
    window.dispatchEvent(
      new CustomEvent("dojang:leetcode-accepted", {
        detail: {
          slug: sent.slug,
          code: sent.code,
          // 언어는 저장소에 올릴 파일 확장자만 정합니다.
          language: sent.language,
          // 커밋 메시지의 시간·메모리·통과 수가 됩니다.
          grading: {
            passed: received.total_correct,
            total: received.total_testcases,
            time: received.status_runtime,
            memory: received.status_memory,
          },
        },
      }),
    );
  }

  /** 요청 하나와 그 응답을 맞춰 봅니다. */
  function observe(url, sentBody, received) {
    const path = pathOf(url);
    const slug = path.match(SUBMIT)?.[1];
    if (slug) {
      if (typeof sentBody === "string") onSubmitted(slug, sentBody, received);
      return;
    }
    const id = path.match(CHECK)?.[1];
    if (id) onChecked(id, received);
  }

  /** 응답을 읽는 방법이 responseType마다 다릅니다. 'json'일 때 responseText를 건드리면 예외가 납니다. */
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
    this.dojangUrl = String(url);
    return open.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (body) {
    try {
      if (watched(this.dojangUrl)) {
        this.addEventListener("load", () => {
          try {
            observe(this.dojangUrl, body, readResponse(this));
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
      if (url && watched(url)) {
        const sent = typeof options?.body === "string" ? options.body : null;
        // 응답은 페이지도 읽어야 하므로 사본을 씁니다.
        response
          .clone()
          .json()
          .then((received) => observe(url, sent, received))
          .catch(() => {});
      }
    } catch {
      // 위와 같습니다.
    }
    return response;
  };
})();
