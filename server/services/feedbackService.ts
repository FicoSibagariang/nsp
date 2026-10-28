import type { Db } from '../db';
import type { UserFeedbackRow } from '../db/entities';
import { ServiceError } from './errors';

export type CreateFeedbackInput = {
  id: string;
  type: string;
  title: string | null;
  description: string;
  screenshotUrl: string | null;
  pageUrl: string | null;
  userAgent: string | null;
  screenResolution: string | null;
  effectiveUserId: string | null;
  effectiveUserName: string;
  effectiveUserEmail: string | null;
  effectiveUserRole: string;
};

export async function createUserFeedback(
  database: Db,
  data: CreateFeedbackInput
): Promise<void> {
  await database.prepare(`
    INSERT INTO user_feedbacks (
      id, type, title, description, screenshot_url, page_url, user_agent,
      screen_resolution, user_id, user_name, user_email, user_role, status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', NOW(), NOW())
  `).run(
    data.id,
    data.type,
    data.title,
    data.description,
    data.screenshotUrl,
    data.pageUrl,
    data.userAgent,
    data.screenResolution,
    data.effectiveUserId,
    data.effectiveUserName,
    data.effectiveUserEmail,
    data.effectiveUserRole
  );
}

export type FeedbackFilterOptions = {
  type?: string;
  status?: string;
  search?: string;
  limit: number;
  offset: number;
};

export async function listUserFeedbacks(
  database: Db,
  options: FeedbackFilterOptions
): Promise<{ feedbacks: UserFeedbackRow[]; total: number }> {
  const { type, status, search, limit, offset } = options;
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];

  if (type && type !== 'all') {
    conditions.push('type = ?');
    params.push(type);
  }

  if (status && status !== 'all') {
    conditions.push('status = ?');
    params.push(status);
  }

  if (search && search.trim()) {
    conditions.push('(title ILIKE ? OR description ILIKE ? OR user_name ILIKE ? OR user_email ILIKE ?)');
    const pattern = `%${search.trim()}%`;
    params.push(pattern, pattern, pattern, pattern);
  }

  const whereClause = conditions.join(' AND ');

  const countRow = await database.query(
    `SELECT COUNT(*) as count FROM user_feedbacks WHERE ${whereClause}`
  ).get<{ count: number }>(...params);
  const total = countRow?.count ? Number(countRow.count) : 0;

  const rows = await database.query(
    `SELECT * FROM user_feedbacks WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all<UserFeedbackRow>(...params, limit, offset);

  return { feedbacks: rows, total };
}

export async function getUserFeedbacksStats(database: Db): Promise<{
  statusCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  total: number;
}> {
  const statusRows = await database.query(`
    SELECT status, COUNT(*) as count FROM user_feedbacks GROUP BY status
  `).all<{ status: string; count: number }>();

  const typeRows = await database.query(`
    SELECT type, COUNT(*) as count FROM user_feedbacks GROUP BY type
  `).all<{ type: string; count: number }>();

  const statusCounts = {
    open: 0,
    in_review: 0,
    resolved: 0,
    closed: 0,
  };
  for (const r of statusRows) {
    if (r.status in statusCounts) {
      statusCounts[r.status as keyof typeof statusCounts] = Number(r.count);
    }
  }

  const typeCounts = {
    bug: 0,
    feature: 0,
    general: 0,
  };
  for (const r of typeRows) {
    if (r.type in typeCounts) {
      typeCounts[r.type as keyof typeof typeCounts] = Number(r.count);
    }
  }

  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  return { statusCounts, typeCounts, total };
}

export async function updateUserFeedbackStatus(
  database: Db,
  id: string,
  status: string,
  adminNotes?: string | null
): Promise<void> {
  const existing = await database.query('SELECT id FROM user_feedbacks WHERE id = ?').get<{ id: string }>(id);
  if (!existing) {
    throw new ServiceError('Laporan masukan tidak ditemukan', 404);
  }

  await database.prepare(`
    UPDATE user_feedbacks
    SET status = ?, admin_notes = ?, updated_at = NOW()
    WHERE id = ?
  `).run(status, adminNotes ?? null, id);
}

export async function deleteUserFeedback(
  database: Db,
  id: string
): Promise<{ screenshot_url: string | null }> {
  const existing = await database.query(
    'SELECT id, screenshot_url FROM user_feedbacks WHERE id = ?'
  ).get<{ id: string; screenshot_url: string | null }>(id);

  if (!existing) {
    throw new ServiceError('Laporan masukan tidak ditemukan', 404);
  }

  await database.prepare('DELETE FROM user_feedbacks WHERE id = ?').run(id);
  return { screenshot_url: existing.screenshot_url };
}
