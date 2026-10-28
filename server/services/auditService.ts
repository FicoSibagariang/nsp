import type { Db } from '../db';
import type { AuditLogRow, AuditActionCount } from '../db/entities';

export type AuditLogFilters = {
  actor?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
};

export async function getAuditLogsList(
  database: Db,
  filters: AuditLogFilters
): Promise<AuditLogRow[]> {
  const { actor, action, entity, entityId, from, to, limit, offset } = filters;

  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];

  if (actor) {
    conditions.push('actor = ?');
    params.push(actor);
  }
  if (action) {
    conditions.push('action = ?');
    params.push(action);
  }
  if (entity) {
    conditions.push('entity = ?');
    params.push(entity);
  }
  if (entityId) {
    conditions.push('entity_id = ?');
    params.push(entityId);
  }
  if (from) {
    conditions.push('created_at >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('created_at <= ?');
    params.push(to);
  }

  const whereClause = conditions.join(' AND ');

  const rows = await database
    .query(
      `SELECT * FROM audit_logs WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all<AuditLogRow>(...params, limit, offset);

  for (const row of rows) {
    if (row.before) {
      try {
        row.before = typeof row.before === 'string' ? JSON.parse(row.before) : row.before;
      } catch {
        row.before = {};
      }
    }
    if (row.after) {
      try {
        row.after = typeof row.after === 'string' ? JSON.parse(row.after) : row.after;
      } catch {
        row.after = {};
      }
    }
  }

  return rows;
}

export async function getAuditStats(database: Db): Promise<AuditActionCount[]> {
  return database
    .query(
      `SELECT action, COUNT(*) as count FROM audit_logs GROUP BY action ORDER BY count DESC`
    )
    .all<AuditActionCount>();
}
