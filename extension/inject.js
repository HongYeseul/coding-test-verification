/**
 * 설치하거나 새 버전으로 바꾼 순간, 이미 열려 있던 문제 탭에도 감지 스크립트를 넣습니다.
 *
 * 크롬은 manifest의 content_scripts를 그 뒤에 새로 불러온 페이지에만 넣습니다.
 * 문제를 열어 둔 채 확장을 설치하면 그 탭에서는 정답을 맞혀도 카드가 뜨지 않았습니다.
 * 새 버전으로 바꿀 때는 옛 스크립트가 페이지에 남긴 하지만 확장과 끊겨 쓸 수 없습니다.
 * 자동 갱신이 없어 사용자가 손으로 바꾸는 확장이라 이 일이 버전마다 생깁니다.
 *
 * 넣을 목록은 manifest에서 그대로 읽습니다. 두 곳에 적으면 한쪽만 고치는 날이 옵니다.
 * 같은 탭에 두 번 들어가도 되도록 콘텐츠 스크립트 쪽이 스스로 겹침을 정리합니다.
 */
export async function injectIntoOpenTabs({ reason }) {
  // 크롬이 업데이트될 때는 탭이 새로 열리며 크롬이 알아서 넣으므로 건너뜁니다.
  if (reason !== "install" && reason !== "update") return;

  for (const script of chrome.runtime.getManifest().content_scripts ?? []) {
    const tabs = await chrome.tabs.query({ url: script.matches });
    for (const tab of tabs) {
      const target = { tabId: tab.id };
      try {
        if (script.css?.length)
          await chrome.scripting.insertCSS({ target, files: script.css });
        if (script.js?.length)
          await chrome.scripting.executeScript({
            target,
            files: script.js,
            // NeetCode 요청을 엿보는 파일은 페이지 쪽 세계에서 돌아야 합니다.
            world: script.world ?? "ISOLATED",
          });
      } catch {
        // 잠들어 있는 탭이나 오류 페이지에는 넣을 수 없습니다. 그런 탭은 다시 불러올 때
        // 크롬이 넣습니다.
      }
    }
  }
}
