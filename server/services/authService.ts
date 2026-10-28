import type { Db } from '../db';
import type { AdminRow, SettingRow } from '../db/entities';

export async function findAdminByEmail(database: Db, email: string): Promise<AdminRow | null> {
  return database.query("SELECT * FROM admins WHERE email = ?").get<AdminRow>(email);
}

export async function findAdminById(database: Db, id: string): Promise<AdminRow | null> {
  return database.query("SELECT * FROM admins WHERE id = ?").get<AdminRow>(id);
}

export async function findAdminByGoogleOrEmail(
  database: Db,
  googleSub: string,
  email: string
): Promise<AdminRow | null> {
  return database
    .query("SELECT * FROM admins WHERE google_id = ? OR email = ?")
    .get<AdminRow>(googleSub, email);
}

export async function getSsoAutoRegisterSetting(database: Db): Promise<boolean> {
  const row = await database
    .query("SELECT value FROM settings WHERE key = 'ssoAutoRegister'")
    .get<SettingRow>();
  return row?.value === 'true';
}

export async function createSsoAdmin(
  database: Db,
  data: { id: string; email: string; googleSub: string; name: string; avatarUrl: string }
): Promise<void> {
  await database.run(
    `INSERT INTO admins (id, email, password, role, google_id, name, avatar_url, auth_provider)
     VALUES (?, ?, '', 'viewer', ?, ?, ?, 'google')`,
    [data.id, data.email, data.googleSub, data.name, data.avatarUrl]
  );
}

export async function linkGoogleAccount(
  database: Db,
  adminId: string,
  googleSub: string,
  name: string,
  avatarUrl: string
): Promise<void> {
  await database.run(
    "UPDATE admins SET google_id = ?, name = COALESCE(name, ?), avatar_url = ?, auth_provider = 'google' WHERE id = ?",
    [googleSub, name, avatarUrl, adminId]
  );
}

export async function checkRefreshTokenRevoked(database: Db, jti: string): Promise<boolean> {
  const existing = await database
    .query("SELECT 1 FROM refresh_token_blacklist WHERE jti_token = ?")
    .get(jti);
  return Boolean(existing);
}

export async function revokeAllAdminRefreshTokens(database: Db, adminId: string): Promise<void> {
  await database.run("DELETE FROM refresh_token_blacklist WHERE admin_id = ?", [adminId]);
}

export async function blacklistRefreshToken(
  database: Db,
  jti: string,
  adminId: string,
  expiresAt: number
): Promise<void> {
  await database.run(
    "INSERT INTO refresh_token_blacklist (jti_token, admin_id, expires_at) VALUES (?, ?, ?) ON CONFLICT (jti_token) DO UPDATE SET revoked_at = CURRENT_TIMESTAMP",
    [jti, adminId, expiresAt]
  );
}

export async function blacklistAccessToken(
  database: Db,
  jti: string,
  expiresAt: number
): Promise<void> {
  await database.run(
    "INSERT INTO token_blacklist (jti_token, expires_at) VALUES (?, ?) ON CONFLICT (jti_token) DO UPDATE SET expires_at = EXCLUDED.expires_at",
    [jti, expiresAt]
  );
}

export async function getTotpStatus(database: Db, adminId: string): Promise<boolean> {
  const admin = await database
    .query("SELECT two_factor_enabled FROM admins WHERE id = ?")
    .get<AdminRow>(adminId);
  return Boolean(admin?.two_factor_enabled);
}

export async function saveTotpSetup(
  database: Db,
  adminId: string,
  secret: string,
  recoveryCodes: string[]
): Promise<void> {
  await database.run(
    "UPDATE admins SET totp_secret = ?, recovery_codes = ? WHERE id = ?",
    [secret, JSON.stringify(recoveryCodes), adminId]
  );
}

export async function getAdminTotpData(
  database: Db,
  adminId: string
): Promise<Pick<AdminRow, 'totp_secret' | 'recovery_codes' | 'two_factor_enabled'> | null> {
  return database
    .query("SELECT totp_secret, recovery_codes, two_factor_enabled FROM admins WHERE id = ?")
    .get<Pick<AdminRow, 'totp_secret' | 'recovery_codes' | 'two_factor_enabled'>>(adminId);
}

export async function enableTotp(database: Db, adminId: string): Promise<void> {
  await database.run("UPDATE admins SET two_factor_enabled = TRUE WHERE id = ?", [adminId]);
}

export async function disableTotp(database: Db, adminId: string): Promise<void> {
  await database.run(
    "UPDATE admins SET two_factor_enabled = FALSE, totp_secret = NULL, recovery_codes = '[]' WHERE id = ?",
    [adminId]
  );
}

export async function updateRecoveryCodes(
  database: Db,
  adminId: string,
  codes: string[]
): Promise<void> {
  await database.run("UPDATE admins SET recovery_codes = ? WHERE id = ?", [
    JSON.stringify(codes),
    adminId,
  ]);
}
