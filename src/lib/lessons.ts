// 逐课大纲数据源：scripts/lessons-seed.json（10 门课程共 135 课，唯一数据源）
// 此处做带类型的 re-export，供 data.ts / 课程详情页引用。

import raw from "../../scripts/lessons-seed.json";

export interface Lesson {
  n: number;
  title: string;
}

/** 课程 slug：s0=体验课，其余对应 LABS 内 8 门课程 */
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
