import { randomUUID } from "node:crypto";
import {
  getDb,
  getCourseActivity,
  isValidCourseSlug,
  isValidLessonNumber,
  upsertCourseActivity,
  type WorkspaceCourseActivity,
} from "./db";
import { LESSONS } from "./lessons";

/**
 * Learning events are intentionally small, append-only facts. Keep the event
 * vocabulary here so API clients and server-side writers share one contract.
 */
export const LEARNING_EVENT_TYPES = [
  "lesson_started",
  "lesson_viewed",
  "lesson_completed",
  "course_started",
  "course_completed",
  "assignment_submitted",
  "work_submitted",
  "feedback_received",
] as const;

export type LearningEventType = (typeof LEARNING_EVENT_TYPES)[number];

const LEARNING_EVENT_TYPE_SET = new Set<string>(LEARNING_EVENT_TYPES);
const LESSON_SCOPED_EVENT_TYPES = new Set<LearningEventType>([
  "lesson_started",
  "lesson_viewed",
  "lesson_completed",
  "assignment_submitted",
  "work_submitted",
  "feedback_received",
]);
const LEARNING_EVENT_LIMIT = 1000;
const MAX_EVENT_ID_LENGTH = 128;
// Keep this in sync with learning_events.idempotency_key's 200-character
// migration constraint; rejecting here gives callers a deterministic 400.
const MAX_IDEMPOTENCY_KEY_LENGTH = 200;
const MAX_USER_ID_LENGTH = 255;
const MAX_PAYLOAD_BYTES = 64 * 1024;

export type LearningErrorCode =
  | "INVALID_BODY"
  | "INVALID_USER"
  | "USER_MISMATCH"
  | "INVALID_EVENT_ID"
  | "INVALID_COURSE"
  | "INVALID_LESSON"
  | "INVALID_EVENT_TYPE"
  | "INVALID_IDEMPOTENCY_KEY"
  | "INVALID_PAYLOAD"
  | "INVALID_TIMESTAMP"
  | "INVALID_LIMIT"
  | "IDEMPOTENCY_CONFLICT"
  | "EVENT_ID_CONFLICT"
  | "SCHEMA_UNAVAILABLE"
  | "SESSION_UNAVAILABLE"
  | "DATABASE_UNAVAILABLE";

/** Errors from this module carry a stable code for route handlers and clients. */
export class LearningError extends Error {
  readonly code: LearningErrorCode;

  constructor(code: LearningErrorCode, message: string = code, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LearningError";
    this.code = code;
  }
}

export interface LearningEvent {
  eventId: string;
  userId: string;
  courseSlug: string;
  lessonNumber: number;
  eventType: LearningEventType;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}

export interface LearningEventInput {
  eventId?: unknown;
  event_id?: unknown;
  userId?: unknown;
  user_id?: unknown;
  courseSlug?: unknown;
  course_slug?: unknown;
  lessonNumber?: unknown;
  lesson_number?: unknown;
  /** `lesson` is accepted as a compatibility alias for older activity writers. */
  lesson?: unknown;
  eventType?: unknown;
  event_type?: unknown;
  idempotencyKey?: unknown;
  idempotency_key?: unknown;
  payload?: unknown;
  payload_json?: unknown;
  occurredAt?: unknown;
  occurred_at?: unknown;
}

export interface ValidatedLearningEventInput {
  eventId: string;
  userId: string;
  courseSlug: string;
  lessonNumber: number;
  eventType: LearningEventType;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface WriteLearningEventResult {
  event: LearningEvent;
  /** True when the idempotency key replayed an already persisted event. */
  replayed: boolean;
}

export interface LearningEventQuery {
  courseSlug?: string;
  course_slug?: string;
  limit?: number;
  /** Return events strictly before this ISO timestamp. */
  before?: string;
}

export interface LearningProgress {
  courseSlug: string;
  totalLessons: number | null;
  currentLesson: number;
  /** The highest lesson explicitly completed, when one exists. */
  lastCompletedLesson: number | null;
  completedLessons: number[];
  completedLessonCount: number;
  /** Null until a completion fact or a course-completed fact exists. */
  completionPercent: number | null;
  started: boolean;
  completed: boolean;
  lastEventAt: string | null;
  eventCount: number;
  source: "learning_events" | "workspace_course_activity" | "none";
}

export interface DeriveProgressOptions {
  courseSlug?: string;
  totalLessons?: number | null;
  userId?: string;
  source?: LearningProgress["source"];
}

export interface CourseProgressOptions {
  totalLessons?: number | null;
  /** Deprecated compatibility field; progress aggregation is not truncated. */
  eventLimit?: number;
}

interface LearningEventsSchema {
  eventId: string;
  userId: string;
  courseSlug: string;
  lessonNumber: string;
  eventType: string;
  idempotencyKey: string;
  payload: string;
  occurredAt: string;
  createdAt: string;
}

interface LearningEventRow {
  eventId: unknown;
  userId: unknown;
  courseSlug: unknown;
  lessonNumber: unknown;
  eventType: unknown;
  idempotencyKey: unknown;
  payload: unknown;
  occurredAt: unknown;
  createdAt: unknown;
}

const EVENT_COLUMN_ALIASES: Record<keyof LearningEventsSchema, readonly string[]> = {
  eventId: ["event_id", "id"],
  userId: ["user_id"],
  courseSlug: ["course_slug"],
  lessonNumber: ["lesson_number", "lesson"],
  eventType: ["event_type", "type"],
  idempotencyKey: ["idempotency_key", "idempotency"],
  payload: ["payload_json", "payload"],
  occurredAt: ["occurred_at", "occurred_on"],
  createdAt: ["created_at", "inserted_at"],
};

function fail(code: LearningErrorCode, message = code): never {
  throw new LearningError(code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertUserId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > MAX_USER_ID_LENGTH) {
    fail("INVALID_USER");
  }
  if ([...value].some((character) => character < " " || character === "\u007f")) {
    fail("INVALID_USER");
  }
}

function normalizeOpaque(value: unknown, code: "INVALID_EVENT_ID" | "INVALID_IDEMPOTENCY_KEY", maximum: number) {
  if (typeof value !== "string") fail(code);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) fail(code);
  if ([...normalized].some((character) => character < " " || character === "\u007f")) fail(code);
  return normalized;
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalizeJson(value[key])])
  );
}

function normalizePayload(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  let payload = value;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      fail("INVALID_PAYLOAD");
    }
  }
  if (!isRecord(payload)) fail("INVALID_PAYLOAD");

  let serialized: string;
  try {
    serialized = JSON.stringify(canonicalizeJson(payload));
  } catch {
    fail("INVALID_PAYLOAD");
  }
  if (Buffer.byteLength(serialized, "utf8") > MAX_PAYLOAD_BYTES) fail("INVALID_PAYLOAD");
  try {
    return JSON.parse(serialized) as Record<string, unknown>;
  } catch {
    fail("INVALID_PAYLOAD");
  }
}

function normalizeTimestamp(value: unknown): string {
  if (value === undefined || value === null || value === "") return new Date().toISOString();
  if (typeof value !== "string" && !(value instanceof Date)) fail("INVALID_TIMESTAMP");
  const parsed = new Date(value as string | Date);
  if (!Number.isFinite(parsed.getTime())) fail("INVALID_TIMESTAMP");
  return parsed.toISOString();
}

export function isValidLearningEventType(value: unknown): value is LearningEventType {
  return typeof value === "string" && LEARNING_EVENT_TYPE_SET.has(value);
}

/** Validate and normalize untrusted event input before it reaches SQLite. */
export function validateLearningEventInput(input: unknown, expectedUserId?: string): ValidatedLearningEventInput {
  if (!isRecord(input)) fail("INVALID_BODY");

  const inputUserId = input.userId ?? input.user_id;
  const userId = expectedUserId ?? inputUserId;
  assertUserId(userId);
  if (expectedUserId !== undefined && inputUserId !== undefined && inputUserId !== expectedUserId) {
    fail("USER_MISMATCH");
  }

  const courseSlug = input.courseSlug ?? input.course_slug;
  if (!isValidCourseSlug(courseSlug)) fail("INVALID_COURSE");

  const lessonValue = input.lessonNumber ?? input.lesson_number ?? input.lesson;
  if (!isValidLessonNumber(lessonValue, courseSlug)) fail("INVALID_LESSON");

  const eventType = input.eventType ?? input.event_type;
  if (!isValidLearningEventType(eventType)) fail("INVALID_EVENT_TYPE");
  if (LESSON_SCOPED_EVENT_TYPES.has(eventType) && lessonValue < 1) fail("INVALID_LESSON");

  const idempotencyKey = normalizeOpaque(
    input.idempotencyKey ?? input.idempotency_key,
    "INVALID_IDEMPOTENCY_KEY",
    MAX_IDEMPOTENCY_KEY_LENGTH
  );
  const eventId =
    (input.eventId ?? input.event_id) === undefined || (input.eventId ?? input.event_id) === null
      ? randomUUID()
      : normalizeOpaque(input.eventId ?? input.event_id, "INVALID_EVENT_ID", MAX_EVENT_ID_LENGTH);

  return {
    eventId,
    userId,
    courseSlug,
    lessonNumber: lessonValue,
    eventType,
    idempotencyKey,
    payload: normalizePayload(input.payload ?? input.payload_json),
    occurredAt: normalizeTimestamp(input.occurredAt ?? input.occurred_at),
  };
}

/** Short alias for callers that already use the event terminology. */
export const validateLearningEvent = validateLearningEventInput;

function resolveSchema(): LearningEventsSchema {
  let db;
  try {
    db = getDb();
  } catch (error) {
    throw new LearningError("DATABASE_UNAVAILABLE", "learning event database unavailable", { cause: error });
  }

  try {
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'learning_events'")
      .get() as { name?: string } | undefined;
    if (!table) throw new LearningError("SCHEMA_UNAVAILABLE", "learning_events table is not migrated");

    const columns = new Set(
      (db.prepare("PRAGMA table_info(learning_events)").all() as Array<{ name: string }>).map((column) => column.name)
    );
    const resolved = {} as LearningEventsSchema;
    for (const [key, aliases] of Object.entries(EVENT_COLUMN_ALIASES) as Array<[
      keyof LearningEventsSchema,
      readonly string[]
    ]>) {
      const column = aliases.find((candidate) => columns.has(candidate));
      if (!column) {
        throw new LearningError("SCHEMA_UNAVAILABLE", `learning_events is missing ${aliases[0]}`);
      }
      resolved[key] = column;
    }
    return resolved;
  } catch (error) {
    if (error instanceof LearningError) throw error;
    throw new LearningError("DATABASE_UNAVAILABLE", "learning event schema unavailable", { cause: error });
  }
}

function quoteColumn(column: string) {
  // resolveSchema only returns hard-coded aliases; quoting keeps generated SQL explicit.
  return `"${column.replaceAll('"', '""')}"`;
}

function selectColumns(schema: LearningEventsSchema) {
  return [
    `${quoteColumn(schema.eventId)} AS eventId`,
    `${quoteColumn(schema.userId)} AS userId`,
    `${quoteColumn(schema.courseSlug)} AS courseSlug`,
    `${quoteColumn(schema.lessonNumber)} AS lessonNumber`,
    `${quoteColumn(schema.eventType)} AS eventType`,
    `${quoteColumn(schema.idempotencyKey)} AS idempotencyKey`,
    `${quoteColumn(schema.payload)} AS payload`,
    `${quoteColumn(schema.occurredAt)} AS occurredAt`,
    `${quoteColumn(schema.createdAt)} AS createdAt`,
  ].join(", ");
}

function parseStoredPayload(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function mapRow(row: LearningEventRow): LearningEvent {
  const eventType = String(row.eventType);
  if (!isValidLearningEventType(eventType)) {
    throw new LearningError("DATABASE_UNAVAILABLE", "learning_events contains an unknown event type");
  }
  return {
    eventId: String(row.eventId),
    userId: String(row.userId),
    courseSlug: String(row.courseSlug),
    lessonNumber: Number(row.lessonNumber),
    eventType,
    idempotencyKey: String(row.idempotencyKey),
    payload: parseStoredPayload(row.payload),
    occurredAt: String(row.occurredAt),
    createdAt: String(row.createdAt),
  };
}

function dbError(error: unknown): LearningError {
  if (error instanceof LearningError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/ON CONFLICT clause does not match/i.test(message)) {
    return new LearningError("SCHEMA_UNAVAILABLE", "learning_events.idempotency_key must be unique", { cause: error });
  }
  if (/unique constraint failed/i.test(message) && /event_id/i.test(message)) {
    return new LearningError("EVENT_ID_CONFLICT", "event_id already exists", { cause: error });
  }
  if (/unique constraint failed/i.test(message) && /idempotency/i.test(message)) {
    return new LearningError("IDEMPOTENCY_CONFLICT", "idempotency key already exists", { cause: error });
  }
  return new LearningError("DATABASE_UNAVAILABLE", "learning event database error", { cause: error });
}

function sameIntent(existing: LearningEvent, input: ValidatedLearningEventInput) {
  return (
    existing.userId === input.userId &&
    existing.courseSlug === input.courseSlug &&
    existing.lessonNumber === input.lessonNumber &&
    existing.eventType === input.eventType &&
    JSON.stringify(canonicalizeJson(existing.payload)) === JSON.stringify(canonicalizeJson(input.payload))
  );
}

function mirrorWorkspaceActivity(input: ValidatedLearningEventInput) {
  // The legacy table powers older workspace readers. Keep it best-effort so a
  // partially migrated deployment can still accept append-only learning facts.
  const lesson =
    input.lessonNumber > 0
      ? input.lessonNumber
      : input.eventType === "course_completed"
        ? (LESSONS[input.courseSlug as keyof typeof LESSONS]?.length ?? 0)
        : 0;
  if (lesson <= 0) return;
  try {
    upsertCourseActivity(input.userId, input.courseSlug, lesson);
  } catch {
    // The table is optional during the learning-events rollout.
  }
}

/**
 * Append one event. Reusing an idempotency key returns the original event and
 * never creates a second row; changing the intent for that key is a conflict.
 */
export function writeLearningEvent(
  userId: string,
  input: LearningEventInput
): WriteLearningEventResult {
  const validated = validateLearningEventInput({ ...input, userId }, userId);
  const schema = resolveSchema();
  let result: WriteLearningEventResult;

  try {
    const db = getDb();
    result = db.transaction(() => {
      const columns = selectColumns(schema);
      const insertColumns = [
        schema.eventId,
        schema.userId,
        schema.courseSlug,
        schema.lessonNumber,
        schema.eventType,
        schema.idempotencyKey,
        schema.payload,
        schema.occurredAt,
        schema.createdAt,
      ]
        .map(quoteColumn)
        .join(", ");
      const values = [
        validated.eventId,
        validated.userId,
        validated.courseSlug,
        validated.lessonNumber,
        validated.eventType,
        validated.idempotencyKey,
        JSON.stringify(validated.payload),
        validated.occurredAt,
        new Date().toISOString(),
      ];
      const insertResult = db.prepare(
        `INSERT INTO learning_events (${insertColumns}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(${quoteColumn(schema.idempotencyKey)}) DO NOTHING`
      ).run(...values);

      const row = db
        .prepare(
          `SELECT ${columns} FROM learning_events WHERE ${quoteColumn(schema.idempotencyKey)} = ? LIMIT 1`
        )
        .get(validated.idempotencyKey) as LearningEventRow | undefined;
      if (!row) throw new LearningError("DATABASE_UNAVAILABLE", "learning event write could not be read back");
      const event = mapRow(row);
      if (event.userId !== validated.userId || !sameIntent(event, validated)) {
        throw new LearningError("IDEMPOTENCY_CONFLICT", "idempotency key was concurrently reused");
      }
      return { event, replayed: insertResult.changes === 0 };
    })();
  } catch (error) {
    throw dbError(error);
  }

  if (!result.replayed) mirrorWorkspaceActivity(validated);
  return result;
}

/** Alias used by event producers that prefer an append-oriented name. */
export const appendLearningEvent = writeLearningEvent;
export const recordLearningEvent = writeLearningEvent;

function normalizeLimit(value: number | undefined) {
  if (value === undefined) return 50;
  if (!Number.isSafeInteger(value) || value < 1 || value > LEARNING_EVENT_LIMIT) {
    throw new LearningError("INVALID_LIMIT", `limit must be an integer between 1 and ${LEARNING_EVENT_LIMIT}`);
  }
  return value;
}

function validateQueryUser(userId: string) {
  assertUserId(userId);
}

/** Read a user's append-only events, optionally narrowed to one course. */
export function listLearningEvents(userId: string, options: LearningEventQuery = {}): LearningEvent[] {
  validateQueryUser(userId);
  const courseSlug = options.courseSlug ?? options.course_slug;
  if (courseSlug !== undefined && !isValidCourseSlug(courseSlug)) {
    throw new LearningError("INVALID_COURSE", "invalid course slug");
  }
  const limit = normalizeLimit(options.limit);
  const before = options.before === undefined ? undefined : normalizeTimestamp(options.before);
  const schema = resolveSchema();
  try {
    const db = getDb();
    const where = [`${quoteColumn(schema.userId)} = ?`];
    const args: Array<string | number> = [userId];
    if (courseSlug) {
      where.push(`${quoteColumn(schema.courseSlug)} = ?`);
      args.push(courseSlug);
    }
    if (before) {
      where.push(`julianday(${quoteColumn(schema.occurredAt)}) < julianday(?)`);
      args.push(before);
    }
    const rows = db
      .prepare(
        `SELECT ${selectColumns(schema)} FROM learning_events
         WHERE ${where.join(" AND ")}
         ORDER BY julianday(${quoteColumn(schema.occurredAt)}) DESC, ${quoteColumn(schema.occurredAt)} DESC,
                  julianday(${quoteColumn(schema.createdAt)}) DESC, ${quoteColumn(schema.createdAt)} DESC,
                  ${quoteColumn(schema.eventId)} DESC
         LIMIT ?`
      )
      .all(...args, limit) as LearningEventRow[];
    return rows.map(mapRow);
  } catch (error) {
    throw dbError(error);
  }
}

export const getLearningEvents = listLearningEvents;
export const queryLearningEvents = listLearningEvents;

export function listCourseLearningEvents(userId: string, courseSlug: string, limit = LEARNING_EVENT_LIMIT) {
  return listLearningEvents(userId, { courseSlug, limit });
}

function eventValue<T extends keyof LearningEvent>(event: LearningEvent | Record<string, unknown>, camel: T, snake: string) {
  const record = event as Record<string, unknown>;
  return record[camel] ?? record[snake];
}

function totalLessonsFor(courseSlug: string, requested: number | null | undefined) {
  if (requested !== undefined) {
    if (requested === null) return null;
    if (!Number.isSafeInteger(requested) || requested < 0) throw new LearningError("INVALID_LESSON", "invalid total lessons");
    return requested;
  }
  const lessons = LESSONS[courseSlug as keyof typeof LESSONS];
  return lessons ? lessons.length : null;
}

function baseProgress(
  courseSlug: string,
  totalLessons: number | null,
  source: LearningProgress["source"]
): LearningProgress {
  return {
    courseSlug,
    totalLessons,
    currentLesson: 0,
    lastCompletedLesson: null,
    completedLessons: [],
    completedLessonCount: 0,
    completionPercent: null,
    started: false,
    completed: false,
    lastEventAt: null,
    eventCount: 0,
    source,
  };
}

function timestampRank(value: string) {
  const normalized = value.trim();
  const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const parsed = Date.parse(hasTimezone ? normalized : `${normalized.replace(" ", "T")}Z`);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function progressFromWorkspaceActivity(
  courseSlug: string,
  activity: WorkspaceCourseActivity | undefined,
  totalLessons: number | null
): LearningProgress {
  const progress = baseProgress(courseSlug, totalLessons, "workspace_course_activity");
  if (!activity) return { ...progress, source: "none" };
  progress.currentLesson = Math.max(0, activity.lastLesson);
  progress.started = progress.currentLesson > 0;
  progress.lastEventAt = activity.lastViewedAt;
  return progress;
}

function mergeLegacyActivity(progress: LearningProgress, activity: WorkspaceCourseActivity | undefined) {
  if (!activity) return progress;
  if (activity.lastLesson > progress.currentLesson) progress.currentLesson = activity.lastLesson;
  progress.started ||= activity.lastLesson > 0;
  if (
    activity.lastViewedAt &&
    (!progress.lastEventAt || timestampRank(activity.lastViewedAt) > timestampRank(progress.lastEventAt))
  ) {
    progress.lastEventAt = activity.lastViewedAt;
  }
  return progress;
}

/**
 * Derive progress from compact database facts instead of a bounded event
 * page. The browser still receives a capped event history, but completion
 * state remains correct after a learner has generated more than 1,000 events.
 */
function deriveStoredProgress(
  userId: string,
  courseSlug: string,
  totalLessons: number | null,
  schema: LearningEventsSchema,
): LearningProgress | null {
  try {
    const database = getDb();
    const userColumn = quoteColumn(schema.userId);
    const courseColumn = quoteColumn(schema.courseSlug);
    const lessonColumn = quoteColumn(schema.lessonNumber);
    const typeColumn = quoteColumn(schema.eventType);
    const occurredColumn = quoteColumn(schema.occurredAt);
    const where = `${userColumn} = ? AND ${courseColumn} = ?`;
    const summary = database
      .prepare(
        `SELECT COUNT(*) AS eventCount, MAX(CAST(${lessonColumn} AS INTEGER)) AS currentLesson
         FROM learning_events WHERE ${where}`,
      )
      .get(userId, courseSlug) as { eventCount: number; currentLesson: number | null };
    if (!summary || Number(summary.eventCount) < 1) return null;

    const progress = baseProgress(courseSlug, totalLessons, "learning_events");
    progress.eventCount = Number(summary.eventCount);
    progress.started = progress.eventCount > 0;
    progress.currentLesson = Math.max(0, Number(summary.currentLesson) || 0);

    const completedRows = database
      .prepare(
        `SELECT DISTINCT CAST(${lessonColumn} AS INTEGER) AS lesson
         FROM learning_events
         WHERE ${where} AND ${typeColumn} = ? AND CAST(${lessonColumn} AS INTEGER) > 0
         ORDER BY lesson ASC`,
      )
      .all(userId, courseSlug, "lesson_completed") as Array<{ lesson: number }>;
    const completed = new Set(
      completedRows
        .map((row) => Number(row.lesson))
        .filter((lesson) => Number.isSafeInteger(lesson) && lesson > 0),
    );
    const courseCompleted = database
      .prepare(
        `SELECT CAST(${lessonColumn} AS INTEGER) AS lesson
         FROM learning_events
         WHERE ${where} AND ${typeColumn} = ?
         ORDER BY julianday(${occurredColumn}) DESC, ${occurredColumn} DESC
         LIMIT 1`,
      )
      .get(userId, courseSlug, "course_completed") as { lesson: number } | undefined;
    if (courseCompleted) {
      progress.completed = true;
      if (totalLessons !== null) {
        progress.currentLesson = Math.max(progress.currentLesson, totalLessons);
        for (let number = 1; number <= totalLessons; number += 1) completed.add(number);
      } else if (Number.isSafeInteger(Number(courseCompleted.lesson)) && Number(courseCompleted.lesson) > 0) {
        completed.add(Number(courseCompleted.lesson));
      }
    }

    const latest = database
      .prepare(
        `SELECT ${occurredColumn} AS occurredAt
         FROM learning_events WHERE ${where}
         ORDER BY julianday(${occurredColumn}) DESC, ${occurredColumn} DESC
         LIMIT 1`,
      )
      .get(userId, courseSlug) as { occurredAt: string } | undefined;
    progress.completedLessons = [...completed].sort((a, b) => a - b);
    progress.completedLessonCount = progress.completedLessons.length;
    progress.lastCompletedLesson = progress.completedLessons.at(-1) ?? null;
    progress.lastEventAt = latest?.occurredAt ? String(latest.occurredAt) : null;
    if (totalLessons !== null && totalLessons > 0) {
      if (progress.completedLessonCount > 0 || progress.completed) {
        progress.completionPercent = Math.min(100, Math.round((progress.completedLessonCount / totalLessons) * 100));
      }
      if (progress.completedLessonCount >= totalLessons) progress.completed = true;
    }
    return progress;
  } catch (error) {
    throw dbError(error);
  }
}

/** Derive a conservative progress snapshot from immutable facts. */
export function deriveProgress(
  events: readonly LearningEvent[],
  optionsOrCourse?: string | DeriveProgressOptions
): LearningProgress {
  const options: DeriveProgressOptions =
    typeof optionsOrCourse === "string" ? { courseSlug: optionsOrCourse } : optionsOrCourse || {};
  const inferredCourse = options.courseSlug || String(events[0] ? eventValue(events[0], "courseSlug", "course_slug") || "" : "");
  if (!isValidCourseSlug(inferredCourse)) throw new LearningError("INVALID_COURSE", "course slug is required to derive progress");
  const totalLessons = totalLessonsFor(inferredCourse, options.totalLessons);
  const source = options.source || "learning_events";
  const progress = baseProgress(inferredCourse, totalLessons, source);
  const scoped = events.filter((event) => eventValue(event, "courseSlug", "course_slug") === inferredCourse);
  progress.eventCount = scoped.length;
  progress.started = scoped.length > 0;

  const completed = new Set<number>();
  let currentLesson = 0;
  let latestTime = "";
  for (const event of scoped) {
    const lesson = Number(eventValue(event, "lessonNumber", "lesson_number"));
    if (Number.isSafeInteger(lesson) && lesson > currentLesson) currentLesson = lesson;
    const eventType = String(eventValue(event, "eventType", "event_type"));
    if (eventType === "lesson_completed" && Number.isSafeInteger(lesson) && lesson > 0) completed.add(lesson);
    if (eventType === "course_completed") {
      progress.completed = true;
      if (totalLessons !== null) currentLesson = Math.max(currentLesson, totalLessons);
      if (totalLessons !== null && totalLessons > 0) {
        for (let number = 1; number <= totalLessons; number += 1) completed.add(number);
      } else if (Number.isSafeInteger(lesson) && lesson > 0) {
        completed.add(lesson);
      }
    }
    const occurredAt = String(eventValue(event, "occurredAt", "occurred_at") || "");
    if (!latestTime || timestampRank(occurredAt) > timestampRank(latestTime)) latestTime = occurredAt;
  }

  progress.currentLesson = currentLesson;
  progress.completedLessons = [...completed].sort((a, b) => a - b);
  progress.completedLessonCount = progress.completedLessons.length;
  progress.lastCompletedLesson = progress.completedLessons.at(-1) ?? null;
  progress.lastEventAt = latestTime || null;
  if (totalLessons !== null && totalLessons > 0) {
    if (progress.completedLessonCount > 0 || progress.completed) {
      progress.completionPercent = Math.min(100, Math.round((progress.completedLessonCount / totalLessons) * 100));
    }
    if (progress.completedLessonCount >= totalLessons) progress.completed = true;
  }
  return progress;
}

/**
 * Resolve progress for one user/course. If the new event table is unavailable
 * or empty, the legacy latest-lesson table remains a readable fallback.
 */
export function getCourseProgress(
  userId: string,
  courseSlug: string,
  options: CourseProgressOptions = {}
): LearningProgress {
  assertUserId(userId);
  if (!isValidCourseSlug(courseSlug)) throw new LearningError("INVALID_COURSE", "invalid course slug");
  const totalLessons = totalLessonsFor(courseSlug, options.totalLessons);

  let schema: LearningEventsSchema | undefined;
  try {
    schema = resolveSchema();
  } catch (error) {
    if (!(error instanceof LearningError) || error.code !== "SCHEMA_UNAVAILABLE") throw error;
  }

  let activity: WorkspaceCourseActivity | undefined;
  try {
    activity = getCourseActivity(userId, courseSlug);
  } catch {
    // Older databases may not have the compatibility table either.
  }
  if (schema) {
    const progress = deriveStoredProgress(userId, courseSlug, totalLessons, schema);
    if (progress) return mergeLegacyActivity(progress, activity);
  }
  return progressFromWorkspaceActivity(courseSlug, activity, totalLessons);
}

export const deriveCourseProgress = getCourseProgress;
export const deriveProgressFromEvents = deriveProgress;
export const getLearningProgress = getCourseProgress;
