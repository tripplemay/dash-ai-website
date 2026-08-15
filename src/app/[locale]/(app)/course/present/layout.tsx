import type { Metadata } from "next";

export const metadata: Metadata = { title: "课程演示" };

export default function PresentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
