import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://flight-tracker-six-pink.vercel.app";

export const metadata: Metadata = {
  title: "Flight Tracker — 3D 비행 경로 트래커",
  description:
    "3D 지구본 위에서 비행 경로를 시각화하고 영상으로 내보내세요. 공항을 순서대로 입력하면 경로가 자동 연결됩니다.",
  keywords: ["flight tracker", "3D globe", "비행 경로", "flight path", "travel map", "여행 지도"],
  authors: [{ name: "greekr4" }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "Flight Tracker — 3D 비행 경로 트래커",
    description:
      "3D 지구본 위에서 비행 경로를 시각화하고 영상으로 내보내세요.",
    url: SITE_URL,
    siteName: "Flight Tracker",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Flight Tracker — 3D 비행 경로 트래커",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Flight Tracker — 3D 비행 경로 트래커",
    description:
      "3D 지구본 위에서 비행 경로를 시각화하고 영상으로 내보내세요.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
