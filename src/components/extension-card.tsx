import {
  EXTENSION_HIGHLIGHTS,
  EXTENSION_RELEASE_URL,
  EXTENSION_VERSION,
} from "@/lib/extension-release";

/**
 * 대시보드에서 확장 프로그램을 알리는 자리입니다.
 *
 * 웹스토어에 올리기 전이라 자동 갱신이 되지 않습니다. 새 버전이 나온 것을
 * 알 방법이 저장소밖에 없어서, 무엇이 바뀌었는지를 여기서 먼저 보여줍니다.
 */
export function ExtensionCard() {
  return (
    <section
      aria-labelledby="extension-card-title"
      className="rounded-surface border border-line bg-soft p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="extension-card-title">크롬 확장 프로그램</h2>
        <span className="font-mono text-[13px] text-sub">
          {EXTENSION_VERSION}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-sub">
        보고 있는 화면을 한 번에 도장으로 남깁니다. 프로그래머스와 NeetCode에서는
        정답을 맞히면 카드가 떠, 제출한 코드를 그대로 남길 수 있습니다.
      </p>

      <h3 className="mt-4 text-[15px]">새로 바뀐 것</h3>
      <ul className="mt-1 grid gap-1 text-[13px] text-sub">
        {EXTENSION_HIGHLIGHTS.map((highlight) => (
          <li key={highlight} className="flex gap-2">
            <span aria-hidden="true">·</span>
            <span>{highlight}</span>
          </li>
        ))}
      </ul>

      <a
        href={EXTENSION_RELEASE_URL}
        target="_blank"
        rel="noreferrer"
        className="btn mt-4"
      >
        받으러 가기
      </a>
    </section>
  );
}
