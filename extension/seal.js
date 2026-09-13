/**
 * 도장 한 벌. 팝업과 콘텐츠 스크립트가 같은 도형을 씁니다.
 *
 * 웹앱의 src/components/seal.tsx와 좌표가 같습니다. 확장은 번들러 없이
 * 파일을 그대로 싣기 때문에 웹앱 컴포넌트를 가져다 쓸 수 없어 한 벌 더 둡니다.
 * 도형을 고칠 때는 두 파일을 같이 고쳐야 합니다.
 *
 * 콘텐츠 스크립트는 남의 페이지에 들어가므로 문서 어딘가의 <defs>를 믿을 수
 * 없습니다. 도장마다 정의를 안에 품은 통짜 SVG를 만들고 id는 번호로 갈라 둡니다.
 */
// 콘텐츠 스크립트끼리는 같은 isolated world를 쓰지만, 의존을 눈에 보이게 둡니다.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  let counter = 0;

  /** 엄지를 파내고 나머지에 잉크가 묻는 모양입니다. */
  function faceMask(id) {
    return `
      <mask id="${id}-face">
        <rect width="120" height="120" fill="#000"/>
        <circle cx="60" cy="60" r="55" fill="#fff"/>
        <circle cx="60" cy="60" r="46.5" fill="none" stroke="#000" stroke-width="2.2"/>
        <path fill="#000" d="M 51 86 L 76 86 Q 84 86 85 78 L 87.5 63 Q 88.5 56 81 56 L 68 56
                             Q 64.5 56 65.5 52.5 L 68.5 41 Q 70.5 33 63 33 Q 59 33 57.5 37.5
                             L 52 53 Q 51 56 51 59 Z"/>
        <rect x="33" y="58" width="14" height="28" rx="3" fill="#000"/>
      </mask>`;
  }

  /**
   * 작은 크기용은 테두리 흔들림만 남깁니다. 40px 아래에서 얼룩은 질감이 아니라
   * 색이 바랜 것처럼 보이기 때문입니다. 큰 크기용은 성기고 진한 얼룩을 더합니다.
   */
  function inkFilter(id, plate) {
    const wobble = `
      <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="5" result="wobble"/>
      <feDisplacementMap in="${plate === "large" ? "worn" : "SourceGraphic"}" in2="wobble"
                         scale="${plate === "large" ? 2.8 : 2.4}"
                         xChannelSelector="R" yChannelSelector="G"/>`;
    const speck =
      plate === "large"
        ? `
      <feTurbulence type="fractalNoise" baseFrequency="0.42" numOctaves="4" seed="17" result="grain"/>
      <feColorMatrix in="grain" type="matrix" result="speck"
                     values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.8 -1.75"/>
      <feComposite in="SourceGraphic" in2="speck" operator="out" result="worn"/>`
        : "";
    return `
      <filter id="${id}-ink" x="-16%" y="-16%" width="132%" height="132%"
              color-interpolation-filters="sRGB">${speck}${wobble}
      </filter>`;
  }

  /**
   * 도장 SVG 하나를 만들어 돌려줍니다.
   * 잉크색은 currentColor라 감싼 요소의 color가 정합니다 —
   * 흰 카드 위에서는 파랑, 채운 머리말 위에서는 흰색이 됩니다.
   */
  window.dojangSeal = function dojangSeal({ size, plate = "small", tilt = -6 }) {
    const id = `dojang-seal-${++counter}`;
    const markup = `<svg xmlns="${NS}" viewBox="0 0 120 120" width="${size}" height="${size}"
         aria-hidden="true" style="transform:rotate(${tilt}deg)">
      <defs>${inkFilter(id, plate)}${faceMask(id)}</defs>
      <g filter="url(#${id}-ink)">
        <rect width="120" height="120" fill="currentColor" mask="url(#${id}-face)"/>
      </g>
    </svg>`;

    // innerHTML 대신 파서를 씁니다. 확장 CSP 아래에서도 안전하고 의도가 분명합니다.
    const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
    return document.importNode(parsed.documentElement, true);
  };
})();
