/**
 * NeetCode에서 정답이 나오면 카드를 띄웁니다.
 * 정답을 알아내는 일은 neetcode-intercept.js가 페이지 쪽 세계에서 하고,
 * 여기는 그 소식을 받아 카드에 넘기기만 합니다. 카드는 content/card.js입니다.
 *
 * 읽는 것은 두 가지뿐이고 둘 다 사용자 본인의 것입니다.
 *   1) 본인이 제출한 코드 — 제출 요청에 실려 나가는 값을 그대로 받습니다.
 *   2) 정답인지 여부 — 카드를 띄울지 정하는 데만 씁니다.
 * 문제 설명·힌트·모범답안 같은 플랫폼 콘텐츠는 읽지 않습니다.
 *
 * 제목은 탭 제목에서 가져옵니다. NeetCode는 화면 안 제목의 클래스 이름이
 * 배포마다 바뀌지만 탭 제목 형식은 `<문제 이름> - NeetCode`로 일정합니다.
 */
(function () {
  const TITLE_SUFFIX = " - NeetCode";

  function problemTitle() {
    const title = document.title.trim();
    const name = title.endsWith(TITLE_SUFFIX)
      ? title.slice(0, -TITLE_SUFFIX.length)
      : title;
    return name.trim().slice(0, 160);
  }

  /**
   * 문제 주소는 제출에 실려 있던 problemId로 짓습니다.
   * 지금 보고 있는 주소를 쓰면 `/question`·`/solution` 같은 꼬리가 붙어
   * 같은 문제가 여러 링크로 갈라집니다. problemId는 언제나 하나입니다.
   */
  function problemUrl(problemId) {
    return `https://neetcode.io/problems/${encodeURIComponent(problemId)}`;
  }

  window.addEventListener("dojang:neetcode-accepted", (event) => {
    const { problemId, code } = event.detail ?? {};
    if (!problemId || !code) return;
    window.dojangCard({
      title: problemTitle(),
      code,
      problemUrl: problemUrl(problemId),
    });
  });
})();
