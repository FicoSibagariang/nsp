import type { Db } from "../db";
import type { LoanRow, LoanScheduleRow, LoanPaymentRow } from "../db/entities";
import { addMonthsYmd, resolveCalendarDateIso, generateLoanDueDates } from "../lib/dates";
import { ServiceError } from "./errors";
import { recordAutoJournal } from "./accountingService";
import { notifyLoanRejection } from "./waNotificationService";
import {
  calculateLoanInterest,
  getPaymentTolerance,
  buildAmortizationSchedule,
  type AmortizationRow,
} from "../lib/calculations";

export {
  calculateLoanInterest,
  getPaymentTolerance,
  buildAmortizationSchedule,
  type AmortizationRow,
};

export type CreateLoanInput = {
  id?: string;
  memberId: string;
  name: string;
  amount: number;
  tenor: number;
  purpose: string;
  status: string;
  /** Optional backdated loan date as YYYY-MM-DD */
  loanDate?: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
};

export async function createLoan(database: Db, input: CreateLoanInput): Promise<{ id: string }> {
  const id = input.id ?? crypto.randomUUID();
  const createdAt = resolveCalendarDateIso(input.loanDate);

  const insert = database.prepare(`
    INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt, "attachmentUrl", "attachmentName")
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  await insert.run(
    id,
    input.memberId,
    input.name,
    input.amount,
    input.tenor,
    input.purpose,
    input.status,
    createdAt,
    input.attachmentUrl ?? null,
    input.attachmentName ?? null
  );

  return { id };
}

export async function getBungaRatePercent(database: Db): Promise<number> {
  const bungaSetting = await database
    .query("SELECT value FROM settings WHERE key = 'bungaPinjaman'")
    .get<{ value: string }>();
  return parseFloat(bungaSetting?.value || "0");
}

export async function resolveLoanTotalAmount(database: Db, loan: LoanRow): Promise<number> {
  if (loan.approvedAt && loan.totalAmount !== null) {
    return Number(loan.totalAmount);
  }

  const bungaRate = await getBungaRatePercent(database);
  return calculateLoanInterest(loan.amount, loan.tenor, bungaRate).totalAmount;
}

export function enrichLoanForList(loan: LoanRow & { paidAmount?: number }, bungaRate: number) {
  if (loan.approvedAt && loan.totalAmount !== null) {
    return {
      ...loan,
      interestAmount: loan.interestAmount,
      totalAmount: loan.totalAmount,
    };
  }

  const { interestAmount, totalAmount } = calculateLoanInterest(loan.amount, loan.tenor, bungaRate);
  return {
    ...loan,
    interestAmount,
    totalAmount,
  };
}

/**
 * Write (or replace) installment rows for a loan using annuity amortization.
 * Does not touch loan_payments; call rebuildLoanPaymentAllocations after replace.
 */
async function writeInstallmentSchedule(
  database: Db,
  loan: { id: string; amount: number; tenor: string | number; createdAt?: string | null },
  bungaRatePercent: number,
  options?: { firstInstallmentDate?: string; replaceExisting?: boolean }
): Promise<ReturnType<typeof buildAmortizationSchedule>> {
  const schedule = buildAmortizationSchedule(loan.amount, loan.tenor, bungaRatePercent);
  const tenorMonths = schedule.rows.length;

  await database.run(
    `UPDATE loans SET interestRate = ?, monthlyPayment = ?, totalAmount = ?, interestAmount = ? WHERE id = ?`,
    [bungaRatePercent, schedule.monthlyPayment, schedule.totalAmount, schedule.interestAmount, loan.id]
  );

  if (options?.replaceExisting) {
    await database.run(`DELETE FROM loan_schedules WHERE loanId = ?`, [loan.id]);
  }

  // Determine installment due dates
  let dueDates: string[] = [];
  if (options?.firstInstallmentDate) {
    dueDates = generateLoanDueDates(options.firstInstallmentDate, tenorMonths);
  } else {
    // Base schedule on loan createdAt so backdated loans get historical due dates
    let baseDate = loan.createdAt ? new Date(loan.createdAt) : new Date();
    if (Number.isNaN(baseDate.getTime())) {
      baseDate = new Date();
    }
    for (const row of schedule.rows) {
      dueDates.push(addMonthsYmd(baseDate, row.installmentNo));
    }
  }

  for (let i = 0; i < schedule.rows.length; i++) {
    const row = schedule.rows[i];
    const dueDate = dueDates[i];

    await database.run(
      `
      INSERT INTO loan_schedules (id, loanId, installmentNo, dueDate, principalAmount, interestAmount, paidAmount, status)
      VALUES (?, ?, ?, ?, ?, ?, 0, 'Pending')
      ON CONFLICT (loanId, installmentNo) DO NOTHING
    `,
      [
        `${loan.id}-${row.installmentNo}`,
        loan.id,
        row.installmentNo,
        dueDate,
        row.principalAmount,
        row.interestAmount,
      ]
    );
  }

  await database.run(`UPDATE loans SET scheduleGenerated = TRUE, totalInstallments = ? WHERE id = ?`, [
    tenorMonths,
    loan.id,
  ]);

  return schedule;
}

async function generateInstallmentSchedule(
  database: Db,
  loan: { id: string; amount: number; tenor: string | number; createdAt?: string | null },
  bungaRatePercent: number,
  _interestAmount: number,
  _totalAmount: number,
  options?: { firstInstallmentDate?: string; replaceExisting?: boolean }
): Promise<void> {
  await writeInstallmentSchedule(database, loan, bungaRatePercent, options);
}

export type ScheduleRowInput = {
  installmentNo: number;
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
};

function assertEditableApprovedLoan(loan: LoanRow | null): asserts loan is LoanRow {
  if (!loan || loan.deletedAt) {
    throw new ServiceError("Loan not found", 404);
  }
  if (loan.status !== "Disetujui" && loan.status !== "Lunas" && loan.status !== "Macet") {
    throw new ServiceError("Jadwal hanya bisa diubah untuk pinjaman yang sudah disetujui", 400);
  }
}

export async function getLoanSchedule(
  database: Db,
  loanId: string
): Promise<LoanScheduleRow[]> {
  const loan = await database.query("SELECT id FROM loans WHERE id = ? AND deletedAt IS NULL").get(loanId);
  if (!loan) {
    throw new ServiceError("Loan not found", 404);
  }
  return database
    .query(
      `SELECT id, loanId, installmentNo, dueDate, principalAmount, interestAmount, paidAmount, status, lateFee, paidAt
       FROM loan_schedules WHERE loanId = ? ORDER BY installmentNo ASC`
    )
    .all<LoanScheduleRow>(loanId);
}

/**
 * Rebuild schedule with annuity formula.
 * Preserves loan_payments and re-allocates them onto the new schedule.
 * @param options.interestRate — override rate (% p.a.); else uses loan snapshot / global setting
 */
export async function regenerateLoanInstallmentSchedule(
  database: Db,
  loanId: string,
  options?: { interestRate?: number }
): Promise<{ rows: number; monthlyPayment: number; interestRate: number; totalAmount: number }> {
  return database.transaction(async () => {
    const loan = await database.query("SELECT * FROM loans WHERE id = ?").get<LoanRow>(loanId);
    assertEditableApprovedLoan(loan);

    let bungaRatePercent: number;
    if (options?.interestRate != null && Number.isFinite(options.interestRate)) {
      bungaRatePercent = Number(options.interestRate);
    } else {
      const snapRate = loan.interestRate != null ? Number(loan.interestRate) : NaN;
      bungaRatePercent = Number.isFinite(snapRate)
        ? snapRate
        : await getBungaRatePercent(database);
    }

    // Prefer disbursement/approval date for due-date base
    const baseIso = loan.approvedAt || loan.createdAt;
    const schedule = await writeInstallmentSchedule(
      database,
      {
        id: loan.id,
        amount: Number(loan.amount),
        tenor: loan.tenor,
        createdAt: baseIso,
      },
      bungaRatePercent,
      { replaceExisting: true }
    );

    await rebuildLoanPaymentAllocations(database, loanId);

    return {
      rows: schedule.rows.length,
      monthlyPayment: schedule.monthlyPayment,
      interestRate: bungaRatePercent,
      totalAmount: schedule.totalAmount,
    };
  })();
}

/**
 * Replace installment schedule with manually provided rows.
 * Sum of principalAmount must equal loan principal. Re-allocates existing payments.
 */
export async function replaceLoanInstallmentSchedule(
  database: Db,
  loanId: string,
  rows: ScheduleRowInput[]
): Promise<{ rows: number; totalAmount: number; interestAmount: number }> {
  return database.transaction(async () => {
    const loan = await database.query("SELECT * FROM loans WHERE id = ?").get<LoanRow>(loanId);
    assertEditableApprovedLoan(loan);

    if (!rows.length) {
      throw new ServiceError("Jadwal angsuran tidak boleh kosong", 400);
    }

    const sorted = [...rows].sort((a, b) => a.installmentNo - b.installmentNo);
    for (let i = 0; i < sorted.length; i++) {
      const row = sorted[i];
      if (row.installmentNo !== i + 1) {
        throw new ServiceError(`Nomor cicilan harus berurutan 1…${sorted.length}`, 400);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.dueDate)) {
        throw new ServiceError(`Format tanggal cicilan #${row.installmentNo} harus YYYY-MM-DD`, 400);
      }
      if (!Number.isFinite(row.principalAmount) || row.principalAmount < 0) {
        throw new ServiceError(`Pokok cicilan #${row.installmentNo} tidak valid`, 400);
      }
      if (!Number.isFinite(row.interestAmount) || row.interestAmount < 0) {
        throw new ServiceError(`Biaya admin cicilan #${row.installmentNo} tidak valid`, 400);
      }
    }

    const sumPrincipal = sorted.reduce((s, r) => s + Math.round(r.principalAmount), 0);
    const principal = Math.round(Number(loan.amount));
    if (sumPrincipal !== principal) {
      throw new ServiceError(
        `Jumlah pokok jadwal (${sumPrincipal}) harus sama dengan plafon pinjaman (${principal})`,
        400
      );
    }

    const sumInterest = sorted.reduce((s, r) => s + Math.round(r.interestAmount), 0);
    const totalAmount = sumPrincipal + sumInterest;
    const tenorMonths = sorted.length;
    const monthlyPayment = Math.ceil(totalAmount / tenorMonths);

    await database.run(`DELETE FROM loan_schedules WHERE loanId = ?`, [loanId]);

    for (const row of sorted) {
      await database.run(
        `
        INSERT INTO loan_schedules (id, loanId, installmentNo, dueDate, principalAmount, interestAmount, paidAmount, status)
        VALUES (?, ?, ?, ?, ?, ?, 0, 'Pending')
      `,
        [
          `${loanId}-${row.installmentNo}`,
          loanId,
          row.installmentNo,
          row.dueDate,
          Math.round(row.principalAmount),
          Math.round(row.interestAmount),
        ]
      );
    }

    // Keep interestRate snapshot as-is (manual edit may diverge from rate formula)
    await database.run(
      `UPDATE loans SET monthlyPayment = ?, totalAmount = ?, interestAmount = ?,
         scheduleGenerated = TRUE, totalInstallments = ?, tenor = ?
       WHERE id = ?`,
      [monthlyPayment, totalAmount, sumInterest, tenorMonths, tenorMonths, loanId]
    );

    await rebuildLoanPaymentAllocations(database, loanId);

    return { rows: tenorMonths, totalAmount, interestAmount: sumInterest };
  })();
}

/**
 * Regenerate schedules for all active approved/outstanding/paid-off loans.
 * Skips soft-deleted and pending/rejected applications.
 */
export async function regenerateAllLoanInstallmentSchedules(
  database: Db
): Promise<{ processed: number; loanIds: string[] }> {
  const loans = await database
    .query(
      `SELECT id FROM loans
       WHERE deletedAt IS NULL
         AND status IN ('Disetujui', 'Lunas', 'Macet')
       ORDER BY id ASC`
    )
    .all<{ id: string }>();

  const loanIds: string[] = [];
  for (const row of loans) {
    await regenerateLoanInstallmentSchedule(database, row.id);
    loanIds.push(row.id);
  }

  return { processed: loanIds.length, loanIds };
}

export type UpdateLoanStatusOptions = {
  /** YYYY-MM-DD disbursement date; defaults to loan createdAt then today */
  approvedDate?: string;
  /**
   * Per-loan admin fee / interest (% p.a.). When set on approve, overrides global
   * bungaPinjaman for schedule generation and is snapshotted on the loan row.
   */
  interestRate?: number;
  /**
   * Optional source cash/bank account UUID for disbursement auto-journal.
   * Defaults to Bank Mandiri (11102) if omitted.
   */
  paymentSourceAccountId?: string;
  /**
   * Optional first installment due date (YYYY-MM-DD).
   * When set, used as the starting point for generating installment due dates.
   */
  firstInstallmentDate?: string;
  /**
   * Optional rejection reason when status is 'Ditolak'.
   */
  rejectionReason?: string | null;
};

export async function updateLoanStatus(
  database: Db,
  loanId: string,
  status: string,
  options?: UpdateLoanStatusOptions
): Promise<{ before: Pick<LoanRow, "status" | "memberId"> | null }> {
  if (status === "Disetujui") {
    await database.transaction(async () => {
      const loan = (await database
        .query(`
          SELECT l.id, l.amount, l.tenor, l.scheduleGenerated, l.createdAt,
                 COALESCE(m.name, l.name) as borrower_name
          FROM loans l
          LEFT JOIN members m ON l.memberId = m.id
          WHERE l.id = ?
        `)
        .get(loanId)) as {
        id: string;
        amount: number;
        tenor: string;
        scheduleGenerated: boolean;
        createdAt: string | null;
        borrower_name: string;
      } | null;

      // Prefer explicit approvedDate (from approve UI), else loan application date, else now.
      // Also align createdAt so cashflow/LoansTx (pencairan) show the historical date.
      let approvedAt: string;
      if (options?.approvedDate) {
        approvedAt = resolveCalendarDateIso(options.approvedDate);
      } else if (loan?.createdAt) {
        const parsed = new Date(loan.createdAt);
        approvedAt = Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
      } else {
        approvedAt = new Date().toISOString();
      }

      const stmt = database.prepare(
        `UPDATE loans SET status = ?, approvedAt = ?, createdAt = ?, rejection_reason = NULL WHERE id = ?`
      );
      await stmt.run(status, approvedAt, approvedAt, loanId);

      const globalRate = await getBungaRatePercent(database);
      const bungaRatePercent =
        options?.interestRate != null && Number.isFinite(options.interestRate)
          ? Number(options.interestRate)
          : globalRate;

      if (loan && !loan.scheduleGenerated) {
        const loanForSchedule = { ...loan, createdAt: approvedAt, amount: Number(loan.amount) };
        const { interestAmount, totalAmount } = calculateLoanInterest(
          loanForSchedule.amount,
          loan.tenor,
          bungaRatePercent
        );
        await generateInstallmentSchedule(
          database,
          loanForSchedule,
          bungaRatePercent,
          interestAmount,
          totalAmount,
          { firstInstallmentDate: options?.firstInstallmentDate }
        );
      }

      if (loan) {
        let kasCode = '11102'; // default Bank Mandiri
        if (options?.paymentSourceAccountId) {
          const acc = (await database
            .query("SELECT code FROM accounts WHERE id = ?")
            .get(options.paymentSourceAccountId)) as { code?: string } | null;
          if (acc?.code) {
            kasCode = acc.code;
          }
        }

        // Fail-fast auto journal for loan disbursement (must rollback if fails)
        await recordAutoJournal({
          transaction_date: approvedAt,
          description: `Pencairan Pinjaman Anggota — ${loan.borrower_name}`,
          reference_type: 'loan_disbursement',
          reference_id: loanId,
          lines: [
            { account_code: '11201', debit: loan.amount }, // Piutang
            { account_code: kasCode, credit: loan.amount } // Kas/Bank Keluar
          ]
        });
      }
    })();
  } else if (status === "Ditolak") {
    const reason = options?.rejectionReason?.trim() || null;
    const stmt = database.prepare(`UPDATE loans SET status = ?, rejection_reason = ? WHERE id = ?`);
    await stmt.run(status, reason, loanId);

    // Sync to mobile loan_applications if linked
    try {
      await database.run(
        `UPDATE loan_applications
         SET status = 'rejected', rejection_reason = ?, decided_at = NOW(), updated_at = NOW()
         WHERE (external_id = ? OR reference = ?) AND status = 'pending_approval'`,
        [reason, loanId, loanId]
      );
    } catch {
      // Mobile table might not be present or no match
    }

    // Send WhatsApp notification if member has phone number
    try {
      const loanInfo = (await database
        .query(`
          SELECT l.id, l.amount, COALESCE(m.name, l.name) as borrower_name, m.phone
          FROM loans l
          LEFT JOIN members m ON l.memberId = m.id
          WHERE l.id = ?
        `)
        .get(loanId)) as { id: string; amount: number; borrower_name: string; phone?: string | null } | null;

      if (loanInfo) {
        await notifyLoanRejection({
          memberName: loanInfo.borrower_name,
          memberPhone: loanInfo.phone || undefined,
          amount: Number(loanInfo.amount),
          reason: reason || 'Kriteria belum memenuhi persyaratan koperasi.',
          db: database,
        });
      }
    } catch (notifErr) {
      console.warn("Gagal mengirim notifikasi penolakan pinjaman:", notifErr);
    }
  } else {
    const stmt = database.prepare(`UPDATE loans SET status = ? WHERE id = ?`);
    await stmt.run(status, loanId);
  }

  const before = await database
    .query("SELECT status, memberId FROM loans WHERE id = ?")
    .get<Pick<LoanRow, "status" | "memberId">>(loanId);

  return { before };
}

export type RecordPaymentInput = {
  amount: number;
  method: string;
  /** Optional backdated payment date as YYYY-MM-DD */
  paymentDate?: string;
};

export type UpdatePaymentInput = {
  amount?: number;
  method?: string;
  /** Optional backdated payment date as YYYY-MM-DD */
  paymentDate?: string;
};

type PaymentRow = {
  id: string;
  loanId: string;
  amount: number;
  paymentDate: string;
  method: string;
};

/**
 * Reset schedule allocations and re-apply all payments in chronological order.
 * Keeps loan_payments rows as source of truth after edit/delete.
 */
export async function rebuildLoanPaymentAllocations(database: Db, loanId: string): Promise<void> {
  const loan = await database.query("SELECT * FROM loans WHERE id = ?").get<LoanRow>(loanId);
  if (!loan) {
    throw new ServiceError("Loan not found", 404);
  }

  // Reset schedules
  await database.run(
    `UPDATE loan_schedules
     SET paidAmount = 0, status = 'Pending', updatedAt = CURRENT_TIMESTAMP
     WHERE loanId = ?`,
    [loanId]
  );

  // Reset loan status away from Lunas/Macet while rebuilding (unless no schedule and unpaid)
  if (loan.status === "Lunas" || loan.status === "Macet") {
    await database.run(`UPDATE loans SET status = 'Disetujui', paidInstallments = 0 WHERE id = ?`, [loanId]);
  } else {
    await database.run(`UPDATE loans SET paidInstallments = 0 WHERE id = ?`, [loanId]);
  }

  const payments = await database
    .query(
      `SELECT id, loanId, amount, paymentDate, method FROM loan_payments
       WHERE loanId = ?
       ORDER BY paymentDate ASC, id ASC`
    )
    .all<PaymentRow>(loanId);

  const totalAmount = await resolveLoanTotalAmount(database, loan);
  let totalPaid = 0;

  for (const payment of payments) {
    totalPaid += Number(payment.amount);
    await allocatePaymentToSchedules(database, loanId, Number(payment.amount), payment.paymentDate);
  }

  const paidInstallmentCount = await database
    .query(`SELECT COUNT(*) as count FROM loan_schedules WHERE loanId = ? AND status = 'Paid'`)
    .get<{ count: number }>(loanId);
  await database.run(`UPDATE loans SET paidInstallments = ? WHERE id = ?`, [
    Number(paidInstallmentCount?.count || 0),
    loanId,
  ]);

  const scheduleCount = await database
    .query(`SELECT COUNT(*) as count FROM loan_schedules WHERE loanId = ?`)
    .get<{ count: number }>(loanId);

  if (Number(scheduleCount?.count || 0) > 0) {
    const remainingPending = await database
      .query(`SELECT COUNT(*) as count FROM loan_schedules WHERE loanId = ? AND status IN ('Pending', 'Late')`)
      .get<{ count: number }>(loanId);

    if (Number(remainingPending?.count || 0) === 0 && payments.length > 0) {
      await database.run(`UPDATE loans SET status = 'Lunas', paidInstallments = totalInstallments WHERE id = ?`, [
        loanId,
      ]);
    } else {
      // Mark overdue installments
      const now = new Date();
      const overdue = await database
        .query(
          `SELECT dueDate FROM loan_schedules
           WHERE loanId = ? AND status = 'Pending' AND dueDate < CURRENT_DATE
           ORDER BY dueDate ASC LIMIT 1`
        )
        .get<{ dueDate: string }>(loanId);

      if (overdue?.dueDate) {
        const dpd = Math.floor(
          (now.getTime() - new Date(overdue.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (dpd >= 90) {
          await database.run(`UPDATE loans SET status = 'Macet' WHERE id = ?`, [loanId]);
        }
        await database.run(
          `UPDATE loan_schedules SET status = 'Late', updatedAt = CURRENT_TIMESTAMP
           WHERE loanId = ? AND status = 'Pending' AND dueDate < CURRENT_DATE`,
          [loanId]
        );
      } else if (loan.status === "Lunas" || loan.status === "Macet") {
        // already reset to Disetujui above when rebuilding
      } else if (payments.length > 0 && (totalAmount - totalPaid) > getPaymentTolerance()) {
        await database.run(`UPDATE loans SET status = 'Disetujui' WHERE id = ? AND status = 'Lunas'`, [loanId]);
      }
    }
  } else if ((totalAmount - totalPaid) <= getPaymentTolerance() && payments.length > 0) {
    await database.run(`UPDATE loans SET status = 'Lunas' WHERE id = ?`, [loanId]);
  } else if (loan.status === "Lunas" && (totalAmount - totalPaid) > getPaymentTolerance()) {
    await database.run(`UPDATE loans SET status = 'Disetujui' WHERE id = ?`, [loanId]);
  }
}

async function allocatePaymentToSchedules(
  database: Db,
  loanId: string,
  amount: number,
  paymentDateIso: string
): Promise<void> {
  let allocatedAmount = amount;
  const schedules = await database
    .query(
      `SELECT * FROM loan_schedules
       WHERE loanId = ? AND status IN ('Pending', 'Late')
       ORDER BY installmentNo ASC`
    )
    .all<LoanScheduleRow>(loanId);

  if (schedules.length === 0) return;

  const asOf = new Date(paymentDateIso);
  const dendaSetting = await database
    .query("SELECT value FROM settings WHERE key = 'denda'")
    .get<{ value: string }>();
  const dendaPercent = parseFloat(dendaSetting?.value || "0");
  const tolerance = getPaymentTolerance();

  for (const schedule of schedules) {
    if (allocatedAmount <= 0) break;

    const dueDate = new Date(schedule.dueDate);
    const daysLate = Math.floor((asOf.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const lateFee =
      daysLate > 0 ? Math.round(Number(schedule.principalAmount) * (dendaPercent / 100)) : 0;

    const totalDue = Number(schedule.principalAmount) + Number(schedule.interestAmount) + lateFee;
    const paymentForThisInstallment = Math.min(
      allocatedAmount,
      totalDue - Number(schedule.paidAmount || 0)
    );

    if (paymentForThisInstallment <= 0) continue;

    const newPaidAmount = Number(schedule.paidAmount || 0) + paymentForThisInstallment;
    const isFullyPaid = (totalDue - newPaidAmount) <= tolerance;

    await database.run(
      `UPDATE loan_schedules SET paidAmount = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      [newPaidAmount, isFullyPaid ? "Paid" : "Pending", schedule.id]
    );

    allocatedAmount -= paymentForThisInstallment;
  }
}

export async function recordLoanPayment(
  database: Db,
  loanId: string,
  input: RecordPaymentInput
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  const paymentDate = resolveCalendarDateIso(input.paymentDate);

  await database.transaction(async () => {
    const loan = await database.query(`
      SELECT l.*, COALESCE(m.name, l.name) as borrower_name 
      FROM loans l
      LEFT JOIN members m ON l.memberId = m.id
      WHERE l.id = ? FOR UPDATE OF l
    `).get(loanId) as (LoanRow & { borrower_name: string }) | null;
    if (!loan) {
      throw new ServiceError("Loan not found", 404);
    }

    const totalAmount = await resolveLoanTotalAmount(database, loan);
    const paid = Number(
      (
        await database
          .query("SELECT SUM(amount) as paid FROM loan_payments WHERE loanId = ?")
          .get<{ paid: number | null }>(loanId)
      )?.paid || 0
    );

    if (paid + input.amount > totalAmount) {
      throw new ServiceError("Total pembayaran melebihi jumlah pinjaman");
    }

    const schedulesBefore = await database
      .query("SELECT id, principalAmount, interestAmount, paidAmount FROM loan_schedules WHERE loanId = ? ORDER BY installmentNo ASC")
      .all<{ id: string; principalAmount: number; interestAmount: number; paidAmount: number }>(loanId);

    await database
      .prepare(
        `INSERT INTO loan_payments (id, loanId, amount, paymentDate, method)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, loanId, input.amount, paymentDate, input.method);

    await rebuildLoanPaymentAllocations(database, loanId);

    const schedulesAfter = await database
      .query("SELECT id, principalAmount, interestAmount, paidAmount FROM loan_schedules WHERE loanId = ? ORDER BY installmentNo ASC")
      .all<{ id: string; principalAmount: number; interestAmount: number; paidAmount: number }>(loanId);
    
    // Otomatisasi Jurnal
    const kasCode = input.method === 'Cash' ? '11101' : '11102';
    let principalPaid = 0;
    let interestPaid = 0;

    if (schedulesBefore.length > 0) {
      const scheduleAfterMap = new Map(schedulesAfter.map(s => [s.id, s]));
      for (const sBefore of schedulesBefore) {
        const sAfter = scheduleAfterMap.get(sBefore.id);
        if (!sAfter) continue;

        const P = Number(sBefore.principalAmount || 0);
        const I = Number(sBefore.interestAmount || 0);

        const paidBefore = Number(sBefore.paidAmount || 0);
        const paidAfter = Number(sAfter.paidAmount || 0);

        const interestBefore = Math.min(I, paidBefore);
        const principalBefore = Math.max(0, Math.min(P, paidBefore - I));

        const interestAfter = Math.min(I, paidAfter);
        const principalAfter = Math.max(0, Math.min(P, paidAfter - I));

        interestPaid += (interestAfter - interestBefore);
        principalPaid += (principalAfter - principalBefore);
      }

      const allocated = principalPaid + interestPaid;
      if (allocated < input.amount) {
        principalPaid += (input.amount - allocated);
      }
    } else {
      const principalRatio = Number(loan.amount) / totalAmount;
      principalPaid = Math.round(input.amount * principalRatio);
      interestPaid = input.amount - principalPaid;
    }

    // Fail-fast auto journal for loan payment
    await recordAutoJournal({
      transaction_date: paymentDate,
      description: `Pembayaran Cicilan Pinjaman — ${loan.borrower_name}`,
      reference_type: 'loan_payment',
      reference_id: id,
      lines: [
        { account_code: kasCode, debit: input.amount }, // Kas Masuk
        { account_code: '11201', credit: principalPaid }, // Piutang Berkurang
        { account_code: '41101', credit: interestPaid } // Pendapatan Bunga
      ]
    });
  })();

  return { id };
}

export async function updateLoanPayment(
  database: Db,
  loanId: string,
  paymentId: string,
  input: UpdatePaymentInput
): Promise<{ before: PaymentRow; after: PaymentRow }> {
  let before: PaymentRow | null = null;
  let after: PaymentRow | null = null;

  await database.transaction(async () => {
    const loan = await database.query("SELECT * FROM loans WHERE id = ? FOR UPDATE").get<LoanRow>(loanId);
    if (!loan) {
      throw new ServiceError("Loan not found", 404);
    }

    const existing = await database
      .query("SELECT id, loanId, amount, paymentDate, method FROM loan_payments WHERE id = ? AND loanId = ?")
      .get<PaymentRow>(paymentId, loanId);

    if (!existing) {
      throw new ServiceError("Pembayaran tidak ditemukan", 404);
    }
    before = existing;

    const nextAmount = input.amount != null ? Number(input.amount) : Number(existing.amount);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      throw new ServiceError("Nominal pembayaran harus lebih dari 0", 400);
    }

    const nextMethod = input.method?.trim() || existing.method;
    const nextPaymentDate = input.paymentDate
      ? resolveCalendarDateIso(input.paymentDate)
      : existing.paymentDate;

    const totalAmount = await resolveLoanTotalAmount(database, loan);
    const otherPaid = Number(
      (
        await database
          .query(
            "SELECT COALESCE(SUM(amount), 0) as paid FROM loan_payments WHERE loanId = ? AND id != ?"
          )
          .get<{ paid: number }>(loanId, paymentId)
      )?.paid || 0
    );

    if (otherPaid + nextAmount > totalAmount) {
      throw new ServiceError("Total pembayaran melebihi jumlah pinjaman", 400);
    }

    await database.run(
      `UPDATE loan_payments SET amount = ?, paymentDate = ?, method = ? WHERE id = ? AND loanId = ?`,
      [nextAmount, nextPaymentDate, nextMethod, paymentId, loanId]
    );

    await rebuildLoanPaymentAllocations(database, loanId);

    after = await database
      .query("SELECT id, loanId, amount, paymentDate, method FROM loan_payments WHERE id = ?")
      .get<PaymentRow>(paymentId);
  })();

  if (!before || !after) {
    throw new ServiceError("Pembayaran tidak ditemukan", 404);
  }
  return { before, after };
}

export async function deleteLoanPayment(
  database: Db,
  loanId: string,
  paymentId: string
): Promise<{ before: PaymentRow }> {
  let before: PaymentRow | null = null;

  await database.transaction(async () => {
    const loan = await database.query("SELECT * FROM loans WHERE id = ? FOR UPDATE").get<LoanRow>(loanId);
    if (!loan) {
      throw new ServiceError("Loan not found", 404);
    }

    const existing = await database
      .query("SELECT id, loanId, amount, paymentDate, method FROM loan_payments WHERE id = ? AND loanId = ?")
      .get<PaymentRow>(paymentId, loanId);

    if (!existing) {
      throw new ServiceError("Pembayaran tidak ditemukan", 404);
    }
    before = existing;

    await database.run(`DELETE FROM loan_payments WHERE id = ? AND loanId = ?`, [paymentId, loanId]);
    await rebuildLoanPaymentAllocations(database, loanId);
  })();

  if (!before) {
    throw new ServiceError("Pembayaran tidak ditemukan", 404);
  }
  return { before };
}

/**
 * Update pencairan / disbursement date for an already-approved loan.
 * Aligns approvedAt + createdAt (cashflow / LoansTx) and shifts schedule due dates.
 */
export async function updateLoanDisbursementDate(
  database: Db,
  loanId: string,
  disbursementDate: string
): Promise<{ before: { approvedAt: string | null; createdAt: string | null }; after: { approvedAt: string; createdAt: string } }> {
  const iso = resolveCalendarDateIso(disbursementDate);
  let before: { approvedAt: string | null; createdAt: string | null } = {
    approvedAt: null,
    createdAt: null,
  };

  await database.transaction(async () => {
    const loan = await database
      .query(
        `SELECT id, status, approvedAt, createdAt, scheduleGenerated
         FROM loans WHERE id = ? AND deletedAt IS NULL FOR UPDATE`
      )
      .get<{
        id: string;
        status: string;
        approvedAt: string | null;
        createdAt: string | null;
        scheduleGenerated: boolean;
      }>(loanId);

    if (!loan) {
      throw new ServiceError("Loan not found", 404);
    }
    if (loan.status !== "Disetujui" && loan.status !== "Lunas" && loan.status !== "Macet") {
      throw new ServiceError("Hanya pinjaman yang sudah disetujui yang bisa diubah tanggal pencairannya", 400);
    }

    before = { approvedAt: loan.approvedAt, createdAt: loan.createdAt };

    await database.run(`UPDATE loans SET approvedAt = ?, createdAt = ? WHERE id = ?`, [
      iso,
      iso,
      loanId,
    ]);

    // Shift installment due dates from the new disbursement base
    const schedules = await database
      .query(
        `SELECT id, installmentNo FROM loan_schedules WHERE loanId = ? ORDER BY installmentNo ASC`
      )
      .all<{ id: string; installmentNo: number }>(loanId);

    if (schedules.length > 0) {
      const baseDate = new Date(iso);
      for (const row of schedules) {
        const due = addMonthsYmd(baseDate, Number(row.installmentNo));
        await database.run(`UPDATE loan_schedules SET dueDate = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, [
          due,
          row.id,
        ]);
      }
      // Re-apply payments so Late/Lunas status stays consistent with new due dates
      await rebuildLoanPaymentAllocations(database, loanId);
    }
  })();

  return {
    before,
    after: { approvedAt: iso, createdAt: iso },
  };
}

export async function deleteLoan(database: Db, loanId: string): Promise<void> {
  const loan = await database
    .query("SELECT id, status FROM loans WHERE id = ? AND deletedAt IS NULL")
    .get<{ id: string; status: string }>(loanId);

  if (!loan) {
    throw new ServiceError("Loan not found", 404);
  }

  // Soft-delete: stamp deletedAt, keep all FK-referenced payment rows intact
  await database
    .query("UPDATE loans SET deletedAt = ? WHERE id = ?")
    .run(new Date().toISOString(), loanId);
}

// ---------------------------------------------------------------------------
// Batch Loan Import (CSV)
// ---------------------------------------------------------------------------

export type BatchLoanImportItem = {
  nik: string;
  loan_id?: string | null;
  nama_pinjaman: string;
  jumlah: number;
  tenor: number;
  tujuan: string;
  tanggal_pinjaman?: string | null;
  bunga?: number | null;
};

export type BatchLoanImportResult = {
  processedCount: number;
  failedCount: number;
  errors: Array<{ index: number; identifier: string; message: string }>;
};

export async function batchImportLoans(
  database: Db,
  items: BatchLoanImportItem[]
): Promise<BatchLoanImportResult> {
  let processedCount = 0;
  const errors: Array<{ index: number; identifier: string; message: string }> = [];

  const globalRate = await getBungaRatePercent(database);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const identifier = `NIK ${item.nik}`;

    try {
      // 1. Lookup member by NIK
      const cleanNik = String(item.nik).replace(/\D/g, "");
      const member = await database
        .query("SELECT id FROM members WHERE nik = ? AND deletedAt IS NULL LIMIT 1")
        .get<{ id: string }>(cleanNik);

      if (!member) {
        errors.push({ index: i, identifier, message: `Anggota dengan NIK ${item.nik} tidak ditemukan` });
        continue;
      }

      // 2. Create loan (status Menunggu first so we can approve)
      const { id: loanId } = await createLoan(database, {
        id: item.loan_id ?? undefined,
        memberId: member.id,
        name: item.nama_pinjaman,
        amount: item.jumlah,
        tenor: item.tenor,
        purpose: item.tujuan,
        status: "Menunggu",
        loanDate: item.tanggal_pinjaman ?? undefined,
      });

      // 3. Approve loan → auto-generates schedule + auto-journal
      const bungaRate = item.bunga != null ? item.bunga : globalRate;
      await updateLoanStatus(database, loanId, "Disetujui", {
        approvedDate: item.tanggal_pinjaman ?? undefined,
        interestRate: bungaRate,
      });

      processedCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memproses pinjaman";
      errors.push({ index: i, identifier, message: msg });
    }
  }

  return { processedCount, failedCount: errors.length, errors };
}

// ---------------------------------------------------------------------------
// Batch Payment Import / Angsuran (CSV)
// ---------------------------------------------------------------------------

export type BatchPaymentImportItem = {
  nik: string;
  loan_id?: string | null;
  jumlah: number;
  metode: string;
  tanggal?: string | null;
};

export type BatchPaymentImportResult = {
  processedCount: number;
  failedCount: number;
  errors: Array<{ index: number; identifier: string; message: string }>;
};

export async function batchImportPayments(
  database: Db,
  items: BatchPaymentImportItem[]
): Promise<BatchPaymentImportResult> {
  let processedCount = 0;
  const errors: Array<{ index: number; identifier: string; message: string }> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const identifier = `NIK ${item.nik}`;

    try {
      let loanId = item.loan_id || null;

      // If no explicit loan_id, look up via NIK
      if (!loanId) {
        const cleanNik = String(item.nik).replace(/\D/g, "");
        const member = await database
          .query("SELECT id FROM members WHERE nik = ? AND deletedAt IS NULL LIMIT 1")
          .get<{ id: string }>(cleanNik);

        if (!member) {
          errors.push({ index: i, identifier, message: `Anggota dengan NIK ${item.nik} tidak ditemukan` });
          continue;
        }

        // Find active loans
        const activeLoans = await database
          .query(`SELECT id FROM loans WHERE memberId = ? AND status = 'Disetujui' AND deletedAt IS NULL ORDER BY createdAt ASC`)
          .all<{ id: string }>(member.id);

        if (activeLoans.length === 0) {
          errors.push({ index: i, identifier, message: `Tidak ada pinjaman aktif untuk NIK ${item.nik}` });
          continue;
        }

        if (activeLoans.length > 1) {
          errors.push({
            index: i,
            identifier,
            message: `Anggota NIK ${item.nik} memiliki ${activeLoans.length} pinjaman aktif — gunakan kolom loan_id untuk menentukan pinjaman yang dituju`
          });
          continue;
        }

        loanId = activeLoans[0].id;
      }

      await recordLoanPayment(database, loanId, {
        amount: item.jumlah,
        method: item.metode,
        paymentDate: item.tanggal ?? undefined,
      });

      processedCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memproses angsuran";
      errors.push({ index: i, identifier, message: msg });
    }
  }

  return { processedCount, failedCount: errors.length, errors };
}

// ---------------------------------------------------------------------------
// Batch Schedule Import / Jadwal Angsuran (CSV)
// ---------------------------------------------------------------------------

export type BatchScheduleImportItem = {
  loan_id: string;
  cicilan_ke: number;
  tanggal_jatuh_tempo: string;
  pokok: number;
  bunga: number;
};

export type BatchScheduleImportResult = {
  processedCount: number;
  failedCount: number;
  errors: Array<{ identifier: string; message: string }>;
};

export async function batchImportSchedules(
  database: Db,
  items: BatchScheduleImportItem[]
): Promise<BatchScheduleImportResult> {
  let processedCount = 0;
  const errors: Array<{ identifier: string; message: string }> = [];

  // Group by loan_id
  const groups: Record<string, BatchScheduleImportItem[]> = {};
  for (const item of items) {
    if (!groups[item.loan_id]) {
      groups[item.loan_id] = [];
    }
    groups[item.loan_id].push(item);
  }

  for (const loanId of Object.keys(groups)) {
    const groupItems = groups[loanId];
    
    try {
      const loan = await database.query("SELECT * FROM loans WHERE id = ? AND deletedAt IS NULL").get<LoanRow>(loanId);
      if (!loan) {
        errors.push({ identifier: `Loan ${loanId}`, message: `Pinjaman dengan ID ${loanId} tidak ditemukan atau sudah dihapus` });
        continue;
      }

      const rows: ScheduleRowInput[] = groupItems.map((item) => ({
        installmentNo: item.cicilan_ke,
        dueDate: item.tanggal_jatuh_tempo,
        principalAmount: item.pokok,
        interestAmount: item.bunga,
      }));

      await replaceLoanInstallmentSchedule(database, loanId, rows);
      processedCount += rows.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memproses jadwal";
      errors.push({ identifier: `Loan ${loanId}`, message: msg });
    }
  }

  return { processedCount, failedCount: errors.length, errors };
}

export type GetLoansListFilter = {
  page: number;
  limit: number;
  includeArchived?: boolean;
  search?: string;
  status?: string;
  memberId?: string;
  fetchAll?: boolean;
};

export async function getLoansList(
  database: Db,
  filter: GetLoansListFilter
): Promise<{ data: LoanRow[]; total: number }> {
  const { page, limit, includeArchived, search, status, memberId, fetchAll } = filter;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (!includeArchived) {
    conditions.push("l.deletedAt IS NULL");
  }

  if (search) {
    conditions.push("(LOWER(COALESCE(m.name, l.name)) LIKE ? OR LOWER(l.purpose) LIKE ? OR LOWER(COALESCE(e.bank_name, '')) LIKE ? OR LOWER(COALESCE(e.bank_account_number, '')) LIKE ?)");
    const pattern = `%${search.toLowerCase()}%`;
    params.push(pattern, pattern, pattern, pattern);
  }

  if (status) {
    conditions.push("l.status = ?");
    params.push(status);
  }

  if (memberId) {
    conditions.push("l.memberId = ?");
    params.push(memberId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limitClause = fetchAll ? "" : "LIMIT ? OFFSET ?";
  const queryParams = fetchAll ? params : [...params, limit, offset];

  const rows = await database
    .query(`
      SELECT 
        l.*, 
        COALESCE(m.name, l.name) as name, 
        COALESCE(SUM(p.amount), 0) as paidAmount,
        e.bank_name as "destinationBank",
        e.bank_account_number as "destinationAccount",
        COALESCE(e.bank_account_holder, e.name, m.name) as "destinationName",
        l.rejection_reason as "rejectionReason"
      FROM loans l
      LEFT JOIN members m ON m.id = l.memberId
      LEFT JOIN loan_payments p ON l.id = p.loanId
      LEFT JOIN employees e ON (e.member_id = m.id OR (m.nik IS NOT NULL AND e.nik = m.nik))
      ${whereClause}
      GROUP BY l.id, m.name, e.bank_name, e.bank_account_number, e.bank_account_holder, e.name
      ORDER BY 
        CASE l.status
          WHEN 'Menunggu' THEN 1
          WHEN 'Disetujui' THEN 2
          WHEN 'Lunas' THEN 3
          WHEN 'Macet' THEN 4
          WHEN 'Ditolak' THEN 5
          ELSE 6
        END ASC,
        l.createdat DESC,
        l.id DESC
      ${limitClause}
    `)
    .all<LoanRow & { paidAmount?: number }>(...queryParams);

  const bungaRate = await getBungaRatePercent(database);
  const mappedLoans = rows.map((loan) => enrichLoanForList(loan, bungaRate));

  const countQuery = `
    SELECT COUNT(DISTINCT l.id) as count
    FROM loans l
    LEFT JOIN members m ON m.id = l.memberId
    LEFT JOIN employees e ON (e.member_id = m.id OR (m.nik IS NOT NULL AND e.nik = m.nik))
    ${whereClause}
  `;
  const totalRes = (await database.query(countQuery).get(...params)) as { count: number } | null;

  return {
    data: mappedLoans,
    total: totalRes?.count ? Number(totalRes.count) : 0,
  };
}

export async function getLoanPaymentSources(
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

export async function getLoanPayrollDeductions(
  database: Db,
  startDate: string,
  endDate: string
): Promise<any[]> {
  return database
    .query(
      `SELECT 
        COALESCE(e.nip, '') as "employeeId",
        COALESCE(m.name, l.name) as "name",
        COALESCE(m.id, l.memberid) as "memberId",
        COUNT(ls.id) as "loanCount",
        SUM(COALESCE(ls.principalamount, 0) + COALESCE(ls.interestamount, 0)) as "amount",
        SUM(COALESCE(ls.principalamount, 0)) as "principalAmount",
        SUM(COALESCE(ls.interestamount, 0)) as "interestAmount"
      FROM loan_schedules ls
      JOIN loans l ON l.id = ls.loanid
      LEFT JOIN members m ON m.id = l.memberid
      LEFT JOIN employees e ON (e.member_id = m.id OR (m.nik IS NOT NULL AND e.nik = m.nik) OR e.name ILIKE l.name)
      WHERE ls.duedate >= ? AND ls.duedate <= ?
        AND (l.deletedat IS NULL)
      GROUP BY COALESCE(e.nip, ''), COALESCE(m.name, l.name), COALESCE(m.id, l.memberid)
      ORDER BY COALESCE(m.name, l.name) ASC`
    )
    .all(startDate, endDate);
}

export async function getLoanPaymentsLedger(
  database: Db,
  limit: number,
  offset: number
): Promise<{ rows: LoanPaymentRow[]; total: number }> {
  const rows = await database
    .query(`
      SELECT * FROM (
        SELECT
          'pencairan' as "type",
          l.id || '-disburse' as "id",
          l.id as "loanId",
          l.amount as "amount",
          COALESCE(l.approvedAt::text, l.createdAt::text) as "paymentDate",
          'Transfer' as "method",
          COALESCE(m.name, l.name) as "borrowerName"
        FROM loans l
        LEFT JOIN members m ON m.id = l.memberId
        WHERE l.status IN ('Disetujui', 'Lunas', 'Macet')
          AND l.deletedAt IS NULL

        UNION ALL

        SELECT
          'angsuran' as "type",
          p.id as "id",
          p.loanId as "loanId",
          p.amount as "amount",
          p.paymentDate as "paymentDate",
          p.method as "method",
          COALESCE(m.name, l.name) as "borrowerName"
        FROM loan_payments p
        INNER JOIN loans l ON p.loanId = l.id AND l.deletedAt IS NULL
        LEFT JOIN members m ON m.id = l.memberId
      ) combined
      ORDER BY "paymentDate" DESC
      LIMIT ? OFFSET ?
    `)
    .all<LoanPaymentRow>(limit, offset);

  const totalRes = (await database
    .query(`
      SELECT (
        (SELECT COUNT(*) FROM loans WHERE status IN ('Disetujui', 'Lunas', 'Macet') AND deletedAt IS NULL) +
        (SELECT COUNT(*) FROM loan_payments p
         INNER JOIN loans l ON p.loanId = l.id AND l.deletedAt IS NULL)
      ) as count
    `)
    .get<{ count: number }>()) as { count: number } | null;

  return {
    rows,
    total: totalRes?.count ?? 0,
  };
}

export async function getLoanPaymentsByLoanId(
  database: Db,
  loanId: string
): Promise<LoanPaymentRow[]> {
  return database
    .query("SELECT * FROM loan_payments WHERE loanId = ? ORDER BY paymentDate DESC")
    .all<LoanPaymentRow>(loanId);
}

export interface SettleLoanPayrollResult {
  periodMonth: string;
  settledSchedulesCount: number;
  settledBorrowersCount: number;
  totalPrincipal: number;
  totalInterest: number;
  totalSettledAmount: number;
  journalEntryId: string | null;
}

export async function getLoanPayrollRecap(
  database: Db,
  startDate: string,
  endDate: string
): Promise<{
  totalSchedules: number;
  paidCount: number;
  unpaidCount: number;
  isSettled: boolean;
  settledAt: string | null;
  totalPrincipal: number;
  totalInterest: number;
  totalAmount: number;
}> {
  const recap = await database.query(`
    SELECT 
      COUNT(ls.id) as total_schedules,
      SUM(CASE WHEN ls.status = 'Paid' THEN 1 ELSE 0 END) as paid_count,
      SUM(CASE WHEN ls.status != 'Paid' THEN 1 ELSE 0 END) as unpaid_count,
      MAX(ls.paidat) as settled_at,
      SUM(COALESCE(ls.principalamount, 0)) as total_principal,
      SUM(COALESCE(ls.interestamount, 0)) as total_interest,
      SUM(COALESCE(ls.principalamount, 0) + COALESCE(ls.interestamount, 0)) as total_amount
    FROM loan_schedules ls
    JOIN loans l ON l.id = ls.loanid
    WHERE ls.duedate >= ? AND ls.duedate <= ?
      AND l.deletedat IS NULL
  `).get<{
    total_schedules: number;
    paid_count: number;
    unpaid_count: number;
    settled_at: string | null;
    total_principal: number;
    total_interest: number;
    total_amount: number;
  }>(startDate, endDate);

  const totalSchedules = Number(recap?.total_schedules || 0);
  const paidCount = Number(recap?.paid_count || 0);
  const unpaidCount = Number(recap?.unpaid_count || 0);
  const isSettled = totalSchedules > 0 && unpaidCount === 0;

  return {
    totalSchedules,
    paidCount,
    unpaidCount,
    isSettled,
    settledAt: recap?.settled_at ? String(recap.settled_at) : null,
    totalPrincipal: Math.round(Number(recap?.total_principal || 0)),
    totalInterest: Math.round(Number(recap?.total_interest || 0)),
    totalAmount: Math.round(Number(recap?.total_amount || 0)),
  };
}

export async function settleLoanPayroll(
  database: Db,
  input: {
    periodMonth: string;
    targetAccountId?: string;
    transactionDate?: string;
  },
  _adminId?: string
): Promise<SettleLoanPayrollResult> {
  const { periodMonth, targetAccountId } = input;
  if (!periodMonth || !/^\d{4}-\d{2}$/.test(periodMonth)) {
    throw new ServiceError("Format periodMonth tidak valid. Gunakan format YYYY-MM", 400);
  }

  const [yearStr, monthStr] = periodMonth.split('-');
  const year = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  const lastDay = new Date(year, m, 0).getDate();
  const startDate = `${periodMonth}-01`;
  const endDate = `${periodMonth}-${String(lastDay).padStart(2, '0')}`;
  const effectiveDate = input.transactionDate || endDate;

  return await database.transaction(async () => {
    // 1. Ambil seluruh jadwal angsuran yang belum Paid pada periode ini
    const pendingSchedules = await database.query(`
      SELECT 
        ls.id as schedule_id,
        ls.loanid as loan_id,
        ls.installmentno as installment_no,
        COALESCE(ls.principalamount, 0) as principal_amount,
        COALESCE(ls.interestamount, 0) as interest_amount,
        COALESCE(ls.paidamount, 0) as paid_amount,
        l.memberid as member_id,
        COALESCE(m.name, l.name) as borrower_name
      FROM loan_schedules ls
      JOIN loans l ON l.id = ls.loanid
      LEFT JOIN members m ON m.id = l.memberid
      WHERE ls.duedate >= ? AND ls.duedate <= ?
        AND ls.status != 'Paid'
        AND l.deletedat IS NULL
      ORDER BY ls.duedate ASC, ls.installmentno ASC
    `).all<{
      schedule_id: string;
      loan_id: string;
      installment_no: number;
      principal_amount: number;
      interest_amount: number;
      paid_amount: number;
      member_id: string;
      borrower_name: string;
    }>(startDate, endDate);

    // 2. Validasi idempotensi
    if (pendingSchedules.length === 0) {
      const existingInPeriod = await database.query(`
        SELECT COUNT(*) as count 
        FROM loan_schedules ls
        JOIN loans l ON l.id = ls.loanid
        WHERE ls.duedate >= ? AND ls.duedate <= ?
          AND l.deletedat IS NULL
      `).get<{ count: number }>(startDate, endDate);

      if (Number(existingInPeriod?.count || 0) > 0) {
        throw new ServiceError(`Seluruh jadwal angsuran pinjaman untuk periode ${periodMonth} sudah lunas dibukukan.`, 400);
      } else {
        throw new ServiceError(`Tidak ada jadwal angsuran pinjaman yang jatuh tempo pada periode ${periodMonth}.`, 400);
      }
    }

    let totalPrincipal = 0;
    let totalInterest = 0;
    let totalSettledAmount = 0;
    const affectedLoanIds = new Set<string>();
    const uniqueBorrowers = new Set<string>();

    // 3. Catat pembayaran dan lunasi jadwal
    for (const schedule of pendingSchedules) {
      const p = Number(schedule.principal_amount || 0);
      const i = Number(schedule.interest_amount || 0);
      const installmentTotal = p + i;
      const alreadyPaid = Number(schedule.paid_amount || 0);
      const remainingAmount = Math.max(0, installmentTotal - alreadyPaid);

      if (remainingAmount > 0) {
        const paymentId = crypto.randomUUID();
        await database.prepare(`
          INSERT INTO loan_payments (id, loanId, amount, paymentDate, method)
          VALUES (?, ?, ?, ?, 'Transfer')
        `).run(paymentId, schedule.loan_id, remainingAmount, effectiveDate);

        totalPrincipal += p;
        totalInterest += i;
        totalSettledAmount += remainingAmount;
      }

      await database.prepare(`
        UPDATE loan_schedules
        SET paidamount = ?, status = 'Paid', paidat = ?, updatedat = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(installmentTotal, effectiveDate, schedule.schedule_id);

      affectedLoanIds.add(schedule.loan_id);
      uniqueBorrowers.add(schedule.member_id || schedule.borrower_name);
    }

    // 4. Sinkronisasi pinjaman (paidInstallments dan status Lunas)
    for (const loanId of affectedLoanIds) {
      const paidCountRes = await database.query(
        `SELECT COUNT(*) as count FROM loan_schedules WHERE loanid = ? AND status = 'Paid'`
      ).get<{ count: number }>(loanId);
      const paidCount = Number(paidCountRes?.count || 0);

      const totalSchedulesRes = await database.query(
        `SELECT COUNT(*) as count FROM loan_schedules WHERE loanid = ?`
      ).get<{ count: number }>(loanId);
      const totalSchedules = Number(totalSchedulesRes?.count || 0);

      const remainingPendingRes = await database.query(
        `SELECT COUNT(*) as count FROM loan_schedules WHERE loanid = ? AND status IN ('Pending', 'Late')`
      ).get<{ count: number }>(loanId);
      const remainingPending = Number(remainingPendingRes?.count || 0);

      if (totalSchedules > 0 && remainingPending === 0) {
        await database.run(
          `UPDATE loans SET status = 'Lunas', paidinstallments = ? WHERE id = ?`,
          [paidCount, loanId]
        );
      } else {
        await database.run(
          `UPDATE loans SET paidinstallments = ? WHERE id = ?`,
          [paidCount, loanId]
        );
      }
    }

    // 5. Akun kas/bank pelunasan
    let kasCode = '11102'; // default Bank Mandiri
    if (targetAccountId) {
      const acc = await database.query("SELECT code FROM accounts WHERE id = ?").get<{ code: string }>(targetAccountId);
      if (acc?.code) {
        kasCode = acc.code;
      }
    }

    // 6. Buat entri jurnal akuntansi konsolidasi atomik
    let journalEntryId: string | null = null;
    if (totalSettledAmount > 0) {
      const lines = [
        {
          account_code: kasCode,
          debit: totalSettledAmount,
          description: `Penerimaan Pelunasan Payroll Angsuran Pinjaman Periode ${periodMonth}`,
        },
        {
          account_code: '11201',
          credit: totalPrincipal,
          description: `Pelunasan Pokok Pinjaman Payroll Periode ${periodMonth}`,
        },
      ];

      if (totalInterest > 0) {
        lines.push({
          account_code: '41101',
          credit: totalInterest,
          description: `Pendapatan Jasa Pinjaman Payroll Periode ${periodMonth}`,
        });
      }

      journalEntryId = await recordAutoJournal({
        transaction_date: effectiveDate,
        description: `Pelunasan Payroll Potong Gaji Pinjaman Periode ${periodMonth} (${uniqueBorrowers.size} Peminjam)`,
        reference_type: 'loan_payroll_settlement',
        reference_id: periodMonth,
        lines,
      });
    }

    return {
      periodMonth,
      settledSchedulesCount: pendingSchedules.length,
      settledBorrowersCount: uniqueBorrowers.size,
      totalPrincipal,
      totalInterest,
      totalSettledAmount,
      journalEntryId,
    };
  })();
}