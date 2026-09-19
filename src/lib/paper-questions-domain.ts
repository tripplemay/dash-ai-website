// 真题练习领域模型与判分逻辑（纯类型/函数，服务端与客户端共用）。
// 题目内容由 scripts/papers-questions.json 在构建期内联（抽取管线见 paper-extract.mjs）。

export type QuestionType = "choice" | "multiple" | "fill" | "essay";

export interface QuestionOption {
  key: string;
  text: string;
}

export interface PaperQuestion {
  id: string;
  seq: number;
  type: QuestionType;
  stem: string;
  options?: QuestionOption[];
  answer: string | string[];
  explanation?: string;
  points: number;
}

export interface PaperQuestionSet {
  paperId: string;
  slug: string;
  extractor: { model: string; at: string; reviewed: boolean };
  questions: PaperQuestion[];
}

/** 判分结果：isCorrect=null 表示待自评（解答题） */
export interface GradeResult {
  isCorrect: 0 | 1 | null;
  earnedPoints: number;
}

/** 填空题答案归一化：去空白、全半角统一（数字/字母/常见符号）、大小写不敏感 */
export function normalizeFillAnswer(value: string): string {
  let text = String(value ?? "").trim();
  text = text.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  text = text.replace(/[Ａ-Ｚａ-ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  text = text.replace(/．/g, ".").replace(/，/g, ",").replace(/－/g, "-").replace(/°/g, "°");
  text = text.replace(/\s+/g, "");
  return text.toLowerCase();
}

function normalizeChoiceKey(value: string): string {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeMultipleKeys(value: string | string[]): string[] {
  const raw = Array.isArray(value) ? value.join("") : String(value ?? "");
  const keys = raw
    .replace(/[,，、\s]+/g, "")
    .split("")
    .map((ch) => ch.toUpperCase())
    .filter((ch) => /[A-Z]/.test(ch));
  return [...new Set(keys)].sort();
}

/** 逐题判分：选择/多选精确匹配，填空归一化匹配，解答题提交后不判分（展示参考答案，用户自评） */
export function gradeAnswer(question: PaperQuestion, userAnswer: string | string[]): GradeResult {
  const points = question.points;
  switch (question.type) {
    case "choice": {
      const expected = normalizeChoiceKey(String(question.answer));
      const given = normalizeChoiceKey(Array.isArray(userAnswer) ? userAnswer.join("") : userAnswer);
      const correct = given.length > 0 && given === expected;
      return { isCorrect: correct ? 1 : 0, earnedPoints: correct ? points : 0 };
    }
    case "multiple": {
      const expected = normalizeMultipleKeys(Array.isArray(question.answer) ? question.answer : [String(question.answer)]);
      const given = normalizeMultipleKeys(userAnswer);
      const correct = given.length > 0 && given.join("") === expected.join("");
      return { isCorrect: correct ? 1 : 0, earnedPoints: correct ? points : 0 };
    }
    case "fill": {
      const expected = normalizeFillAnswer(String(question.answer));
      const given = normalizeFillAnswer(Array.isArray(userAnswer) ? userAnswer.join("") : userAnswer);
      // 多空题：标准答案可用 | 分隔多个可接受答案
      const accepted = expected.split("|").filter(Boolean);
      const correct = given.length > 0 && (accepted.length === 0 ? false : accepted.includes(given));
      return { isCorrect: correct ? 1 : 0, earnedPoints: correct ? points : 0 };
    }
    case "essay":
      return { isCorrect: null, earnedPoints: 0 };
  }
}

export function isAutoGradable(question: PaperQuestion): boolean {
  return question.type !== "essay";
}

/** 下发给客户端的脱敏题目（不含答案与解析） */
export function sanitizeQuestion(question: PaperQuestion): Omit<PaperQuestion, "answer" | "explanation"> {
  const safe = { ...question } as Partial<PaperQuestion>;
  delete safe.answer;
  delete safe.explanation;
  return safe as Omit<PaperQuestion, "answer" | "explanation">;
}

/** 练习页展示用题目类型文案键（messages: competitions.practiceType*） */
export const QUESTION_TYPE_LABEL_KEYS: Record<QuestionType, string> = {
  choice: "practiceTypeChoice",
  multiple: "practiceTypeMultiple",
  fill: "practiceTypeFill",
  essay: "practiceTypeEssay",
};
