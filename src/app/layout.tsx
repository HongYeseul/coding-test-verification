import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coding Proof",
  description: "초대된 멤버끼리 코딩 테스트 풀이 기록을 확인하는 공간",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
