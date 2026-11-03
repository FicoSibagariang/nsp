import type { Db } from "../db";
import type { MemberSavingsCols, TransactionRow } from "../db/entities";
import { resolveCalendarDateIso } from "../lib/dates";
import { ServiceError } from "./errors";
import { recordAutoJournal } from "./accountingService";

export type SavingsType = "pokok" | "wajib" | "sukarela";

export type UpdateSavingsInput = {
  additionalSavings: number;
  savingsType: SavingsType;
  /** Optional backdated date as YYYY-MM-DD. Defaults to now when omitted. */
  transactionDate?: string;
  paymentSourceAccountId?: string | null;
};

/** @deprecated use resolveCalendarDateIso from ../lib/dates */
export function resolveTransactionCreatedAt(transactionDate?: string): string {
  return resolveCalendarDateIso(transactionDate);
}

export type UpdateSavingsResult = {
  transactionId: string;
  newTotal: number;
  before: MemberSavingsCols;
  after: {
    simpananPokok: number;
    simpananWajib: number;
    simpananSukarela: number;
    additionalSavings: number;
    savingsType: SavingsType;
  };
};

export function validateSavingsMutation(
  member: MemberSavingsCols,
  additionalSavings: number,
  savingsType: SavingsType
): { newPokok: number; newWajib: number; newSukarela: number; newTotal: number } {
  const additionalSavingsNum = Number(additionalSavings);
  let newPokok = Number(member.simpananPokok ?? 0);
  let newWajib = Number(member.simpananWajib ?? 0);
  let newSukarela = Number(member.simpananSukarela ?? 0);

  if (savingsType === "pokok") newPokok += additionalSavingsNum;
  else if (savingsType === "wajib") newWajib += additionalSavingsNum;
  else newSukarela += additionalSavingsNum;

  if (additionalSavingsNum < 0) {
    if (newSukarela < 0) {
      throw new ServiceError("Penarikan melebihi saldo sukarela tersedia");
    }

    const newTotal = newPokok + newWajib + newSukarela;
    if (newTotal < 0) {
      throw new ServiceError("Penarikan melebihi total simpanan tersedia");
    }
  }

  if (newPokok < 0 || newWajib < 0 || newSukarela < 0) {
    throw new ServiceError("Saldo tidak mencukupi");
  }

  return {
    newPokok,
    newWajib,
    newSukarela,
    newTotal: newPokok + newWajib + newSukarela,
  };
}

export async function updateMemberSavings(
  database: Db,
  memberId: string,
  input: UpdateSavingsInput,
  createdBy: string
): Promise<UpdateSavingsResult> {
  return await database.transaction(async () => {
    // Row lock member to prevent race conditions & double-spending
    const member = await database
      .query("SELECT simpananPokok, simpananWajib, simpananSukarela, totalSavings, name FROM members WHERE id = ? FOR UPDATE")
      .get<MemberSavingsCols & { name: string }>(memberId);

    if (!member) {
      throw new ServiceError("Not found", 404);
    }

    const additionalSavingsNum = Number(input.additionalSavings);
    const { newPokok, newWajib, newSukarela, newTotal } = validateSavingsMutation(
      member,
      additionalSavingsNum,
      input.savingsType
    );
    const createdAt = resolveTransactionCreatedAt(input.transactionDate);

    const transactionId = crypto.randomUUID();

    await database
      .query("UPDATE members SET simpananPokok = ?, simpananWajib = ?, simpananSukarela = ?, totalSavings = ? WHERE id = ?")
      .run(newPokok, newWajib, newSukarela, newTotal, memberId);

    await database.query(`
      INSERT INTO transactions (id, memberId, type, amount, balanceBefore, balanceAfter, createdAt, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      transactionId,
      memberId,
      additionalSavingsNum >= 0 ? `setor_${input.savingsType}` : `tarik_${input.savingsType}`,
      Math.abs(additionalSavingsNum),
      Number(member.totalSavings ?? 0),
      newTotal,
      createdAt,
      createdBy
    );

    // Otomatisasi Jurnal
    let simpananAccountCode = '21101';
    if (input.savingsType === 'pokok') simpananAccountCode = '31101';
    else if (input.savingsType === 'wajib') simpananAccountCode = '31102';
    
    let kasCode = '11102'; // Default Kas Bank
    if (input.paymentSourceAccountId) {
      const acc = (await database
        .query("SELECT code FROM accounts WHERE id::text = ? OR code = ?")
        .get(input.paymentSourceAccountId, input.paymentSourceAccountId)) as { code?: string } | null;
      if (acc?.code) {
        kasCode = acc.code;
      }
    }

    const absAmount = Math.abs(additionalSavingsNum);
    const isSetor = additionalSavingsNum >= 0;

    // Fail-fast: auto-journal is part of the atomic transaction; must throw on failure
    await recordAutoJournal({
      transaction_date: createdAt,
      description: `${isSetor ? 'Setoran' : 'Penarikan'} Simpanan ${input.savingsType} — ${member.name}`,
      reference_type: `savings_${isSetor ? 'setor' : 'tarik'}`,
      reference_id: transactionId,
      lines: [
        { account_code: kasCode, debit: isSetor ? absAmount : 0, credit: isSetor ? 0 : absAmount },
        { account_code: simpananAccountCode, debit: isSetor ? 0 : absAmount, credit: isSetor ? absAmount : 0 },
      ]
    });

    return {
      transactionId,
      newTotal,
      before: member,
      after: {
        simpananPokok: newPokok,
        simpananWajib: newWajib,
        simpananSukarela: newSukarela,
        additionalSavings: additionalSavingsNum,
        savingsType: input.savingsType,
      },
    };
  })();
}

export type BatchSavingsImportItem = {
  memberId?: string;
  nik?: string;
  savingsType: SavingsType;
  amount: number;
  transactionDate?: string;
};

export type BatchSavingsImportResult = {
  processedCount: number;
  failedCount: number;
  errors: Array<{ index: number; identifier: string; message: string }>;
};

export async function batchImportSavings(
  database: Db,
  items: BatchSavingsImportItem[],
  createdBy: string
): Promise<BatchSavingsImportResult> {
  let processedCount = 0;
  const errors: Array<{ index: number; identifier: string; message: string }> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const identifier = item.memberId || item.nik || `Baris #${i + 1}`;

    if (!item.amount || item.amount <= 0) {
      errors.push({ index: i, identifier, message: "Nominal setoran harus lebih besar dari 0" });
      continue;
    }

    let member: { id: string } | null = null;
    if (item.memberId) {
      member = await database
        .query("SELECT id FROM members WHERE id = ? AND deletedAt IS NULL")
        .get<{ id: string }>(item.memberId);
    } else if (item.nik) {
      const cleanNik = String(item.nik).replace(/\D/g, "");
      member = await database
        .query("SELECT id FROM members WHERE nik = ? AND deletedAt IS NULL")
        .get<{ id: string }>(cleanNik);
    }

    if (!member) {
      errors.push({ index: i, identifier, message: "Anggota tidak ditemukan" });
      continue;
    }

    try {
      await updateMemberSavings(
        database,
        member.id,
        {
          additionalSavings: item.amount,
          savingsType: item.savingsType || "pokok",
          transactionDate: item.transactionDate,
        },
        createdBy
      );
      processedCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memproses simpanan";
      errors.push({ index: i, identifier, message: msg });
    }
  }

  return {
    processedCount,
    failedCount: errors.length,
    errors,
  };
}

export async function getSavingsTransactions(
  database: Db,
  page: number,
  limit: number
): Promise<{ rows: TransactionRow[]; total: number }> {
  const offset = (page - 1) * limit;

  const rows = await database
    .query(`
      SELECT t.*, m.name as "memberName" 
      FROM transactions t
      LEFT JOIN members m ON t.memberId = m.id
      ORDER BY t.createdAt DESC 
      LIMIT ? OFFSET ?
    `)
    .all<TransactionRow>(limit, offset);

  const totalRes = (await database
    .query("SELECT COUNT(*) as count FROM transactions")
    .get()) as { count: number } | null;

  return {
    rows,
    total: totalRes?.count ?? 0,
  };
}

export async function getUnpaidPokokMembers(
  database: Db
): Promise<Array<{ nik: string | null; name: string }>> {
  return database
    .query(`
      SELECT nik, name FROM members
      WHERE simpananPokok = 0 AND deletedAt IS NULL
      ORDER BY name ASC
    `)
    .all<{ nik: string | null; name: string }>();
}

export async function getSavingsPaymentSources(
  database: Db
): Promise<Array<{ id: string; code: string; name: string; type: string }>> {
  return database
    .query(`
      SELECT id, code, name, type 
      FROM accounts 
      WHERE code LIKE '111%'
      ORDER BY code ASC
    `)
    .all<{ id: string; code: string; name: string; type: string }>();
}

export interface SavingsPayrollWajibRecap {
  periodMonth: string;
  totalActiveMembers: number;
  defaultAmountPerMember: number;
  alreadyPaidCount: number;
  pendingCount: number;
  totalPendingAmount: number;
  isSettled: boolean;
  settledAt: string | null;
  pendingMembers: Array<{
    id: string;
    name: string;
    nik: string | null;
  }>;
}

export interface SettleSavingsPayrollWajibResult {
  periodMonth: string;
  settledMembersCount: number;
  amountPerMember: number;
  totalSettledAmount: number;
  journalEntryId: string | null;
}

export async function getSavingsPayrollWajibRecap(
  database: Db,
  periodMonth: string
): Promise<SavingsPayrollWajibRecap> {
  if (!periodMonth || !/^\d{4}-\d{2}$/.test(periodMonth)) {
    throw new ServiceError("Format periodMonth tidak valid. Gunakan format YYYY-MM", 400);
  }

  // 1. Ambil setting default simpanan wajib
  const setting = await database
    .query("SELECT value FROM settings WHERE key IN ('simpanan_wajib', 'simpananWajib') LIMIT 1")
    .get<{ value: string }>();
  const defaultAmountPerMember = setting?.value ? parseInt(setting.value, 10) || 50000 : 50000;

  // 2. Total anggota aktif
  const totalActiveRes = await database
    .query("SELECT COUNT(*) as count FROM members WHERE status = 'Aktif' AND deletedAt IS NULL")
    .get<{ count: number }>();
  const totalActiveMembers = Number(totalActiveRes?.count || 0);

  // 3. Anggota aktif yang sudah bayar simpanan wajib di bulan ini
  const monthPrefix = `${periodMonth}%`;
  const paidRes = await database
    .query(`
      SELECT COUNT(DISTINCT t.memberId) as count
      FROM transactions t
      JOIN members m ON m.id = t.memberId
      WHERE m.status = 'Aktif' AND m.deletedAt IS NULL
        AND t.type = 'setor_wajib'
        AND t.createdAt LIKE ?
    `)
    .get<{ count: number }>(monthPrefix);
  const alreadyPaidCount = Number(paidRes?.count || 0);

  // 4. Daftar anggota aktif yang pending belum setor wajib di bulan ini
  const pendingMembers = await database
    .query(`
      SELECT m.id, m.name, m.nik
      FROM members m
      WHERE m.status = 'Aktif' AND m.deletedAt IS NULL
        AND m.id NOT IN (
          SELECT DISTINCT t.memberId
          FROM transactions t
          WHERE t.type = 'setor_wajib'
            AND t.createdAt LIKE ?
        )
      ORDER BY m.name ASC
    `)
    .all<{ id: string; name: string; nik: string | null }>(monthPrefix);

  const pendingCount = pendingMembers.length;
  const totalPendingAmount = pendingCount * defaultAmountPerMember;
  const isSettled = totalActiveMembers > 0 && pendingCount === 0;

  // 5. Cek apakah ada journal settlement untuk periode ini
  const journalRes = await database
    .query(`
      SELECT transaction_date, created_at
      FROM journal_entries
      WHERE reference_type = 'savings_payroll_wajib' AND reference_id = ?
      ORDER BY created_at DESC LIMIT 1
    `)
    .get<{ transaction_date: string; created_at: string }>(periodMonth);

  const settledAt = journalRes?.created_at ? String(journalRes.created_at) : null;

  return {
    periodMonth,
    totalActiveMembers,
    defaultAmountPerMember,
    alreadyPaidCount,
    pendingCount,
    totalPendingAmount,
    isSettled,
    settledAt,
    pendingMembers,
  };
}

export async function settleSavingsPayrollWajib(
  database: Db,
  input: {
    periodMonth: string;
    targetAccountId?: string;
    transactionDate?: string;
    amountPerMember?: number;
  },
  adminId?: string
): Promise<SettleSavingsPayrollWajibResult> {
  const { periodMonth, targetAccountId } = input;
  if (!periodMonth || !/^\d{4}-\d{2}$/.test(periodMonth)) {
    throw new ServiceError("Format periodMonth tidak valid. Gunakan format YYYY-MM", 400);
  }

  const [yearStr, monthStr] = periodMonth.split('-');
  const year = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  const lastDay = new Date(year, m, 0).getDate();
  const effectiveDate = input.transactionDate || `${periodMonth}-${String(lastDay).padStart(2, '0')}`;
  const effectiveDateIso = `${effectiveDate}T12:00:00.000Z`;

  return await database.transaction(async () => {
    // 1. Ambil nominal per anggota
    let amount = input.amountPerMember;
    if (!amount || amount <= 0) {
      const setting = await database
        .query("SELECT value FROM settings WHERE key IN ('simpanan_wajib', 'simpananWajib') LIMIT 1")
        .get<{ value: string }>();
      amount = setting?.value ? parseInt(setting.value, 10) || 50000 : 50000;
    }

    // 2. Ambil daftar anggota aktif yang belum bayar simpanan wajib di bulan ini
    const monthPrefix = `${periodMonth}%`;
    const pendingMembers = await database
      .query(`
        SELECT m.id, m.name, m.simpananPokok, m.simpananWajib, m.simpananSukarela, m.totalSavings
        FROM members m
        WHERE m.status = 'Aktif' AND m.deletedAt IS NULL
          AND m.id NOT IN (
            SELECT DISTINCT t.memberId
            FROM transactions t
            WHERE t.type = 'setor_wajib'
              AND t.createdAt LIKE ?
          )
        ORDER BY m.name ASC
        FOR UPDATE
      `)
      .all<MemberSavingsCols & { id: string; name: string }>(monthPrefix);

    if (pendingMembers.length === 0) {
      const totalActiveRes = await database
        .query("SELECT COUNT(*) as count FROM members WHERE status = 'Aktif' AND deletedAt IS NULL")
        .get<{ count: number }>();
      if (Number(totalActiveRes?.count || 0) > 0) {
        throw new ServiceError(`Seluruh anggota aktif sudah menyetor simpanan wajib untuk periode ${periodMonth}.`, 400);
      } else {
        throw new ServiceError("Tidak ada anggota aktif yang ditemukan.", 400);
      }
    }

    // 3. Update saldo dan insert record transaksi
    for (const member of pendingMembers) {
      const curWajib = Number(member.simpananWajib || 0);
      const curTotal = Number(member.totalSavings || 0);
      const newWajib = curWajib + amount;
      const newTotal = curTotal + amount;

      await database
        .query("UPDATE members SET simpananWajib = ?, totalSavings = ? WHERE id = ?")
        .run(newWajib, newTotal, member.id);

      const transactionId = crypto.randomUUID();
      await database
        .query(`
          INSERT INTO transactions (id, memberId, type, amount, balanceBefore, balanceAfter, createdAt, createdBy)
          VALUES (?, ?, 'setor_wajib', ?, ?, ?, ?, ?)
        `)
        .run(
          transactionId,
          member.id,
          amount,
          curTotal,
          newTotal,
          effectiveDateIso,
          adminId || 'System'
        );
    }

    // 4. Kas/bank target
    let kasCode = '11102'; // default Bank Mandiri
    if (targetAccountId) {
      const acc = await database.query("SELECT code FROM accounts WHERE id = ?").get<{ code: string }>(targetAccountId);
      if (acc?.code) {
        kasCode = acc.code;
      }
    }

    // 5. Jurnal konsolidasi atomik
    const totalAmount = pendingMembers.length * amount;
    let journalEntryId: string | null = null;
    if (totalAmount > 0) {
      journalEntryId = await recordAutoJournal({
        transaction_date: effectiveDate,
        description: `Setoran Simpanan Wajib Payroll Periode ${periodMonth} (${pendingMembers.length} Anggota)`,
        reference_type: 'savings_payroll_wajib',
        reference_id: periodMonth,
        lines: [
          {
            account_code: kasCode,
            debit: totalAmount,
            description: `Penerimaan Setoran Simpanan Wajib Payroll Periode ${periodMonth}`,
          },
          {
            account_code: '31102',
            credit: totalAmount,
            description: `Setoran Simpanan Wajib Anggota Payroll Periode ${periodMonth}`,
          },
        ],
      });
    }

    return {
      periodMonth,
      settledMembersCount: pendingMembers.length,
      amountPerMember: amount,
      totalSettledAmount: totalAmount,
      journalEntryId,
    };
  })();
}