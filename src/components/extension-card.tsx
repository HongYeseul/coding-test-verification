import {
  EXTENSION_HIGHLIGHTS,
  EXTENSION_RELEASE_URL,
  EXTENSION_SUMMARY,
  EXTENSION_VERSION,
} from "@/lib/extension-release";

/**
 * 대시보드에서 확장 프로그램의 새 버전을 알리는 자리입니다.
 *
 * 제목이 '릴리스 노트'라고 말합니다. 무엇을 하는 카드인지 읽어서 짐작하게 두면
 * 그냥 광고처럼 지나칩니다. 웹스토어 등록 전이라 자동 갱신이 되지 않아,
 * 새 버전이 나온 것을 알 자리가 여기뿐입니다.
 */
export function ExtensionCard() {
  return (
    <section
      aria-labelledby="extension-card-title"
      className="rounded-surface border border-line bg-soft p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="extension-card-title">크롬 확장 프로그램 릴리스 노트</h2>
        <span className="font-mono text-[13px] text-sub">
          {EXTENSION_VERSION}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-sub">{EXTENSION_SUMMARY}</p>

      <ul className="mt-3 list-disc pl-5 text-[13px] text-sub marker:text-line">
        {EXTENSION_HIGHLIGHTS.map((highlight) => (
          <li key={highlight} className="mt-1 first:mt-0">
            {highlight}
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
