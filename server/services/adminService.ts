import type { Db } from '../db';
import type { MemberRow } from '../db/entities';
import { ServiceError } from './errors';

export type AdminPublic = {
  id: string;
  email: string;
  role: string;
  google_id: string | null;
  name: string | null;
  avatar_url: string | null;
  auth_provider: string | null;
};

export type SavingsReconciliationResult = {
  memberId: string;
  memberName: string;
  dbTotalSavings: number;
  calculatedTotal: number;
  difference: number;
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
};

export async function getAdminsList(database: Db): Promise<AdminPublic[]> {
  return database
    .query("SELECT id, email, role, google_id, name, avatar_url, auth_provider FROM admins ORDER BY email ASC")
    .all<AdminPublic>();
}

export async function createAdmin(
  database: Db,
  data: { email: string; password?: string; role: string; name?: string }
): Promise<string> {
  const existing = await database.query("SELECT 1 FROM admins WHERE email = ?").get(data.email);
  if (existing) {
    throw new ServiceError('Email pengurus sudah terdaftar', 400);
  }

  const id = crypto.randomUUID();
  let hashedPassword = "";
  let authProvider = "google";

  if (data.password) {
    hashedPassword = await Bun.password.hash(data.password);
    authProvider = "local";
  }

  await database.run(
    `INSERT INTO admins (id, email, password, role, name, auth_provider) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.email, hashedPassword, data.role, data.name || null, authProvider]
  );

  return id;
}

export async function updateAdminRole(
  database: Db,
  id: string,
  role: string
): Promise<Pick<AdminPublic, "email" | "role"> | null> {
  const before = await database
    .query("SELECT email, role FROM admins WHERE id = ?")
    .get<Pick<AdminPublic, "email" | "role">>(id);

  await database.run("UPDATE admins SET role = ? WHERE id = ?", [role, id]);
  return before;
}

export async function deleteAdmin(
  database: Db,
  id: string
): Promise<Pick<AdminPublic, "email" | "role"> | null> {
  const before = await database
    .query("SELECT email, role FROM admins WHERE id = ?")
    .get<Pick<AdminPublic, "email" | "role">>(id);

  await database.run("DELETE FROM admins WHERE id = ?", [id]);
  return before;
}

export async function getSavingsReconciliationData(database: Db): Promise<{
  reconciliationResults: SavingsReconciliationResult[];
  negativeBalanceMembers: any[];
}> {
  const driftedMembers = await database.query(`
    SELECT
      id,
      name as memberName,
      simpananPokok,
      simpananWajib,
      simpananSukarela,
      totalSavings as dbTotalSavings,
      (simpananPokok + simpananWajib + simpananSukarela) as calculatedTotal
    FROM members
    WHERE totalSavings != simpananPokok + simpananWajib + simpananSukarela
  `).all<{
    id: string;
    memberName: string;
    simpananPokok: number;
    simpananWajib: number;
    simpananSukarela: number;
    dbTotalSavings: number;
    calculatedTotal: number;
  }>();

  const reconciliationResults: SavingsReconciliationResult[] = driftedMembers.map((m) => ({
    memberId: m.id,
    memberName: m.memberName,
    dbTotalSavings: Number(m.dbTotalSavings) || 0,
    calculatedTotal: Number(m.simpananPokok) + Number(m.simpananWajib) + Number(m.simpananSukarela),
    difference: (Number(m.dbTotalSavings) || 0) - (Number(m.simpananPokok) + Number(m.simpananWajib) + Number(m.simpananSukarela)),
    simpananPokok: Number(m.simpananPokok) || 0,
    simpananWajib: Number(m.simpananWajib) || 0,
    simpananSukarela: Number(m.simpananSukarela) || 0,
  }));

  const negativeBalanceMembers = await database.query(`
    SELECT
      id,
      name as memberName,
      simpananPokok,
      simpananWajib,
      simpananSukarela,
      totalSavings
    FROM members
    WHERE simpananPokok < 0 OR simpananWajib < 0 OR simpananSukarela < 0 OR totalSavings < 0
  `).all<{
    id: string;
    memberName: string;
    simpananPokok: number;
    simpananWajib: number;
    simpananSukarela: number;
    totalSavings: number;
  }>();

  return { reconciliationResults, negativeBalanceMembers };
}

export async function reconcileMemberSavings(
  database: Db,
  memberId: string
): Promise<{ member: Pick<MemberRow, 'id' | 'name' | 'totalSavings'>; correctTotal: number }> {
  const member = await database.query(`
    SELECT id, name, simpananPokok, simpananWajib, simpananSukarela, totalSavings
    FROM members WHERE id = ?
  `).get<Pick<MemberRow, 'id' | 'name' | 'simpananPokok' | 'simpananWajib' | 'simpananSukarela' | 'totalSavings'>>(memberId);

  if (!member) {
    throw new ServiceError('Member not found', 404);
  }

  const correctTotal = Number(member.simpananPokok) + Number(member.simpananWajib) + Number(member.simpananSukarela);
  await database.run("UPDATE members SET totalSavings = ? WHERE id = ?", [correctTotal, memberId]);

  return { member, correctTotal };
}
