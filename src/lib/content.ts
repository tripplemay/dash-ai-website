import { randomUUID } from "node:crypto";
import { getDb } from "./db";

export const CONTENT_STATUSES = ["draft", "review", "published", "archived"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface ContentEntryDTO {
  id: string;
  type: string;
  slug: string;
  locale: string;
  status: ContentStatus;
  revision: number;
  ownerId: string | null;
  reviewerId: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentRevisionDTO {
  id: string;
  entryId: string;
  revision: number;
  locale: string;
  payload: JsonValue;
  status: ContentStatus;
  ownerId: string | null;
  reviewerId: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ContentReferenceDTO {
  id: string;
  fromEntryId: string;
  toEntryId: string;
  referenceType: string;
  metadata: JsonValue;
  createdBy: string | null;
  createdAt: string;
}

export interface AuditEventDTO {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  fromStatus: ContentStatus | null;
  toStatus: ContentStatus | null;
  revision: number | null;
  metadata: JsonValue;
  createdAt: string;
}

export interface ContentEntryDetail extends ContentEntryDTO {
  latestRevision: ContentRevisionDTO | null;
  revisions: ContentRevisionDTO[];
  references: ContentReferenceDTO[];
  audits: AuditEventDTO[];
}

export interface ContentListOptions {
  type?: string;
  contentType?: string;
  locale?: string;
  status?: ContentStatus | ContentStatus[];
  query?: string;
  /** Restrict the result to entries currently visible to non-admin readers. */
  publicOnly?: boolean;
  limit?: number;
  cursor?: string;
}

export interface ContentEntryPage {
  items: ContentEntryDTO[];
  nextCursor: string | null;
}

export interface AuditListOptions {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  limit?: number;
  cursor?: string;
}

export interface AuditEventPage {
  items: AuditEventDTO[];
  nextCursor: string | null;
}

export interface CreateContentDraftInput {
  id?: string;
  type?: string;
  contentType?: string;
  slug: string;
  locale?: string;
  payload?: JsonValue;
  ownerId?: string | null;
  reviewerId?: string | null;
  expiresAt?: string | null;
}

export interface UpdateContentDraftInput {
  payload: JsonValue;
  locale?: string;
  ownerId?: string | null;
  reviewerId?: string | null;
  expiresAt?: string | null;
  expectedRevision?: number;
}

export interface ContentReferenceInput {
  fromEntryId: string;
  toEntryId: string;
  referenceType?: string;
  metadata?: JsonValue;
}

export interface AuditEventInput {
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string | null;
  fromStatus?: ContentStatus | null;
  toStatus?: ContentStatus | null;
  revision?: number | null;
  metadata?: JsonValue;
}

export type ContentActor =
  | string
  | { id?: string | null; user?: { id?: string | null } | null }
  | null
  | undefined;

export class ContentNotFoundError extends Error {
  constructor(message = "CONTENT_NOT_FOUND") {
    super(message);
    this.name = "ContentNotFoundError";
  }
}

export class ContentConflictError extends Error {
  constructor(message = "CONTENT_CONFLICT") {
    super(message);
    this.name = "ContentConflictError";
  }
}

export class InvalidContentError extends Error {
  constructor(message = "INVALID_CONTENT") {
    super(message);
    this.name = "InvalidContentError";
  }
}

function isUniqueConstraintError(error: unknown) {
  return /unique constraint failed|constraint failed:.*unique/i.test(String(error instanceof Error ? error.message : error));
}

type EntryRow = {
  id: string;
  content_type: string;
  slug: string;
  locale: string;
  status: string;
  revision: number;
  owner_id: string | null;
  reviewer_id: string | null;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type RevisionRow = {
  id: string;
  entry_id: string;
  revision: number;
  locale: string;
  payload: string;
  status: string;
  owner_id: string | null;
  reviewer_id: string | null;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
};

type ReferenceRow = {
  id: string;
  from_entry_id: string;
  to_entry_id: string;
  reference_type: string;
  metadata: string;
  created_by: string | null;
  created_at: string;
};

type AuditRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string | null;
  from_status: string | null;
  to_status: string | null;
  revision: number | null;
  metadata: string;
  created_at: string;
};

const ENTRY_COLUMNS = `
  id, content_type, slug, locale, status, revision, owner_id, reviewer_id,
  published_at, expires_at, created_at, updated_at
`;
const REVISION_COLUMNS = `
  id, entry_id, revision, locale, payload, status, owner_id, reviewer_id,
  published_at, expires_at, created_at
`;
const REFERENCE_COLUMNS = `
  id, from_entry_id, to_entry_id, reference_type, metadata, created_by, created_at
`;
const AUDIT_COLUMNS = `
  id, entity_type, entity_id, action, actor_id, from_status, to_status,
  revision, metadata, created_at
`;

const STATUS_SET = new Set<string>(CONTENT_STATUSES);
const SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]{0,159}$/;
const TYPE_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/;
const LOCALE_PATTERN = /^[A-Za-z]{2,8}(?:[-_][A-Za-z0-9]{2,8})?$/;
const MAX_PAGE_SIZE = 100;

function assertContentSchema() {
  const row = getDb()
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'content_entries'")
    .get() as { ok: number } | undefined;
  if (!row) throw new Error("content tables are not migrated; run scripts/migrate.mjs");
}

function db() {
  assertContentSchema();
  return getDb();
}

function actorId(actor: ContentActor): string | null {
  if (typeof actor === "string") return actor.trim() || null;
  if (actor && typeof actor.id === "string") return actor.id.trim() || null;
  if (actor?.user && typeof actor.user.id === "string") return actor.user.id.trim() || null;
  return null;
}

function requireText(value: unknown, field: string, pattern?: RegExp) {
  if (typeof value !== "string") throw new InvalidContentError(`INVALID_${field.toUpperCase()}`);
  const normalized = value.trim();
  if (!normalized || normalized.length > 200 || (pattern && !pattern.test(normalized))) {
    throw new InvalidContentError(`INVALID_${field.toUpperCase()}`);
  }
  return normalized;
}

function normalizeType(value: unknown) {
  return requireText(value, "content_type", TYPE_PATTERN);
}

function normalizeSlug(value: unknown) {
  return requireText(value, "slug", SLUG_PATTERN);
}

function normalizeLocale(value: unknown) {
  return requireText(value ?? "zh", "locale", LOCALE_PATTERN);
}

function normalizeOptionalId(value: unknown, field: string) {
  if (value === undefined || value === null) return null;
  return requireText(value, field);
}

function normalizeStatus(value: unknown): ContentStatus {
  if (typeof value !== "string" || !STATUS_SET.has(value)) throw new InvalidContentError("INVALID_STATUS");
  return value as ContentStatus;
}

function normalizeMetadata(value: JsonValue | undefined) {
  return serializeJson(value ?? {});
}

function normalizeExpiresAt(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !value.trim()) throw new InvalidContentError("INVALID_EXPIRES_AT");
  const raw = value.trim();
  const parsed = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw) ? Date.parse(raw) : parseStoredTimestamp(raw);
  if (!Number.isFinite(parsed)) throw new InvalidContentError("INVALID_EXPIRES_AT");
  return new Date(parsed).toISOString().slice(0, 19).replace("T", " ");
}

/** SQLite datetime('now') values are UTC but intentionally omit the suffix. */
function parseStoredTimestamp(value: string) {
  const normalized = value.trim();
  const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  return Date.parse(hasTimezone ? normalized : `${normalized.replace(" ", "T")}Z`);
}

function serializeJson(value: unknown): string {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new InvalidContentError("INVALID_JSON");
  }
  if (!serialized || serialized === "undefined") throw new InvalidContentError("INVALID_JSON");
  try {
    JSON.parse(serialized);
  } catch {
    throw new InvalidContentError("INVALID_JSON");
  }
  return serialized;
}

function parseJson(value: string): JsonValue {
  try {
    return JSON.parse(value) as JsonValue;
  } catch {
    return {};
  }
}

function mapEntry(row: EntryRow): ContentEntryDTO {
  if (!STATUS_SET.has(row.status)) throw new Error(`invalid status in content_entries: ${row.status}`);
  return {
    id: row.id,
    type: row.content_type,
    slug: row.slug,
    locale: row.locale,
    status: row.status as ContentStatus,
    revision: Number(row.revision),
    ownerId: row.owner_id,
    reviewerId: row.reviewer_id,
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Return whether a published entry is currently available to readers. */
export function isContentPubliclyAvailable(entry: Pick<ContentEntryDTO, "status" | "publishedAt" | "expiresAt">) {
  if (entry.status !== "published") return false;
  const now = Date.now();
  if (entry.publishedAt) {
    const publishedAt = parseStoredTimestamp(entry.publishedAt);
    if (!Number.isFinite(publishedAt) || publishedAt > now) return false;
  }
  if (entry.expiresAt) {
    const expiresAt = parseStoredTimestamp(entry.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
  }
  return true;
}

/** Remove editorial ownership/history fields before returning content publicly. */
export function toPublicContentSummary(entry: ContentEntryDTO): ContentEntryDTO {
  return { ...entry, ownerId: null, reviewerId: null };
}

export function toPublicContentEntry(detail: ContentEntryDetail): ContentEntryDetail {
  const publishedRevisions = detail.revisions.filter((revision) => isContentPubliclyAvailable(revision));
  const publishedRevision = publishedRevisions[0] ?? null;
  const latestRevision = publishedRevision
    ? {
        ...publishedRevision,
        ownerId: null,
        reviewerId: null,
      }
    : null;
  return {
    ...detail,
    ownerId: null,
    reviewerId: null,
    latestRevision,
    revisions: latestRevision ? [latestRevision] : [],
    references: [],
    audits: [],
  };
}

function mapRevision(row: RevisionRow): ContentRevisionDTO {
  if (!STATUS_SET.has(row.status)) throw new Error(`invalid status in content_revisions: ${row.status}`);
  return {
    id: row.id,
    entryId: row.entry_id,
    revision: Number(row.revision),
    locale: row.locale,
    payload: parseJson(row.payload),
    status: row.status as ContentStatus,
    ownerId: row.owner_id,
    reviewerId: row.reviewer_id,
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

function mapReference(row: ReferenceRow): ContentReferenceDTO {
  return {
    id: row.id,
    fromEntryId: row.from_entry_id,
    toEntryId: row.to_entry_id,
    referenceType: row.reference_type,
    metadata: parseJson(row.metadata),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapAudit(row: AuditRow): AuditEventDTO {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    actorId: row.actor_id,
    fromStatus: row.from_status && STATUS_SET.has(row.from_status) ? (row.from_status as ContentStatus) : null,
    toStatus: row.to_status && STATUS_SET.has(row.to_status) ? (row.to_status as ContentStatus) : null,
    revision: row.revision === null ? null : Number(row.revision),
    metadata: parseJson(row.metadata),
    createdAt: row.created_at,
  };
}

function encodeCursor(value: { updatedAt?: string; createdAt?: string; id: string }) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeCursor(value: string | undefined): { updatedAt?: string; createdAt?: string; id?: string } | undefined {
  if (!value || value.length > 512) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function clampLimit(limit: number | undefined, fallback = 24) {
  if (!Number.isFinite(limit)) return fallback;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(limit as number)));
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function getEntryRow(id: string) {
  return db().prepare(`SELECT ${ENTRY_COLUMNS} FROM content_entries WHERE id = ?`).get(id) as EntryRow | undefined;
}

function buildDetail(entry: EntryRow): ContentEntryDetail {
  const database = db();
  const revisionRows = database
    .prepare(`SELECT ${REVISION_COLUMNS} FROM content_revisions WHERE entry_id = ? ORDER BY revision DESC`)
    .all(entry.id) as RevisionRow[];
  const references = database
    .prepare(`SELECT ${REFERENCE_COLUMNS} FROM content_references WHERE from_entry_id = ? ORDER BY created_at DESC, id DESC`)
    .all(entry.id) as ReferenceRow[];
  const audits = database
    .prepare(`SELECT ${AUDIT_COLUMNS} FROM audit_events WHERE entity_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`)
    .all(entry.id) as AuditRow[];
  return {
    ...mapEntry(entry),
    latestRevision: revisionRows[0] ? mapRevision(revisionRows[0]) : null,
    revisions: revisionRows.map(mapRevision),
    references: references.map(mapReference),
    audits: audits.map(mapAudit),
  };
}

function insertAudit(database: ReturnType<typeof getDb>, input: AuditEventInput) {
  const entityType = normalizeType(input.entityType);
  const entityId = requireText(input.entityId, "entity_id");
  const action = requireText(input.action, "action", /^[a-z][a-z0-9._-]{0,79}$/);
  const metadata = normalizeMetadata(input.metadata);
  const fromStatus = input.fromStatus == null ? null : normalizeStatus(input.fromStatus);
  const toStatus = input.toStatus == null ? null : normalizeStatus(input.toStatus);
  const revision = input.revision == null ? null : input.revision;
  const actor = normalizeOptionalId(input.actorId, "actor_id");
  if (revision !== null && (!Number.isSafeInteger(revision) || revision < 0)) {
    throw new InvalidContentError("INVALID_REVISION");
  }
  const id = randomUUID();
  database
    .prepare(
      `INSERT INTO audit_events
       (id, entity_type, entity_id, action, actor_id, from_status, to_status, revision, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, entityType, entityId, action, actor, fromStatus, toStatus, revision, metadata);
  return id;
}

export function writeAuditEvent(input: AuditEventInput, actor?: ContentActor): AuditEventDTO {
  const database = db();
  const eventInput = { ...input, actorId: normalizeOptionalId(input.actorId ?? actorId(actor), "actor_id") };
  const id = insertAudit(database, eventInput);
  return mapAudit(database.prepare(`SELECT ${AUDIT_COLUMNS} FROM audit_events WHERE id = ?`).get(id) as AuditRow);
}

/** List content entries with stable cursor pagination for admin/catalogue views. */
export function listContentEntries(options: ContentListOptions = {}): ContentEntryPage {
  const database = db();
  const where: string[] = [];
  const args: Array<string | number> = [];
  const type = options.type ?? options.contentType;
  if (type) {
    where.push("content_type = ?");
    args.push(normalizeType(type));
  }
  if (options.locale) {
    where.push("locale = ?");
    args.push(normalizeLocale(options.locale));
  }
  if (options.status) {
    const statuses = Array.isArray(options.status) ? options.status : [options.status];
    if (statuses.length === 0) return { items: [], nextCursor: null };
    const normalized = statuses.map(normalizeStatus);
    where.push(`status IN (${normalized.map(() => "?").join(",")})`);
    args.push(...normalized);
  }
  if (options.publicOnly) {
    where.push("status = 'published' AND (published_at IS NULL OR published_at <= datetime('now')) AND (expires_at IS NULL OR expires_at > datetime('now'))");
    where.push(
      "EXISTS (SELECT 1 FROM content_revisions r WHERE r.entry_id = content_entries.id AND r.revision = content_entries.revision AND r.status = 'published' AND (r.published_at IS NULL OR r.published_at <= datetime('now')) AND (r.expires_at IS NULL OR r.expires_at > datetime('now')))",
    );
  }
  const query = options.query?.trim().slice(0, 160);
  if (query) {
    const pattern = `%${escapeLike(query)}%`;
    where.push("(slug LIKE ? ESCAPE '\\' OR content_type LIKE ? ESCAPE '\\')");
    args.push(pattern, pattern);
  }
  const cursor = decodeCursor(options.cursor);
  if (cursor?.updatedAt && cursor.id) {
    where.push("(updated_at < ? OR (updated_at = ? AND id > ?))");
    args.push(cursor.updatedAt, cursor.updatedAt, cursor.id);
  }
  const limit = clampLimit(options.limit);
  const rows = database
    .prepare(
      `SELECT ${ENTRY_COLUMNS} FROM content_entries
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY updated_at DESC, id ASC LIMIT ?`
    )
    .all(...args, limit + 1) as EntryRow[];
  const items = rows.slice(0, limit).map(mapEntry);
  const last = items.at(-1);
  return {
    items,
    nextCursor: rows.length > limit && last ? encodeCursor({ updatedAt: last.updatedAt, id: last.id }) : null,
  };
}

/** Resolve by stable id, or by slug when a locale is supplied. */
export function getContentEntry(idOrSlug: string, locale?: string): ContentEntryDetail | undefined {
  const value = requireText(idOrSlug, "id_or_slug");
  let row = getEntryRow(value);
  if (!row) {
    const database = db();
    row = (locale
      ? database
          .prepare(`SELECT ${ENTRY_COLUMNS} FROM content_entries WHERE slug = ? AND locale = ? LIMIT 1`)
          .get(normalizeSlug(value), normalizeLocale(locale))
      : database
          .prepare(
            `SELECT ${ENTRY_COLUMNS} FROM content_entries WHERE slug = ?
             ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'review' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
                      updated_at DESC LIMIT 1`
          )
          .get(normalizeSlug(value))) as EntryRow | undefined;
  }
  return row ? buildDetail(row) : undefined;
}

export function getContentRevision(entryId: string, revision?: number): ContentRevisionDTO | undefined {
  const id = requireText(entryId, "entry_id");
  const database = db();
  const row = (revision === undefined
    ? database
        .prepare(`SELECT ${REVISION_COLUMNS} FROM content_revisions WHERE entry_id = ? ORDER BY revision DESC LIMIT 1`)
        .get(id)
    : database
        .prepare(`SELECT ${REVISION_COLUMNS} FROM content_revisions WHERE entry_id = ? AND revision = ?`)
        .get(id, revision)) as RevisionRow | undefined;
  return row ? mapRevision(row) : undefined;
}

export function listContentRevisions(entryId: string): ContentRevisionDTO[] {
  const id = requireText(entryId, "entry_id");
  const database = db();
  return (database
    .prepare(`SELECT ${REVISION_COLUMNS} FROM content_revisions WHERE entry_id = ? ORDER BY revision DESC`)
    .all(id) as RevisionRow[]).map(mapRevision);
}

function resolveDraftInput(input: CreateContentDraftInput) {
  const type = normalizeType(input.type ?? input.contentType);
  const slug = normalizeSlug(input.slug);
  const locale = normalizeLocale(input.locale);
  const expiresAt = normalizeExpiresAt(input.expiresAt);
  return { type, slug, locale, expiresAt };
}

function insertRevision(
  database: ReturnType<typeof getDb>,
  entry: EntryRow,
  payload: JsonValue,
  actor: ContentActor,
  expiresAt: string | null,
  revision: number,
  ownerOverride?: string | null,
  reviewerOverride?: string | null
) {
  const ownerId = ownerOverride === undefined ? actorId(actor) : ownerOverride;
  const reviewerId = reviewerOverride === undefined ? null : reviewerOverride;
  const id = randomUUID();
  const serialized = serializeJson(payload);
  database
    .prepare(
      `INSERT INTO content_revisions
       (id, entry_id, revision, locale, payload, status, owner_id, reviewer_id, expires_at)
       VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?)`
    )
    .run(id, entry.id, revision, entry.locale, serialized, ownerId, reviewerId, expiresAt);
  return database.prepare(`SELECT ${REVISION_COLUMNS} FROM content_revisions WHERE id = ?`).get(id) as RevisionRow;
}

/** Create a new draft entry. An optional payload creates revision 1 atomically. */
export function createContentDraft(input: CreateContentDraftInput, actor?: ContentActor): ContentEntryDTO {
  const database = db();
  const { type, slug, locale, expiresAt } = resolveDraftInput(input);
  const ownerId = normalizeOptionalId(input.ownerId === undefined ? actorId(actor) : input.ownerId, "owner_id");
  const reviewerId = normalizeOptionalId(input.reviewerId, "reviewer_id");
  const id = input.id ? requireText(input.id, "id") : randomUUID();
  const existing = database
    .prepare("SELECT id FROM content_entries WHERE content_type = ? AND slug = ? AND locale = ?")
    .get(type, slug, locale);
  if (existing) throw new ContentConflictError("CONTENT_EXISTS");

  const tx = database.transaction(() => {
    database
      .prepare(
        `INSERT INTO content_entries
         (id, content_type, slug, locale, status, revision, owner_id, reviewer_id, expires_at)
         VALUES (?, ?, ?, ?, 'draft', 0, ?, ?, ?)`
      )
      .run(id, type, slug, locale, ownerId, reviewerId, expiresAt);
    const entry = getEntryRow(id);
    if (!entry) throw new Error("content draft could not be read back");
    if (input.payload !== undefined) {
      insertRevision(database, entry, input.payload, actor, expiresAt, 1, ownerId, reviewerId);
      database
        .prepare("UPDATE content_entries SET revision = 1, updated_at = datetime('now') WHERE id = ?")
        .run(id);
    }
    insertAudit(database, {
      entityType: type,
      entityId: id,
      action: "content.created",
      actorId: ownerId,
      revision: input.payload === undefined ? 0 : 1,
      toStatus: "draft",
    });
  });
  try {
    tx();
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new ContentConflictError("CONTENT_EXISTS");
    throw error;
  }
  const result = getEntryRow(id);
  if (!result) throw new Error("content draft could not be created");
  return mapEntry(result);
}

/** Add a new immutable revision and reset the entry to draft for review. */
export function updateContentDraft(
  id: string,
  input: UpdateContentDraftInput,
  actor?: ContentActor
): ContentEntryDetail {
  const entryId = requireText(id, "id");
  const database = db();
  const current = getEntryRow(entryId);
  if (!current) throw new ContentNotFoundError();
  if (current.status === "archived") throw new ContentConflictError("ARCHIVED_CONTENT");
  if (input.expectedRevision !== undefined && input.expectedRevision !== current.revision) {
    throw new ContentConflictError("REVISION_CONFLICT");
  }
  const locale = input.locale ? normalizeLocale(input.locale) : current.locale;
  if (locale !== current.locale) throw new InvalidContentError("LOCALE_IMMUTABLE");
  const expiresAt = input.expiresAt === undefined ? current.expires_at : normalizeExpiresAt(input.expiresAt);
  const nextRevision = Math.max(
    current.revision,
    Number(
      (database.prepare("SELECT COALESCE(MAX(revision), 0) AS revision FROM content_revisions WHERE entry_id = ?").get(entryId) as { revision: number })
        .revision
    )
  ) + 1;
  const ownerId = normalizeOptionalId(
    input.ownerId === undefined ? actorId(actor) || current.owner_id : input.ownerId,
    "owner_id"
  );
  const reviewerId = normalizeOptionalId(input.reviewerId, "reviewer_id");

  const tx = database.transaction(() => {
    insertRevision(database, current, input.payload, actor, expiresAt, nextRevision, ownerId, reviewerId);
    const updateResult = database
      .prepare(
        `UPDATE content_entries
         SET status = 'draft', revision = ?, owner_id = ?, reviewer_id = NULL,
             published_at = NULL, expires_at = ?, updated_at = datetime('now')
         WHERE id = ? AND revision = ?`
      )
      .run(nextRevision, ownerId, expiresAt, entryId, current.revision);
    if (updateResult.changes !== 1) {
      throw new ContentConflictError("REVISION_CONFLICT");
    }
    insertAudit(database, {
      entityType: current.content_type,
      entityId: entryId,
      action: "content.revision_created",
      actorId: actorId(actor),
      revision: nextRevision,
      fromStatus: current.status as ContentStatus,
      toStatus: "draft",
    });
  });
  try {
    tx();
  } catch (error) {
    if (error instanceof ContentConflictError) throw error;
    if (isUniqueConstraintError(error)) throw new ContentConflictError("REVISION_CONFLICT");
    throw error;
  }
  const result = getEntryRow(entryId);
  if (!result) throw new Error("content draft update could not be read back");
  return buildDetail(result);
}

/** Generic revision alias for callers that do not use the draft terminology. */
export const updateContentRevision = updateContentDraft;

const ALLOWED_TRANSITIONS: Record<ContentStatus, readonly ContentStatus[]> = {
  draft: ["draft", "review", "archived"],
  review: ["review", "draft", "published", "archived"],
  published: ["published", "draft", "archived"],
  archived: ["archived", "draft"],
};

/** Move an entry through the editorial state machine and append an audit event. */
export function transitionContent(id: string, status: ContentStatus, actor?: ContentActor): ContentEntryDetail {
  const entryId = requireText(id, "id");
  const target = normalizeStatus(status);
  const database = db();
  const current = getEntryRow(entryId);
  if (!current) throw new ContentNotFoundError();
  if (!ALLOWED_TRANSITIONS[current.status as ContentStatus].includes(target)) {
    throw new ContentConflictError(`INVALID_TRANSITION_${current.status.toUpperCase()}_${target.toUpperCase()}`);
  }
  if (target === "published" && current.revision < 1) {
    throw new ContentConflictError("CONTENT_HAS_NO_REVISION");
  }
  if (target === "published" && current.expires_at) {
    const expiresAt = parseStoredTimestamp(current.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      throw new ContentConflictError("CONTENT_EXPIRED");
    }
  }
  const reviewerId = actorId(actor);
  const publishedValue =
    target === "published"
      ? "datetime('now')"
      : target === "archived" && current.published_at !== null
        ? "published_at"
        : "NULL";
  const tx = database.transaction(() => {
    const updateResult = database
      .prepare(
        `UPDATE content_entries
         SET status = ?, reviewer_id = CASE WHEN ? = 'published' THEN ? WHEN ? = 'draft' THEN NULL ELSE reviewer_id END,
             published_at = ${publishedValue}, updated_at = datetime('now')
         WHERE id = ? AND status = ?`
      )
      .run(target, target, reviewerId, target, entryId, current.status);
    if (updateResult.changes !== 1) {
      throw new ContentConflictError("STATUS_CONFLICT");
    }
    if (current.revision > 0) {
      database
        .prepare(
          `UPDATE content_revisions
           SET status = ?, reviewer_id = CASE WHEN ? = 'published' THEN ? WHEN ? = 'draft' THEN NULL ELSE reviewer_id END,
               published_at = CASE WHEN ? = 'published' THEN datetime('now') ELSE published_at END
           WHERE entry_id = ? AND revision = ?`
        )
        .run(target, target, reviewerId, target, target, entryId, current.revision);
    }
    insertAudit(database, {
      entityType: current.content_type,
      entityId: entryId,
      action: target === current.status ? "content.status_unchanged" : "content.status_changed",
      actorId: reviewerId,
      fromStatus: current.status as ContentStatus,
      toStatus: target,
      revision: current.revision,
    });
  });
  tx();
  const result = getEntryRow(entryId);
  if (!result) throw new Error("content transition could not be read back");
  return buildDetail(result);
}

export function createContentReference(input: ContentReferenceInput, actor?: ContentActor): ContentReferenceDTO {
  const fromEntryId = requireText(input.fromEntryId, "from_entry_id");
  const toEntryId = requireText(input.toEntryId, "to_entry_id");
  if (fromEntryId === toEntryId) throw new InvalidContentError("SELF_REFERENCE");
  const referenceType = requireText(input.referenceType ?? "related", "reference_type", TYPE_PATTERN);
  const metadata = normalizeMetadata(input.metadata);
  const database = db();
  const from = getEntryRow(fromEntryId);
  const to = getEntryRow(toEntryId);
  if (!from || !to) throw new ContentNotFoundError("REFERENCE_TARGET_NOT_FOUND");
  const id = randomUUID();
  const createdBy = actorId(actor);
  const tx = database.transaction(() => {
    try {
      database
        .prepare(
          `INSERT INTO content_references
           (id, from_entry_id, to_entry_id, reference_type, metadata, created_by)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(id, fromEntryId, toEntryId, referenceType, metadata, createdBy);
    } catch (error) {
      if (String(error).toLowerCase().includes("unique")) throw new ContentConflictError("REFERENCE_EXISTS");
      throw error;
    }
    insertAudit(database, {
      entityType: "content_reference",
      entityId: id,
      action: "content.reference_created",
      actorId: createdBy,
      metadata: { fromEntryId, toEntryId, referenceType },
    });
  });
  tx();
  return mapReference(database.prepare(`SELECT ${REFERENCE_COLUMNS} FROM content_references WHERE id = ?`).get(id) as ReferenceRow);
}

export const addContentReference = createContentReference;

export function listContentReferences(entryId: string, direction: "from" | "to" | "both" = "from") {
  const id = requireText(entryId, "entry_id");
  const database = db();
  const where = direction === "to" ? "to_entry_id = ?" : direction === "both" ? "(from_entry_id = ? OR to_entry_id = ?)" : "from_entry_id = ?";
  const args = direction === "both" ? [id, id] : [id];
  return (database.prepare(`SELECT ${REFERENCE_COLUMNS} FROM content_references WHERE ${where} ORDER BY created_at DESC, id DESC`).all(...args) as ReferenceRow[]).map(mapReference);
}

export function listAuditEvents(options: AuditListOptions = {}): AuditEventPage {
  const database = db();
  const where: string[] = [];
  const args: Array<string | number> = [];
  if (options.entityType) {
    where.push("entity_type = ?");
    args.push(normalizeType(options.entityType));
  }
  if (options.entityId) {
    where.push("entity_id = ?");
    args.push(requireText(options.entityId, "entity_id"));
  }
  if (options.actorId) {
    where.push("actor_id = ?");
    args.push(requireText(options.actorId, "actor_id"));
  }
  if (options.action) {
    where.push("action = ?");
    args.push(requireText(options.action, "action", /^[a-z][a-z0-9._-]{0,79}$/));
  }
  const cursor = decodeCursor(options.cursor);
  if (cursor?.createdAt && cursor.id) {
    where.push("(created_at < ? OR (created_at = ? AND id < ?))");
    args.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }
  const limit = clampLimit(options.limit);
  const rows = database
    .prepare(
      `SELECT ${AUDIT_COLUMNS} FROM audit_events
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY created_at DESC, id DESC LIMIT ?`
    )
    .all(...args, limit + 1) as AuditRow[];
  const items = rows.slice(0, limit).map(mapAudit);
  const last = rows[limit - 1];
  return {
    items,
    nextCursor: rows.length > limit && last ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null,
  };
}

export const listAudit = listAuditEvents;
