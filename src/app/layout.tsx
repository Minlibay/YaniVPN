import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YaniVPN — панель управления",
  description: "Панель управления VPN-серверами и клиентами",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
