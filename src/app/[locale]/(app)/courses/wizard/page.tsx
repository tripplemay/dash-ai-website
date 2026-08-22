import WizardPage from "../../course/wizard/page";
import { getPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return getPageMetadata(params, "wizard");
}

export default WizardPage;
