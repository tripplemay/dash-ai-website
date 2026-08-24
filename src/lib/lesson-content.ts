// 逐课详情数据源：scripts/lessons-content.json（9 大课程域 × 全量 135 课次）
// 与 lessons.ts（标题列表）并存；课程详情页的右侧内容区使用本数据。

import raw from "../../scripts/lessons-content.json";
import type { CourseSlug } from "./lessons";

export interface LessonDetail {
  n: number;
  title: string;
  summary: string; // 课程梗概
  goals: string[]; // 学习目标 ×3
  outline: string[]; // 课堂环节 ×5，格式「环节名：简述」
  output: string; // 结课产出
}

export const LESSON_DETAILS: Record<CourseSlug, LessonDetail[]> = raw as Record<
  CourseSlug,
  LessonDetail[]
>;
