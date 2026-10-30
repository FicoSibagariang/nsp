import { Hono } from 'hono';
import { verify } from 'hono/jwt';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import db from '../db';
import { secretKey } from '../middleware';
import { createFeedbackSchema, updateFeedbackStatusSchema } from '../schemas';
import {
  createUserFeedback,
  listUserFeedbacks,
  getUserFeedbacksStats,
  updateUserFeedbackStatus,
  deleteUserFeedback,
} from '../services/feedbackService';

const feedbacks = new Hono();

const FEEDBACKS_DIR = join(process.cwd(), 'uploads', 'feedbacks');
if (!existsSync(FEEDBACKS_DIR)) {
  mkdirSync(FEEDBACKS_DIR, { recursive: true });
}

const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024; // 5 MB

/** Helper to extract user identity from Bearer token if present */
async function extractUserFromToken(authHeader?: string) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = await verify(token, secretKey, 'HS256') as Record<string, unknown>;
    return {
      userId: (payload.sub || payload.id || payload.memberId || '') as string,
      userName: (payload.name || '') as string,
      userEmail: (payload.email || '') as string,
      userRole: (payload.role || 'member') as string,
    };
  } catch {
    return null;
  }
}

/** Helper middleware to require admin role for protected feedback routes */
async function requireAdminAuth(c: any, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization');
  const user = await extractUserFromToken(authHeader);
  if (!user || (user.userRole !== 'admin' && user.userRole !== 'superadmin')) {
    return c.json({ success: false, message: 'Forbidden: admin access required' }, 403);
  }
  c.set('user', user);
  await next();
}

/**
 * POST /api/v1/feedbacks
 * Submit new feedback / bug report / feature request with optional screenshot.
 * Open to authenticated members/admins, and gracefully accepts unauthenticated input.
 */
feedbacks.post('/', async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = createFeedbackSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({
        success: false,
        message: 'Validasi form feedback gagal',
        errors: parsed.error.issues,
      }, 400);
    }

    const authHeader = c.req.header('Authorization');
    const tokenUser = await extractUserFromToken(authHeader);

    const {
      type,
      title,
      description,
      screenshot,
      pageUrl,
      userAgent,
      screenResolution,
      userName,
      userEmail,
    } = parsed.data;

    let screenshotUrl: string | null = null;

    if (screenshot) {
      const match = screenshot.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
      if (match) {
        let ext = match[1];
        if (ext === 'jpeg') ext = 'jpg';
        const base64Content = match[2];
        const buffer = Buffer.from(base64Content, 'base64');

        if (buffer.length > MAX_SCREENSHOT_SIZE) {
          return c.json({
            success: false,
            message: 'Ukuran screenshot melebihi batas 5 MB',
          }, 400);
        }

        const fileName = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
        const filePath = join(FEEDBACKS_DIR, fileName);
        await Bun.write(filePath, buffer);
        screenshotUrl = `/uploads/feedbacks/${fileName}`;
      }
    }

    const id = `fb_${crypto.randomUUID()}`;
    const effectiveUserId = tokenUser?.userId || null;
    const effectiveUserName = tokenUser?.userName || userName || 'Pengguna';
    const effectiveUserEmail = tokenUser?.userEmail || userEmail || null;
    const effectiveUserRole = tokenUser?.userRole || (tokenUser ? 'member' : 'guest');

    await createUserFeedback(db, {
      id,
      type,
      title: title || null,
      description,
      screenshotUrl,
      pageUrl: pageUrl || null,
      userAgent: userAgent || null,
      screenResolution: screenResolution || null,
      effectiveUserId,
      effectiveUserName,
      effectiveUserEmail,
      effectiveUserRole,
    });

    return c.json({
      success: true,
      data: {
        id,
        type,
        title: title || null,
        description,
        screenshotUrl,
        pageUrl: pageUrl || null,
        status: 'open',
        userName: effectiveUserName,
        userRole: effectiveUserRole,
        createdAt: new Date().toISOString(),
      },
    }, 201);
  } catch (err) {
    console.error('Error submitting feedback:', err);
    return c.json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal mengirim masukan',
    }, 500);
  }
});

/**
 * GET /api/v1/feedbacks
 * List feedback reports with filters (type, status, search) and pagination.
 * Requires admin access.
 */
feedbacks.get('/', requireAdminAuth, async (c) => {
  try {
    const type = c.req.query('type');
    const status = c.req.query('status');
    const search = c.req.query('search');
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50', 10), 1), 200);
    const offset = Math.max(parseInt(c.req.query('offset') || '0', 10), 0);

    const { feedbacks: rows, total } = await listUserFeedbacks(db, {
      type,
      status,
      search,
      limit,
      offset,
    });

    return c.json({
      success: true,
      data: {
        feedbacks: rows,
        total,
        limit,
        offset,
      },
    });
  } catch (err) {
    console.error('Error listing feedbacks:', err);
    return c.json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal memuat daftar masukan',
    }, 500);
  }
});

/**
 * GET /api/v1/feedbacks/stats
 * Aggregate counts of feedback items by type and status.
 * Requires admin access.
 */
feedbacks.get('/stats', requireAdminAuth, async (c) => {
  try {
    const data = await getUserFeedbacksStats(db);

    return c.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('Error getting feedback stats:', err);
    return c.json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal memuat statistik masukan',
    }, 500);
  }
});

/**
 * PUT /api/v1/feedbacks/:id/status
 * Update status and admin notes for a feedback entry.
 * Requires admin access.
 */
feedbacks.put('/:id/status', requireAdminAuth, async (c) => {
  try {
    const id = c.req.param('id');
    const raw = await c.req.json();
    const parsed = updateFeedbackStatusSchema.safeParse(raw);

    if (!parsed.success) {
      return c.json({
        success: false,
        message: 'Validasi status gagal',
        errors: parsed.error.issues,
      }, 400);
    }

    await updateUserFeedbackStatus(db, id, parsed.data.status, parsed.data.adminNotes);

    return c.json({
      success: true,
      message: 'Status masukan berhasil diperbarui',
    });
  } catch (err: any) {
    if (err.statusCode === 404) {
      return c.json({ success: false, message: err.message }, 404);
    }
    console.error('Error updating feedback status:', err);
    return c.json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal memperbarui status masukan',
    }, 500);
  }
});

/**
 * DELETE /api/v1/feedbacks/:id
 * Delete a feedback entry and cleanup stored screenshot file if any.
 * Requires admin access.
 */
feedbacks.delete('/:id', requireAdminAuth, async (c) => {
  try {
    const id = c.req.param('id');
    const { screenshot_url } = await deleteUserFeedback(db, id);

    if (screenshot_url && screenshot_url.startsWith('/uploads/feedbacks/')) {
      const fileName = screenshot_url.replace('/uploads/feedbacks/', '');
      const filePath = join(FEEDBACKS_DIR, fileName);
      if (existsSync(filePath)) {
        try {
          unlinkSync(filePath);
        } catch (e) {
          console.warn('Failed to delete screenshot file:', e);
        }
      }
    }

    return c.json({
      success: true,
      message: 'Masukan berhasil dihapus',
    });
  } catch (err: any) {
    if (err.statusCode === 404) {
      return c.json({ success: false, message: err.message }, 404);
    }
    console.error('Error deleting feedback:', err);
    return c.json({
      success: false,
      message: err instanceof Error ? err.message : 'Gagal menghapus masukan',
    }, 500);
  }
});

export default feedbacks;
