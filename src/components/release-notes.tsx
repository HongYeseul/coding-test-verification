import { RELEASES, RELEASE_LIST_URL, releaseDate } from "@/lib/release-notes";

/**
 * 웹과 확장 프로그램의 가장 최근 릴리스입니다. 로그인 전 첫 화면과 대시보드가 같은 것을
 * 씁니다 — 확장은 웹스토어 등록 전이라 자동 갱신이 되지 않고, 들어오기 전 사람에게도
 * 무엇이 달라졌는지 보일 자리가 필요합니다.
 *
 * 제목이 ‘릴리스 노트’라고 말합니다. 무엇을 하는 카드인지 읽어서 짐작하게 두면
 * 그냥 광고처럼 지나칩니다. 둘을 나란히 두는 것은 웹만 바뀌는 제품도, 확장만 바뀌는
 * 제품도 아니라는 것을 한눈에 보이게 하려는 것입니다.
 */
export function ReleaseNotes() {
  return (
    <section
      aria-labelledby="release-notes-title"
      className="rounded-surface border border-line bg-soft p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="release-notes-title">릴리스 노트</h2>
        <a
          href={RELEASE_LIST_URL}
          target="_blank"
          rel="noreferrer"
          className="text-[13px] text-sub hover:text-ink"
        >
          지난 기록
        </a>
      </div>

      <ul className="mt-4 grid gap-5 sm:grid-cols-2 sm:gap-6">
        {RELEASES.map((release) => (
          <li key={release.name} className="grid content-start">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="rounded-full border border-line px-2 py-0.5 text-[12px] text-sub">
                {release.name}
              </span>
              <span className="font-mono text-[12px] text-sub tabular-nums">
                {releaseDate(release)}
              </span>
            </div>
            <p className="mt-1.5 text-[13px] text-sub">{release.summary}</p>
            <ul className="mt-2 list-disc pl-5 text-[13px] text-sub marker:text-line">
              {release.highlights.map((highlight) => (
                <li key={highlight} className="mt-1 first:mt-0">
                  {highlight}
                </li>
              ))}
            </ul>
            {release.downloadUrl && (
              <a
                href={release.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="btn mt-3 justify-self-start"
              >
                받으러 가기
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
