import type { Metadata } from "next";

export const metadata: Metadata = { title: "大屏播放" };

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
