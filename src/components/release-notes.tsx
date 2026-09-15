import {
  EXTENSION_DOWNLOAD_URL,
  isLatestExtension,
  latestReleases,
  releaseDate,
  releaseName,
  type Release,
} from "@/lib/release-notes";

/**
 * 릴리스 한 건. 카드와 지난 기록 페이지가 같은 것을 써서 두 화면이 어긋나지 않습니다.
 */
export function ReleaseEntry({ release }: { release: Release }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {/* 어느 쪽 이야기인지 먼저 가릅니다. 섞여 있어서 이게 없으면 헷갈립니다. */}
        <span className="rounded-full border border-line px-2 py-0.5 text-[12px] text-sub">
          {releaseName(release)}
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
      {/* 웹은 이미 새 버전을 보고 있으니 받을 것이 없고, 지난 확장은 받을 이유가 없습니다. */}
      {isLatestExtension(release) && (
        <a
          href={EXTENSION_DOWNLOAD_URL}
          target="_blank"
          rel="noreferrer"
          className="btn mt-3 justify-self-start"
        >
          받으러 가기
        </a>
      )}
    </>
  );
}

/**
 * 웹과 크롬 확장의 가장 최근 릴리스입니다. 로그인 전 첫 화면과 대시보드가 같은 것을
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
        <a href="/releases" className="text-[13px] text-sub hover:text-ink">
          지난 기록
        </a>
      </div>

      <ul className="mt-4 grid gap-5 sm:grid-cols-2 sm:gap-6">
        {latestReleases().map((release) => (
          <li key={release.surface} className="grid content-start">
            <ReleaseEntry release={release} />
          </li>
        ))}
      </ul>
    </section>
  );
}
