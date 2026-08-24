// 逐课大纲数据源：scripts/lessons-seed.json（9 大课程域共 135 课次，唯一数据源）
// 此处做带类型的 re-export，供 data.ts / 课程详情页引用。

import raw from "../../scripts/lessons-seed.json";

export interface Lesson {
  n: number;
  title: string;
}

/** 课程 slug：s0=体验域，其余对应三大方向内的 8 个课程域 */
export type CourseSlug =
  | "s0"
  | "drawing"
  | "voice"
  | "video"
  | "python"
  | "app"
  | "data"
  | "drone"
  | "theory";

export const LESSONS: Record<CourseSlug, Lesson[]> = raw as Record<CourseSlug, Lesson[]>;

export const COURSE_SLUGS = Object.keys(LESSONS) as CourseSlug[];
