import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_KR, Noto_Serif_KR } from "next/font/google";
import "./globals.css";

import { SealDefs } from "@/components/seal";
import { themeBootstrapScript } from "@/lib/theme";

/**
 * 글꼴 세 벌. next/font가 빌드 때 받아 같은 도메인에서 내려주므로
 * 방문자 브라우저는 Google에 요청하지 않습니다.
 * 한글 글꼴은 유니코드 범위별로 잘려 있어 화면에 쓰인 조각만 받습니다.
 */
const sansKr = IBM_Plex_Sans_KR({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans-kr",
});

const serifKr = Noto_Serif_KR({
  weight: ["600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif-kr",
});

const monoKr = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-kr",
});

export const metadata: Metadata = {
  title: "도장",
  description: "초대된 멤버끼리 매일의 인증 기록을 확인하는 공간",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`h-full antialiased ${sansKr.variable} ${serifKr.variable} ${monoKr.variable}`}
    >
      <head>
        {/* 저장한 테마를 첫 페인트 전에 적용해 화면 번쩍임을 막습니다. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        {/* 도장 도형은 문서에 한 벌만 두고 화면 곳곳에서 참조합니다. */}
        <SealDefs />
        {children}
        {/* 실제 방문자 브라우저에서 잰 TTFB·LCP를 Vercel로 보냅니다. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
