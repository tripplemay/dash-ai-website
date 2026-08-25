import parentFaqSource from "../../content/parent-faq.zh.json";

export interface ParentFaqItem {
  slug: string;
  question: string;
  lead: string;
  paragraphs: string[];
  parentTip: string;
}

export interface ParentFaqGroup {
  id: string;
  title: string;
  items: ParentFaqItem[];
}

export interface ParentFaqDocument {
  version: string;
  locale: string;
  source: string;
  groups: ParentFaqGroup[];
}

export const PARENT_FAQ = parentFaqSource satisfies ParentFaqDocument;
