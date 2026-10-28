import type { Db } from '../db';
import db from '../db';
import type { AccountRow, JournalEntryRow, JournalLineRow } from '../db/entities';
import { toLocalYmd, getLocalTodayYmd } from '../lib/dates';
import { ServiceError } from './errors';

export type JournalLineInput = {
  account_code: string;
  debit?: number;
  credit?: number;
  description?: string;
};

export type AutoJournalInput = {
  transaction_date: string;
  description: string;
  reference_type: string;
  reference_id: string;
  lines: JournalLineInput[];
};

let _accountsCache: Record<string, string> = {};
let _cacheTime = 0;

async function getAccountIdByCode(code: string): Promise<string> {
  const now = Date.now();
  if (now - _cacheTime > 60000 || !_accountsCache[code]) {
    const rows = await db.query(`SELECT id, code FROM accounts`).all<AccountRow>();
    _accountsCache = rows.reduce((acc, row) => {
      acc[row.code] = row.id;
      return acc;
    }, {} as Record<string, string>);
    _cacheTime = now;
  }
  
  const id = _accountsCache[code];
  if (!id) throw new Error(`Kode Akun ${code} tidak ditemukan di database.`);
  return id;
}

export async function recordAutoJournal(input: AutoJournalInput): Promise<string> {
  const entryId = crypto.randomUUID();
  
  // 1. Validasi Balance
  const totalDebit = input.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = input.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
  
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Auto-Journal Error: Debit (${totalDebit}) & Kredit (${totalCredit}) tidak seimbang.`);
  }

  if (totalDebit <= 0) return entryId; // Skip if no value

  // Normalize transaction_date to local calendar date YYYY-MM-DD (e.g. Asia/Jakarta)
  const normalizedTxDate = toLocalYmd(input.transaction_date);

  await db.transaction(async () => {
    // 2. Insert Header
    await db.run(`
      INSERT INTO journal_entries (id, transaction_date, description, reference_type, reference_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [entryId, normalizedTxDate, input.description, input.reference_type, input.reference_id]);

    // 3. Insert Lines
    for (const line of input.lines) {
      if ((line.debit || 0) === 0 && (line.credit || 0) === 0) continue;
      
      const accountId = await getAccountIdByCode(line.account_code);
      await db.run(`
        INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, description)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
      `, [entryId, accountId, line.debit || 0, line.credit || 0, line.description || null]);
    }
  })();

  return entryId;
}

// ---------------------------------------------------------------------------
// Accounts Data Access
// ---------------------------------------------------------------------------

export async function getAccountsList(database: Db): Promise<AccountRow[]> {
  return database.query(`
    SELECT * FROM accounts 
    ORDER BY code ASC
  `).all<AccountRow>();
}

export async function createAccount(
  database: Db,
  data: { code: string; name: string; type: string; normal_balance: string }
): Promise<string> {
  const existing = await database.query(`SELECT id FROM accounts WHERE code = $1`).get(data.code);
  if (existing) {
    throw new ServiceError('Kode akun sudah digunakan', 400);
  }

  const newId = crypto.randomUUID();
  await database.run(
    `INSERT INTO accounts (id, code, name, type, normal_balance) VALUES ($1, $2, $3, $4, $5)`,
    [newId, data.code, data.name, data.type, data.normal_balance]
  );

  return newId;
}

// ---------------------------------------------------------------------------
// Journal Entries Data Access
// ---------------------------------------------------------------------------

export async function getJournalEntriesList(
  database: Db,
  limit: number,
  offset: number
): Promise<{ rows: any[]; total: number }> {
  const rows = await database.query(`
    SELECT 
      j.*,
      COALESCE(a.name, 'Sistem') as creator_name,
      (SELECT COALESCE(SUM(debit), 0) FROM journal_lines WHERE journal_entry_id = j.id) as total_amount,
      (
        SELECT json_agg(json_build_object(
          'id', l.id,
          'account_code', acc.code,
          'account_name', acc.name,
          'debit', l.debit,
          'credit', l.credit,
          'description', l.description
        ) ORDER BY l.debit DESC, acc.code ASC)
        FROM journal_lines l
        JOIN accounts acc ON l.account_id = acc.id
        WHERE l.journal_entry_id = j.id
      ) as lines
    FROM journal_entries j
    LEFT JOIN admins a ON j.created_by = a.id
    ORDER BY j.transaction_date DESC, j.created_at DESC
    LIMIT $1 OFFSET $2
  `).all<JournalEntryRow & { creator_name: string; total_amount: number; lines: any }>(limit, offset);

  const countRes = (await database.query(`SELECT COUNT(*) as count FROM journal_entries`).get()) as { count: number } | null;

  return {
    rows,
    total: Number(countRes?.count ?? 0),
  };
}

export async function getJournalLinesByEntryId(
  database: Db,
  entryId: string
): Promise<any[]> {
  return database.query(`
    SELECT 
      l.*,
      a.code as account_code,
      a.name as account_name
    FROM journal_lines l
    JOIN accounts a ON l.account_id = a.id
    WHERE l.journal_entry_id = $1
    ORDER BY l.debit DESC, a.code ASC
  `).all<JournalLineRow & { account_code: string; account_name: string }>(entryId);
}

export type CreateManualJournalData = {
  transaction_date: string;
  description: string;
  reference_type?: string | null;
  reference_id?: string | null;
  lines: Array<{
    account_id: string;
    debit: number;
    credit: number;
    description?: string | null;
  }>;
};

export async function createManualJournalEntry(
  database: Db,
  data: CreateManualJournalData,
  adminId: string | null
): Promise<string> {
  const totalDebit = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new ServiceError('Jurnal tidak balance. Total Debit harus sama dengan Kredit.', 400);
  }
  if (totalDebit <= 0) {
    throw new ServiceError('Nilai jurnal tidak boleh nol.', 400);
  }

  const entryId = crypto.randomUUID();

  await database.transaction(async () => {
    await database.run(`
      INSERT INTO journal_entries (id, transaction_date, description, reference_type, reference_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [entryId, data.transaction_date, data.description, data.reference_type || null, data.reference_id || null, adminId]);

    for (const line of data.lines) {
      await database.run(`
        INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, description)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
      `, [entryId, line.account_id, line.debit, line.credit, line.description || null]);
    }
  })();

  return entryId;
}

export async function reverseJournalEntry(
  database: Db,
  id: string,
  adminId: string | null
): Promise<string> {
  const entry = await database.query(`SELECT * FROM journal_entries WHERE id = $1`).get<{
    id: string;
    transaction_date: string;
    description: string;
    reference_type: string | null;
    reference_id: string | null;
  }>(id);

  if (!entry) throw new ServiceError('Jurnal tidak ditemukan', 404);

  const alreadyReversed = await database.query(
    `SELECT id FROM journal_entries WHERE reference_type = 'reversal_of' AND reference_id = $1`
  ).get(id);

  if (alreadyReversed) {
    throw new ServiceError('Jurnal ini sudah pernah dikoreksi sebelumnya.', 400);
  }

  const lines = await database.query(`
    SELECT jl.*, a.code as account_code
    FROM journal_lines jl
    JOIN accounts a ON jl.account_id = a.id
    WHERE jl.journal_entry_id = $1
  `).all<{ id: string; account_id: string; debit: number; credit: number; description: string | null }>(id);

  if (lines.length === 0) throw new ServiceError('Jurnal tidak memiliki baris', 400);

  const reversalId = crypto.randomUUID();
  const today = getLocalTodayYmd();

  await database.transaction(async () => {
    await database.run(`
      INSERT INTO journal_entries (id, transaction_date, description, reference_type, reference_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      reversalId,
      today,
      `[KOREKSI] ${entry.description}`,
      'reversal_of',
      id,
      adminId,
    ]);

    for (const line of lines) {
      await database.run(`
        INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, description)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
      `, [
        reversalId,
        line.account_id,
        line.credit,
        line.debit,
        line.description ? `[Koreksi] ${line.description}` : '[Koreksi]',
      ]);
    }
  })();

  return reversalId;
}

export async function deleteJournalEntry(
  database: Db,
  id: string
): Promise<{ description: string; reference_type: string | null }> {
  const entry = await database.query(`SELECT * FROM journal_entries WHERE id = $1`).get<{
    id: string;
    description: string;
    reference_type: string | null;
  }>(id);

  if (!entry) throw new ServiceError('Jurnal tidak ditemukan', 404);

  const autoTypes = ['loan_disbursement', 'loan_payment', 'savings_setor', 'savings_tarik'];
  if (entry.reference_type && autoTypes.includes(entry.reference_type)) {
    throw new ServiceError('Jurnal otomatis (dari simpanan/pinjaman) tidak dapat dihapus langsung. Gunakan fitur Koreksi.', 400);
  }

  await database.transaction(async () => {
    await database.run(`DELETE FROM journal_lines WHERE journal_entry_id = $1`, [id]);
    await database.run(`DELETE FROM journal_entries WHERE id = $1`, [id]);
  })();

  return { description: entry.description, reference_type: entry.reference_type };
}

export async function getTrialBalanceReport(
  database: Db,
  startDate?: string,
  endDate?: string
): Promise<any[]> {
  let obFilter = '';
  let perFilter = '';
  const params: any[] = [];
  
  if (startDate) {
    obFilter = 'AND j.transaction_date < ?';
    perFilter = 'AND j.transaction_date >= ?';
    params.push(startDate, startDate);
  } else {
    obFilter = 'AND 1=0';
  }
  if (endDate) {
    perFilter += ' AND j.transaction_date <= ?';
    params.push(endDate);
  }

  const query = `
    WITH OB AS (
      SELECT 
        l.account_id,
        SUM(l.debit) as ob_debit,
        SUM(l.credit) as ob_credit
      FROM journal_lines l
      JOIN journal_entries j ON l.journal_entry_id = j.id
      WHERE 1=1 ${obFilter}
      GROUP BY l.account_id
    ),
    PER AS (
      SELECT
        l.account_id,
        SUM(l.debit) as per_debit,
        SUM(l.credit) as per_credit
      FROM journal_lines l
      JOIN journal_entries j ON l.journal_entry_id = j.id
      WHERE 1=1 ${perFilter}
      GROUP BY l.account_id
    )
    SELECT 
      a.id, a.code, a.name, a.type, a.normal_balance,
      COALESCE(PER.per_debit, 0) as total_debit,
      COALESCE(PER.per_credit, 0) as total_credit,
      CASE 
        WHEN a.normal_balance = 'DEBIT' THEN COALESCE(OB.ob_debit, 0) - COALESCE(OB.ob_credit, 0)
        ELSE COALESCE(OB.ob_credit, 0) - COALESCE(OB.ob_debit, 0)
      END as opening_balance,
      CASE 
        WHEN a.normal_balance = 'DEBIT' THEN (COALESCE(OB.ob_debit, 0) - COALESCE(OB.ob_credit, 0)) + COALESCE(PER.per_debit, 0) - COALESCE(PER.per_credit, 0)
        ELSE (COALESCE(OB.ob_credit, 0) - COALESCE(OB.ob_debit, 0)) + COALESCE(PER.per_credit, 0) - COALESCE(PER.per_debit, 0)
      END as balance
    FROM accounts a
    LEFT JOIN OB ON a.id = OB.account_id
    LEFT JOIN PER ON a.id = PER.account_id
    WHERE (COALESCE(OB.ob_debit, 0) + COALESCE(OB.ob_credit, 0) + COALESCE(PER.per_debit, 0) + COALESCE(PER.per_credit, 0)) > 0
    ORDER BY a.code ASC
  `;

  return database.query(query).all(...params);
}

export async function getGeneralLedgerReport(
  database: Db,
  accountId: string,
  startDate?: string,
  endDate?: string
): Promise<any> {
  const account = await database.query(`SELECT * FROM accounts WHERE id = ?`).get(accountId);
  if (!account) return null;

  let openingBalance = 0;
  if (startDate) {
    const obQuery = `
      SELECT COALESCE(SUM(l.debit), 0) as total_debit, COALESCE(SUM(l.credit), 0) as total_credit
      FROM journal_lines l
      JOIN journal_entries j ON l.journal_entry_id = j.id
      WHERE l.account_id = ? AND j.transaction_date < ?
    `;
    const obRes = (await database.query(obQuery).get(accountId, startDate)) as any;
    if (obRes) {
      if ((account as any).normal_balance === 'DEBIT') {
        openingBalance = Number(obRes.total_debit) - Number(obRes.total_credit);
      } else {
        openingBalance = Number(obRes.total_credit) - Number(obRes.total_debit);
      }
    }
  }

  let txQuery = `
    SELECT 
      l.id,
      j.transaction_date,
      j.reference_type,
      j.reference_id,
      j.description as journal_description,
      l.description as line_description,
      l.debit,
      l.credit
    FROM journal_lines l
    JOIN journal_entries j ON l.journal_entry_id = j.id
    WHERE l.account_id = ?
  `;
  const params: any[] = [accountId];

  if (startDate) {
    txQuery += ` AND j.transaction_date >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    txQuery += ` AND j.transaction_date <= ?`;
    params.push(endDate);
  }

  txQuery += ` ORDER BY j.transaction_date ASC, j.created_at ASC`;

  const transactions = ((await database.query(txQuery).all(...params)) as any[]) || [];

  let runningBalance = openingBalance;
  for (const tx of transactions) {
    const d = Number(tx.debit || 0);
    const c = Number(tx.credit || 0);
    if ((account as any).normal_balance === 'DEBIT') {
      runningBalance += d - c;
    } else {
      runningBalance += c - d;
    }
    tx.balance = runningBalance;
  }

  return {
    account,
    openingBalance,
    transactions,
    closingBalance: runningBalance,
  };
}
