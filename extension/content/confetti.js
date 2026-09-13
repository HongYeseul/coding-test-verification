/**
 * 정답을 맞힌 순간에만 잠깐 날리는 축하 효과입니다.
 *
 * 캔버스 하나를 화면에 덮고, 클릭은 그대로 통과시키며, 끝나면 스스로 지웁니다.
 * 외부 라이브러리를 쓰지 않습니다 — MV3는 원격 스크립트 로드를 금지하고,
 * 페이지가 무엇을 쓰고 있든 간섭하지 않는 편이 안전합니다.
 *
 * 도장 버튼이 오른쪽 위에 뜨므로 조각도 그 자리에서 터뜨려, 둘이 한 동작으로 읽히게 합니다.
 */
// 콘텐츠 스크립트끼리는 같은 isolated world를 쓰지만, 의존을 눈에 보이게 둡니다.
window.dojangConfetti = function dojangConfetti() {
  // 움직임을 줄이기로 한 사용자에게는 아무것도 날리지 않습니다.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (document.querySelector(".dojang-confetti")) return;

  const canvas = document.createElement("canvas");
  canvas.className = "dojang-confetti";
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("2d");
  if (!context) return;

  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  context.scale(ratio, ratio);
  document.body.append(canvas);

  // 서비스 색을 중심으로 두고 금색과 흰색을 조금 섞습니다.
  const colors = ["#386e2d", "#5a9b48", "#b6db9c", "#e9bd79", "#ffffff"];
  const originX = width - 64;
  const originY = 44;
  const pieces = Array.from({ length: 90 }, () => {
    // 오른쪽 위에서 왼쪽 아래로 부채꼴로 퍼집니다.
    const angle = Math.PI * (0.55 + Math.random() * 0.6);
    const speed = 6 + Math.random() * 7;
    return {
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      w: 5 + Math.random() * 5,
      h: 8 + Math.random() * 6,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
  });

  const GRAVITY = 0.26;
  const DRAG = 0.992;
  const started = performance.now();
  const LIFETIME = 2600;

  function frame(now) {
    const elapsed = now - started;
    if (elapsed > LIFETIME) {
      canvas.remove();
      return;
    }
    // 마지막 0.6초 동안 서서히 사라집니다.
    const fade = Math.min(1, Math.max(0, (LIFETIME - elapsed) / 600));
    context.clearRect(0, 0, width, height);
    context.globalAlpha = fade;

    for (const piece of pieces) {
      piece.vx *= DRAG;
      piece.vy = piece.vy * DRAG + GRAVITY;
      piece.x += piece.vx;
      piece.y += piece.vy;
      piece.rotation += piece.spin;
      if (piece.y - piece.h > height) continue;

      context.save();
      context.translate(piece.x, piece.y);
      context.rotate(piece.rotation);
      context.fillStyle = piece.color;
      // 회전에 따라 납작해져 종잇조각처럼 보입니다.
      context.fillRect(
        -piece.w / 2,
        -piece.h / 2,
        piece.w,
        piece.h * Math.abs(Math.cos(piece.rotation)),
      );
      context.restore();
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
};
