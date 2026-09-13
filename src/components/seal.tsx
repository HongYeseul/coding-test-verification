import type { CSSProperties } from "react";

/**
 * 도장 한 벌. 화면에 찍히는 도장은 전부 이 파일의 도형 하나를 씁니다.
 *
 * 엄지를 파내고 나머지에 잉크가 묻는 모양입니다. 덩어리로 찍히므로
 * 작은 크기에서도 형태가 버팁니다. 글자 대신 엄지를 쓰는 건 모든 멤버가
 * 같은 도장을 써서 누가 찍었는지 밝힐 일이 없기 때문입니다.
 *
 * 확장 프로그램은 이 파일을 못 읽으므로 extension/seal.js에 같은 좌표를 둡니다.
 * 한쪽을 고치면 다른 쪽도 같이 고쳐야 합니다.
 */

const VIEW_BOX = "0 0 120 120";

/**
 * 필터·마스크·심볼을 문서에 한 번만 심습니다. 루트 레이아웃에서 부릅니다.
 * 도장이 몇 개 찍히든 정의는 이 한 벌만 있으면 됩니다.
 */
export function SealDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" className="absolute">
      <defs>
        {/* 손으로 눌러 흔들린 테두리. 얼룩은 넣지 않습니다 —
            40px 아래에서 얼룩은 질감이 아니라 색이 바랜 것처럼 보입니다. */}
        <filter
          id="dojang-rim"
          x="-14%"
          y="-14%"
          width="128%"
          height="128%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.03"
            numOctaves="3"
            seed="5"
            result="wobble"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="wobble"
            scale="2.4"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        <g id="dojang-thumb">
          <path
            d="M 51 86 L 76 86 Q 84 86 85 78 L 87.5 63 Q 88.5 56 81 56 L 68 56
               Q 64.5 56 65.5 52.5 L 68.5 41 Q 70.5 33 63 33 Q 59 33 57.5 37.5
               L 52 53 Q 51 56 51 59 Z"
          />
          <rect x="33" y="58" width="14" height="28" rx="3" />
        </g>

        {/* 찍힐 자리는 흰색, 파낼 자리는 검은색입니다. 안쪽 흰 띠가 엄지와 테두리를 갈라 놓습니다. */}
        <mask id="dojang-face">
          <rect width="120" height="120" fill="#000" />
          <circle cx="60" cy="60" r="55" fill="#fff" />
          <circle
            cx="60"
            cy="60"
            r="46.5"
            fill="none"
            stroke="#000"
            strokeWidth="2.2"
          />
          <use href="#dojang-thumb" fill="#000" />
        </mask>

        {/* 잉크색은 currentColor라 심볼 한 벌이 라이트·다크를 모두 받습니다. */}
        <symbol id="dojang-seal" viewBox={VIEW_BOX}>
          <g filter="url(#dojang-rim)">
            <rect
              width="120"
              height="120"
              fill="currentColor"
              mask="url(#dojang-face)"
            />
          </g>
        </symbol>

        {/* 검수 대기용 점선 도장. 같은 엄지를 윤곽으로만 그려 ‘아직 채워지지 않았다’로 읽힙니다.
            채움과 점선은 형태가 달라 색을 구분하지 못해도 승인과 갈립니다. */}
        <symbol id="dojang-ghost" viewBox={VIEW_BOX}>
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeDasharray="8 6.5"
          />
          <use
            href="#dojang-thumb"
            fill="none"
            stroke="currentColor"
            strokeWidth="4.2"
            strokeLinejoin="round"
          />
        </symbol>
      </defs>
    </svg>
  );
}

export function Seal({
  className,
  tilt,
  press = false,
  ghost = false,
}: {
  /** 크기를 정하는 클래스입니다. 예: `size-7`, `size-[30px] sm:size-[38px]` */
  className: string;
  /** 손으로 찍은 티를 내는 기울기입니다. 기본값은 -6도입니다. */
  tilt?: string;
  /** 방금 찍힌 자리에서만 켭니다. */
  press?: boolean;
  /** 검수 대기. 잉크 대신 점선 윤곽으로 찍습니다. */
  ghost?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox={VIEW_BOX}
      className={`seal${ghost ? " seal-ghost" : ""}${press ? " seal-press" : ""} ${className}`}
      style={tilt ? ({ "--seal-tilt": tilt } as CSSProperties) : undefined}
    >
      <use href={ghost ? "#dojang-ghost" : "#dojang-seal"} />
    </svg>
  );
}
