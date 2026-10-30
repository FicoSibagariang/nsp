import { Hono } from 'hono';
import { verify, decode } from 'hono/jwt';
import { existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import db from '../db';
import { secretKey } from '../middleware';

const protectedFiles = new Hono();

const LOANS_DIR = join(process.cwd(), 'uploads', 'loans');
const SAVINGS_DIR = join(process.cwd(), 'uploads', 'savings');

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
};

interface AuthContextResult {
  authenticated: boolean;
  user?: {
    sub: string;
    role: string;
    email?: string;
  };
  errorStatus?: number;
  errorMessage?: string;
}

/**
 * Extracts and verifies authentication token from Authorization header or ?token= query parameter.
 * Also verifies token is not in the blacklist.
 */
async function authenticateFileRequest(c: any): Promise<AuthContextResult> {
  const authHeader = c.req.header('Authorization');
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else {
    token = c.req.query('token');
  }

  if (!token) {
    return {
      authenticated: false,
      errorStatus: 401,
      errorMessage: 'Autentikasi diperlukan untuk mengakses dokumen finansial',
    };
  }

  try {
    const decoded = decode(token);
    const jti = decoded?.payload?.jti as string | undefined;

    if (jti) {
      const blacklisted = await db
        .query('SELECT 1 FROM token_blacklist WHERE jti_token = ?')
        .get(jti);
      if (blacklisted) {
        return {
          authenticated: false,
          errorStatus: 401,
          errorMessage: 'Token akses telah dibatalkan',
        };
      }
    }

    const payload = (await verify(token, secretKey, 'HS256')) as Record<string, unknown>;
    const sub = (payload.sub || payload.id || payload.memberId || '') as string;
    const role = (payload.role || 'member') as string;

    return {
      authenticated: true,
      user: {
        sub,
        role,
        email: payload.email as string | undefined,
      },
    };
  } catch {
    return {
      authenticated: false,
      errorStatus: 401,
      errorMessage: 'Token autentikasi tidak valid atau telah kadaluarsa',
    };
  }
}

/**
 * Serves a loan document after authentication and IDOR ownership check.
 */
protectedFiles.get('/loans/:filename', async (c) => {
  const rawFilename = c.req.param('filename');
  const safeName = basename(rawFilename);

  const auth = await authenticateFileRequest(c);
  if (!auth.authenticated || !auth.user) {
    return c.json({ success: false, message: auth.errorMessage || 'Unauthorized' }, auth.errorStatus || 401 as any);
  }

  const { sub, role } = auth.user;

  // Admins and superadmins can view all documents
  if (role !== 'admin' && role !== 'superadmin') {
    // Member access: verify IDOR
    let isOwner = false;

    // Check if filename contains the ownerId directly (format: timestamp_ownerId_uuid_name)
    const parts = safeName.split('_');
    if (parts.length >= 4 && parts[1] === sub) {
      isOwner = true;
    } else {
      // Look up loan record in database
      const matchedLoan = await db
        .query('SELECT memberId FROM loans WHERE "attachmentUrl" LIKE ? LIMIT 1')
        .get<{ memberId: string }>(`%${safeName}%`);

      if (matchedLoan && matchedLoan.memberId === sub) {
        isOwner = true;
      }
    }

    if (!isOwner) {
      return c.json({ success: false, message: 'Akses ditolak: Dokumen bukan milik Anda' }, 403);
    }
  }

  const filePath = join(LOANS_DIR, safeName);
  if (!existsSync(filePath)) {
    return c.json({ success: false, message: 'File tidak ditemukan' }, 404);
  }

  const ext = extname(safeName).toLowerCase();
  const contentType = MIME_MAP[ext] || 'application/octet-stream';
  const file = Bun.file(filePath);

  return new Response(file, {
    headers: {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    },
  });
});

/**
 * Serves a savings proof document after authentication and IDOR ownership check.
 */
protectedFiles.get('/savings/:filename', async (c) => {
  const rawFilename = c.req.param('filename');
  const safeName = basename(rawFilename);

  const auth = await authenticateFileRequest(c);
  if (!auth.authenticated || !auth.user) {
    return c.json({ success: false, message: auth.errorMessage || 'Unauthorized' }, auth.errorStatus || 401 as any);
  }

  const { sub, role } = auth.user;

  // Admins and superadmins can view all documents
  if (role !== 'admin' && role !== 'superadmin') {
    // Member access: verify IDOR
    let isOwner = false;

    // Check if filename contains the ownerId directly
    const parts = safeName.split('_');
    if (parts.length >= 4 && parts[1] === sub) {
      isOwner = true;
    } else {
      // Look up deposit record in database
      const matchedDeposit = await db
        .query('SELECT member_id FROM savings_deposits WHERE proof_url LIKE ? LIMIT 1')
        .get<{ member_id: string }>(`%${safeName}%`);

      if (matchedDeposit && matchedDeposit.member_id === sub) {
        isOwner = true;
      }
    }

    if (!isOwner) {
      return c.json({ success: false, message: 'Akses ditolak: Dokumen bukan milik Anda' }, 403);
    }
  }

  const filePath = join(SAVINGS_DIR, safeName);
  if (!existsSync(filePath)) {
    return c.json({ success: false, message: 'File tidak ditemukan' }, 404);
  }

  const ext = extname(safeName).toLowerCase();
  const contentType = MIME_MAP[ext] || 'application/octet-stream';
  const file = Bun.file(filePath);

  return new Response(file, {
    headers: {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    },
  });
});

export default protectedFiles;
