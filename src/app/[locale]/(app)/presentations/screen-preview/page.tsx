import CampusScreen from "@/components/campus-screen";
import { getPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return getPageMetadata(params, "screen");
}

export default function CampusLoopPreviewPage() {
  return <CampusScreen />;
}
