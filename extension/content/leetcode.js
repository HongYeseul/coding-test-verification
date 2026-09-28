/**
 * LeetCode에서 정답이 나오면 카드를 띄웁니다.
 * 정답을 알아내는 일은 leetcode-intercept.js가 페이지 쪽 세계에서 하고,
 * 여기는 그 소식을 받아 카드에 넘기기만 합니다. 카드는 content/card.js입니다.
 *
 * 읽는 것은 모두 사용자 본인의 제출이거나 문제를 가리키는 식별 정보입니다.
 *   1) 본인이 제출한 코드와 그 언어 — 제출 요청에 실려 나가는 값을 그대로 받습니다.
 *   2) 채점 결과 — 정답인지, 통과 수·시간·메모리. 카드를 띄울지 정하고 커밋 메시지에 씁니다.
 *   3) 문제 번호·제목·난이도 — 문제 영역 머리의 `1. Two Sum`과 `Easy` 표시입니다.
 * 문제 설명·예제·힌트·에디토리얼·다른 사람의 풀이는 읽지 않습니다.
 *
 * 실제 화면에서 확인한 것 (2026-09-29, problems/two-sum):
 *   - 제목은 `.text-title-large` 안의 `a[href="/problems/two-sum/"]`에 `1. Two Sum`으로 있습니다.
 *   - 난이도는 같은 설명 탭(`.flexlayout__tab`) 안에서 `text-difficulty-easy`처럼 붙은 표시입니다.
 *   - 제출하면 결과 탭으로 넘어가 설명 탭이 숨지만 DOM에는 남아 있습니다.
 * 설명 탭을 한 번도 열지 않은 채(제출 기록 주소로 바로 들어와서) 풀면 이 둘이 없습니다. 그때는
 * 탭 제목 `Two Sum - LeetCode`에서 제목만 가져오고 난이도는 비워 둡니다.
 */
(function () {
  const TITLE_SUFFIX = " - LeetCode";
  const LEVELS = ["Easy", "Medium", "Hard"];

  // neetcode.js와 같은 까닭으로, 같은 탭에 두 번 들어오면 늦게 온 쪽만 남깁니다.
  const owner = {};
  window.dojangLeetcode = owner;

  /**
   * 제출한 문제의 제목 링크입니다. 슬러그로 찾아서, 화면 전환 뒤 남은 다른 문제의
   * 제목을 잘못 읽지 않습니다.
   */
  function headingLink(slug) {
    return document.querySelector(
      `.text-title-large a[href="/problems/${CSS.escape(slug)}/"]`,
    );
  }

  function problemTitle(link) {
    const heading = link?.textContent?.replace(/\s+/g, " ").trim();
    if (heading) return heading.slice(0, 160);
    const title = document.title.trim();
    const name = title.endsWith(TITLE_SUFFIX)
      ? title.slice(0, -TITLE_SUFFIX.length)
      : title;
    return name.trim().slice(0, 160);
  }

  /** 제목과 같은 설명 탭 안의 난이도만 봅니다. 모르면 빈 값입니다. */
  function problemLevel(link) {
    const badge = link
      ?.closest(".flexlayout__tab")
      ?.querySelector('[class*="text-difficulty-"]');
    const text = badge?.textContent?.trim() ?? "";
    return LEVELS.includes(text) ? text : "";
  }

  /** 문제 주소는 제출 요청의 슬러그로 짓습니다. 지금 주소에는 `/submissions/…`가 붙어 있습니다. */
  function problemUrl(slug) {
    return `https://leetcode.com/problems/${encodeURIComponent(slug)}`;
  }

  function onAccepted(event) {
    // 끊겼거나 뒤를 이은 쪽이 있으면 물러나고, 떠 있던 카드도 치웁니다.
    if (window.dojangLeetcode !== owner || !window.dojangConnected()) {
      window.removeEventListener("dojang:leetcode-accepted", onAccepted);
      if (!window.dojangCardShowingResult()) window.dojangCardRemove();
      return;
    }
    const { slug, code, language, grading } = event.detail ?? {};
    if (typeof slug !== "string" || !slug || typeof code !== "string" || !code)
      return;
    const link = headingLink(slug);
    window.dojangCard({
      title: problemTitle(link),
      code,
      problemUrl: problemUrl(slug),
      language: typeof language === "string" ? language : "",
      level: problemLevel(link),
      grading: {
        passed: Number.isInteger(grading?.passed) ? grading.passed : null,
        total: Number.isInteger(grading?.total) ? grading.total : null,
        time: typeof grading?.time === "string" ? grading.time : null,
        memory: typeof grading?.memory === "string" ? grading.memory : null,
      },
    });
  }

  window.addEventListener("dojang:leetcode-accepted", onAccepted);
})();
