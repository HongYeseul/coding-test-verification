import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import "./globals.css";

import { themeBootstrapScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Coding Proof",
  description: "초대된 멤버끼리 코딩 테스트 풀이 기록을 확인하는 공간",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        {/* 저장한 테마를 첫 페인트 전에 적용해 화면 번쩍임을 막습니다. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        {/* 실제 방문자 브라우저에서 잰 TTFB·LCP를 Vercel로 보냅니다. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
