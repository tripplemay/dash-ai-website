import CoursePresentPage from "../../course/present/page";
import { getPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return getPageMetadata(params, "coursePresentation");
}

export default CoursePresentPage;
