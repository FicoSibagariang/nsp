import { Hono } from 'hono';
import type { Context } from 'hono';
import { sign, verify, decode } from 'hono/jwt';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import db from '../db';
import type { MemberRow } from '../db/entities';
import { loginSchema } from '../schemas';
import { secretKey, checkRateLimit, isKeyRateLimited, clearRateLimit } from '../middleware';
import { getClientIp } from '../lib/audit';
import { verifyGoogleToken } from '../google-auth';
import { findMemberByEmailOrId, findMemberById } from '../services/memberService';
import { blacklistAccessToken, blacklistRefreshToken } from '../services/authService';
import {
  accessTokenExpUnix,
  refreshTokenExpUnix,
  REFRESH_TOKEN_TTL_SEC,
  ACCESS_TOKEN_TTL_SEC,
} from '../lib/tokenTtl';

const memberAuth = new Hono();

async function issueMemberSession(c: Context, member: MemberRow) {
  const accessJti = crypto.randomUUID();
  const refreshJti = crypto.randomUUID();

  const payload = {
    sub: member.id,
    email: member.email,
    role: 'member' as const,
    name: member.name,
    exp: accessTokenExpUnix(),
    jti: accessJti,
  };

  const accessToken = await sign(payload, secretKey);

  const refreshPayload = {
    sub: member.id,
    email: member.email,
    role: 'member' as const,
    exp: refreshTokenExpUnix(),
    jti: refreshJti,
  };
  const refreshToken = await sign(refreshPayload, secretKey);

  setCookie(c, 'memberRefreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: REFRESH_TOKEN_TTL_SEC,
    path: '/',
  });

  return {
    token: accessToken,
    role: 'member' as const,
    memberId: member.id,
    name: member.name,
    isMember: true,
    expiresIn: ACCESS_TOKEN_TTL_SEC,
  };
}

async function issueEmployeeSession(c: Context, employee: { id: string; email: string; name: string; is_member?: boolean; member_id?: string | null }) {
  const accessJti = crypto.randomUUID();
  const refreshJti = crypto.randomUUID();

  const payload = {
    sub: employee.member_id || employee.id,
    email: employee.email,
    role: 'member' as const,
    name: employee.name,
    employeeId: employee.id,
    exp: accessTokenExpUnix(),
    jti: accessJti,
  };

  const accessToken = await sign(payload, secretKey);

  const refreshPayload = {
    sub: employee.member_id || employee.id,
    email: employee.email,
    role: 'member' as const,
    employeeId: employee.id,
    exp: refreshTokenExpUnix(),
    jti: refreshJti,
  };
  const refreshToken = await sign(refreshPayload, secretKey);

  setCookie(c, 'memberRefreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: REFRESH_TOKEN_TTL_SEC,
    path: '/',
  });

  return {
    token: accessToken,
    role: 'member' as const,
    memberId: employee.member_id || employee.id,
    employeeId: employee.id,
    name: employee.name,
    isMember: Boolean(employee.is_member),
    expiresIn: ACCESS_TOKEN_TTL_SEC,
  };
}

memberAuth.post('/login', async (c) => {
  const ip = getClientIp(c);

  if (!(await checkRateLimit(`member-login:${ip}`, 5, 15 * 60 * 1000))) {
    return c.json({ success: false, message: 'Too many login attempts. Please try again later.' }, 429);
  }

  try {
    const body = await c.req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400);
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();
    const emailKey = `login:failed:email:${normalizedEmail}`;

    if (await isKeyRateLimited(emailKey, 5)) {
      return c.json({
        success: false,
        message: 'Too many failed login attempts for this account. Please try again later.'
      }, 429);
    }

    // A member can log in using their email or their ID (NIP) mapped to the email field in the login form
    const member = await findMemberByEmailOrId(db, email);
    
    if (!member || !member.password) {
      await checkRateLimit(emailKey, 5, 15 * 60 * 1000);
      return c.json({ success: false, message: 'Invalid credentials' }, 401);
    }

    const isMatch = await Bun.password.verify(password, member.password);
    if (!isMatch) {
      await checkRateLimit(emailKey, 5, 15 * 60 * 1000);
      return c.json({ success: false, message: 'Invalid credentials' }, 401);
    }

    if (member.status !== 'Aktif') {
      return c.json({ success: false, message: 'Akun anggota tidak aktif.' }, 403);
    }

    // Clear failed attempts upon successful login
    await clearRateLimit(emailKey);

    const data = await issueMemberSession(c, member);
    return c.json({ success: true, message: 'Login successful', data });
  } catch (error) {
    console.error('Member login error:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
});

/**
 * Member & Employee Google SSO:
 * 1. Match verified Google email to members.email (Cooperative Member).
 * 2. If not found in members, match to company_employees.email (Company Employee EWA).
 */
memberAuth.post('/google', async (c) => {
  const ssoIp = getClientIp(c);

  if (!(await checkRateLimit(`member-sso:${ssoIp}`, 5, 15 * 60 * 1000))) {
    return c.json({ success: false, message: 'Too many SSO attempts. Please try again later.' }, 429);
  }

  try {
    const body = await c.req.json();
    const credential = body?.credential as string | undefined;
    if (!credential) {
      return c.json({ success: false, message: 'Missing Google credential' }, 400);
    }

    const googleUser = await verifyGoogleToken(credential);
    if (!googleUser) {
      return c.json({ success: false, message: 'Invalid Google token' }, 401);
    }

    const email = googleUser.email.trim().toLowerCase();
    
    // 1. Check cooperative members first
    const member = await db
      .query(
        `SELECT * FROM members
         WHERE deletedAt IS NULL
           AND email IS NOT NULL
           AND lower(email) = ?
         LIMIT 1`
      )
      .get<MemberRow>(email);

    if (member) {
      if (member.status !== 'Aktif') {
        return c.json({ success: false, message: 'Akun anggota tidak aktif.' }, 403);
      }

      const data = await issueMemberSession(c, member);
      return c.json({
        success: true,
        message: 'Login successful',
        data: {
          ...data,
          googleName: googleUser.name,
        },
      });
    }

    // 2. Check company employees (for non-member EWA access)
    const employee = await db
      .query(
        `SELECT id, nip, name, email, is_member, member_id, status 
         FROM employees 
         WHERE lower(email) = ? AND lower(status) = 'active' 
         LIMIT 1`
      )
      .get<any>(email);

    if (employee) {
      const data = await issueEmployeeSession(c, employee);
      return c.json({
        success: true,
        message: 'Login successful (Karyawan Perusahaan)',
        data: {
          ...data,
          googleName: googleUser.name,
        },
      });
    }

    return c.json(
      {
        success: false,
        message:
          'Email Google tidak terdaftar sebagai Anggota Koperasi maupun Karyawan Perusahaan. Hubungi HRD / Pengurus Koperasi.',
      },
      403
    );
  } catch (error) {
    console.error('Member/Employee Google SSO error:', error);
    return c.json({ success: false, message: 'Authentication failed' }, 500);
  }
});

memberAuth.post('/refresh', async (c) => {
  const refreshIp = getClientIp(c);

  if (!(await checkRateLimit(`member-refresh:${refreshIp}`, 30, 60 * 60 * 1000))) {
    return c.json({ success: false, message: 'Too many refresh attempts.' }, 429);
  }

  const refreshToken = getCookie(c, 'memberRefreshToken');
  if (!refreshToken) {
    return c.json({ success: false, message: 'No refresh token' }, 401);
  }

  try {
    const decodedRefresh = await verify(refreshToken, secretKey, 'HS256');
    const memberId = decodedRefresh.sub as string;

    if (decodedRefresh.role !== 'member') {
      return c.json({ success: false, message: 'Invalid refresh token role' }, 401);
    }

    const member = await findMemberById(db, memberId);
    if (!member || member.status !== 'Aktif') {
      return c.json({ success: false, message: 'User no longer valid' }, 401);
    }

    const newAccessJti = crypto.randomUUID();
    const newRefreshJti = crypto.randomUUID();

    const payload = {
      sub: member.id,
      email: member.email,
      role: 'member',
      name: member.name,
      exp: accessTokenExpUnix(),
      jti: newAccessJti,
    };
    const newAccessToken = await sign(payload, secretKey);

    const refreshPayload = {
      sub: member.id,
      email: member.email,
      role: 'member',
      exp: refreshTokenExpUnix(),
      jti: newRefreshJti,
    };
    const newRefreshToken = await sign(refreshPayload, secretKey);

    // Invalidate old refresh token if it had a jti
    const oldRefreshJti = decodedRefresh?.jti as string | undefined;
    if (oldRefreshJti) {
      await blacklistRefreshToken(db, oldRefreshJti, member.id, Date.now() + REFRESH_TOKEN_TTL_SEC * 1000);
    }

    setCookie(c, 'memberRefreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: REFRESH_TOKEN_TTL_SEC,
      path: '/'
    });

    return c.json({ success: true, data: { token: newAccessToken } });
  } catch {
    return c.json({ success: false, message: 'Invalid refresh token' }, 401);
  }
});

memberAuth.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = decode(token);
      const jti = decoded?.payload?.jti as string | undefined;
      let exp = Date.now() + ACCESS_TOKEN_TTL_SEC * 1000;
      if (decoded?.payload?.exp) {
        exp = (decoded.payload.exp as number) * 1000;
      }
      if (jti) {
        await blacklistAccessToken(db, jti, exp);
      }
    } catch (e) {
      console.warn('Failed to decode member token for logout blacklist:', e);
    }
  }

  const refreshToken = getCookie(c, 'memberRefreshToken');
  if (refreshToken) {
    try {
      const decodedRefresh = decode(refreshToken);
      const refreshJti = decodedRefresh?.payload?.jti as string | undefined;
      const sub = (decodedRefresh?.payload?.sub || 'member') as string;
      let exp = Date.now() + REFRESH_TOKEN_TTL_SEC * 1000;
      if (decodedRefresh?.payload?.exp) {
        exp = (decodedRefresh.payload.exp as number) * 1000;
      }
      if (refreshJti) {
        await blacklistRefreshToken(db, refreshJti, sub, exp);
      }
    } catch (e) {
      console.warn('Failed to decode member refresh token for logout:', e);
    }
  }

  deleteCookie(c, 'memberRefreshToken', { path: '/' });
  return c.json({ success: true, message: 'Logout successful' });
});

export default memberAuth;
