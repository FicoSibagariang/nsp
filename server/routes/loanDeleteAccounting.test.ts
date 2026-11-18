import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { sign } from "hono/jwt";
import server from "../index";
import { secretKey } from "../middleware";
import db from "../db";
import { deleteLoan } from "../services/loanService";
import { ServiceError } from "../services/errors";
import { getTrialBalanceReport } from "../services/accountingService";
import { createCleanupOrphanedLoanDisbursementJournalsMigration } from "../migrations/0047_cleanup_orphaned_loan_disbursement_journals";

describe("Loan Deletion & Accounting Integrity (#329)", () => {
  let adminToken: string;
  const testSuffix = Date.now().toString().slice(-6);

  beforeAll(async () => {
    adminToken = await sign(
      {
        sub: `admin-loan-del-${testSuffix}`,
        name: "Admin Loan Delete",
        role: "superadmin",
        email: `adm_loan_del_${testSuffix}@example.com`,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secretKey
    );
  });

  afterAll(async () => {
    // Clean up test data
    await db.run("DELETE FROM admins WHERE id = ?", [`admin-loan-del-${testSuffix}`]);
  });

  test("deleteLoan cleans up disbursement journal_entries and journal_lines when loan has no payments", async () => {
    const memberId = crypto.randomUUID();
    const loanId = crypto.randomUUID();
    const loanName = `Peminjam Bersih ${testSuffix}`;

    // 1. Create member and loan
    await db.run(
      `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, 'Anggota', 'Aktif', '01 Jan 2026', 100000, 0, 0, 100000)`,
      [memberId, loanName]
    );

    await db.run(
      `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt, approvedAt, totalAmount)
       VALUES (?, ?, ?, 5000000, 12, 'Modal Usaha', 'Disetujui', '2026-11-01', '2026-11-01', 5500000)`,
      [loanId, memberId, loanName]
    );

    // 2. Create disbursement journal (Debit 11201 Piutang, Credit 11102 Bank Mandiri)
    const journalId = crypto.randomUUID();
    await db.run(
      `INSERT INTO journal_entries (id, transaction_date, description, reference_type, reference_id, created_by)
       VALUES (?, '2026-11-01', ?, 'loan_disbursement', ?, NULL)`,
      [journalId, `Pencairan Pinjaman Anggota — ${loanName}`, loanId]
    );

    const piutangAcc = await db.query("SELECT id FROM accounts WHERE code = '11201'").get<{ id: string }>();
    const mandiriAcc = await db.query("SELECT id FROM accounts WHERE code = '11102'").get<{ id: string }>();

    expect(piutangAcc).toBeDefined();
    expect(mandiriAcc).toBeDefined();

    await db.run(
      `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, description)
       VALUES (gen_random_uuid(), ?, ?, 5000000, 0, 'Piutang Pinjaman')`,
      [journalId, piutangAcc!.id]
    );
    await db.run(
      `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, description)
       VALUES (gen_random_uuid(), ?, ?, 0, 5000000, 'Pencairan Kas/Bank')`,
      [journalId, mandiriAcc!.id]
    );

    // Verify journal and lines exist before deletion
    const journalBefore = await db
      .query("SELECT id FROM journal_entries WHERE reference_type = 'loan_disbursement' AND reference_id = ?")
      .get<{ id: string }>(loanId);
    expect(journalBefore).toBeDefined();

    const linesBefore = await db
      .query("SELECT id FROM journal_lines WHERE journal_entry_id = ?")
      .all<{ id: string }>(journalId);
    expect(linesBefore.length).toBe(2);

    // Check trial balance before deletion
    const tbBefore = await getTrialBalanceReport(db);
    const piutangBefore = tbBefore.find((a: any) => a.code === '11201');
    const mandiriBefore = tbBefore.find((a: any) => a.code === '11102');

    // 3. Execute deleteLoan
    await deleteLoan(db, loanId);

    // Check trial balance after deletion
    const tbAfter = await getTrialBalanceReport(db);
    const piutangAfter = tbAfter.find((a: any) => a.code === '11201');
    const mandiriAfter = tbAfter.find((a: any) => a.code === '11102');

    expect(Number(piutangAfter?.total_debit || 0)).toBe(Number(piutangBefore?.total_debit || 0) - 5000000);
    expect(Number(mandiriAfter?.total_credit || 0)).toBe(Number(mandiriBefore?.total_credit || 0) - 5000000);

    // 4. Verify disbursement journal and lines are completely removed
    const journalAfter = await db
      .query("SELECT id FROM journal_entries WHERE reference_type = 'loan_disbursement' AND reference_id = ?")
      .get<{ id: string }>(loanId);
    expect(journalAfter).toBeNull();

    const linesAfter = await db
      .query("SELECT id FROM journal_lines WHERE journal_entry_id = ?")
      .all<{ id: string }>(journalId);
    expect(linesAfter.length).toBe(0);

    // 5. Verify loan is marked as soft-deleted
    const loanRow = await db
      .query("SELECT id, deletedAt FROM loans WHERE id = ?")
      .get<{ id: string; deletedAt: string | null }>(loanId);
    expect(loanRow?.deletedAt).not.toBeNull();

    // Cleanup member and loan
    await db.run("DELETE FROM loans WHERE id = ?", [loanId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });

  test("deleteLoan rejects deletion when loan already has payment records", async () => {
    const memberId = crypto.randomUUID();
    const loanId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();
    const loanName = `Peminjam Bayar ${testSuffix}`;

    // 1. Create member and loan
    await db.run(
      `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, 'Anggota', 'Aktif', '01 Jan 2026', 100000, 0, 0, 100000)`,
      [memberId, loanName]
    );

    await db.run(
      `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt, approvedAt, totalAmount)
       VALUES (?, ?, ?, 5000000, 12, 'Modal Usaha', 'Disetujui', '2026-11-01', '2026-11-01', 5500000)`,
      [loanId, memberId, loanName]
    );

    // 2. Create disbursement journal
    const journalId = crypto.randomUUID();
    await db.run(
      `INSERT INTO journal_entries (id, transaction_date, description, reference_type, reference_id, created_by)
       VALUES (?, '2026-11-01', ?, 'loan_disbursement', ?, NULL)`,
      [journalId, `Pencairan Pinjaman Anggota — ${loanName}`, loanId]
    );

    // 3. Insert payment record
    await db.run(
      `INSERT INTO loan_payments (id, loanId, amount, paymentDate, method)
       VALUES (?, ?, 500000, '2026-11-05', 'Transfer')`,
      [paymentId, loanId]
    );

    // 4. Expect deleteLoan to throw ServiceError 400
    let thrownError: any = null;
    try {
      await deleteLoan(db, loanId);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(ServiceError);
    expect(thrownError.status).toBe(400);
    expect(thrownError.message).toContain("pembayaran angsuran");

    // 5. Verify loan is NOT deleted and journal remains
    const loanRow = await db
      .query("SELECT id, deletedAt FROM loans WHERE id = ?")
      .get<{ id: string; deletedAt: string | null }>(loanId);
    expect(loanRow?.deletedAt).toBeNull();

    const journalStillExists = await db
      .query("SELECT id FROM journal_entries WHERE id = ?")
      .get<{ id: string }>(journalId);
    expect(journalStillExists).toBeDefined();

    // Cleanup
    await db.run("DELETE FROM loan_payments WHERE id = ?", [paymentId]);
    await db.run("DELETE FROM journal_entries WHERE id = ?", [journalId]);
    await db.run("DELETE FROM loans WHERE id = ?", [loanId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });

  test("HTTP DELETE /api/loans/:id endpoint integration", async () => {
    const memberId = crypto.randomUUID();
    const loanId = crypto.randomUUID();
    const loanName = `Peminjam Route ${testSuffix}`;

    await db.run(
      `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, 'Anggota', 'Aktif', '01 Jan 2026', 100000, 0, 0, 100000)`,
      [memberId, loanName]
    );

    await db.run(
      `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt, approvedAt, totalAmount)
       VALUES (?, ?, ?, 3000000, 6, 'Biaya Pendidikan', 'Disetujui', '2026-11-01', '2026-11-01', 3300000)`,
      [loanId, memberId, loanName]
    );

    const journalId = crypto.randomUUID();
    await db.run(
      `INSERT INTO journal_entries (id, transaction_date, description, reference_type, reference_id, created_by)
       VALUES (?, '2026-11-01', ?, 'loan_disbursement', ?, NULL)`,
      [journalId, `Pencairan Pinjaman Anggota — ${loanName}`, loanId]
    );

    // Call DELETE endpoint
    const res = await server.fetch(
      new Request(`http://localhost/api/v1/loans/${loanId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify journal removed
    const journalAfter = await db
      .query("SELECT id FROM journal_entries WHERE id = ?")
      .get<{ id: string }>(journalId);
    expect(journalAfter).toBeNull();

    // Calling DELETE again should return 404 (already deleted)
    const resSecond = await server.fetch(
      new Request(`http://localhost/api/v1/loans/${loanId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
    );
    expect(resSecond.status).toBe(404);

    // Test rejection via HTTP when loan has payments
    const loanWithPaymentId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();
    await db.run(
      `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt, approvedAt, totalAmount)
       VALUES (?, ?, ?, 2000000, 6, 'Renovasi', 'Disetujui', '2026-11-01', '2026-11-01', 2200000)`,
      [loanWithPaymentId, memberId, loanName]
    );
    await db.run(
      `INSERT INTO loan_payments (id, loanId, amount, paymentDate, method)
       VALUES (?, ?, 300000, '2026-11-05', 'Transfer')`,
      [paymentId, loanWithPaymentId]
    );

    const resPayment = await server.fetch(
      new Request(`http://localhost/api/v1/loans/${loanWithPaymentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
    );
    expect(resPayment.status).toBe(400);
    const errBody = await resPayment.json();
    expect(errBody.success).toBe(false);
    expect(errBody.message).toContain("pembayaran angsuran");

    // Cleanup
    await db.run("DELETE FROM loan_payments WHERE id = ?", [paymentId]);
    await db.run("DELETE FROM loans WHERE id IN (?, ?)", [loanId, loanWithPaymentId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });

  test("migration 0047 cleans up orphaned journal entry #00c72292 and lines", async () => {
    const orphanJournalId = "00c72292-50c3-409b-94a3-02aee1877b55";
    const piutangAcc = await db.query("SELECT id FROM accounts WHERE code = '11201'").get<{ id: string }>();
    const mandiriAcc = await db.query("SELECT id FROM accounts WHERE code = '11102'").get<{ id: string }>();

    expect(piutangAcc).toBeDefined();
    expect(mandiriAcc).toBeDefined();

    // 1. Manually insert orphaned journal simulating the production incident
    await db.run(
      `INSERT INTO journal_entries (id, transaction_date, description, reference_type, reference_id, created_by)
       VALUES (?, '2026-11-04', 'Pencairan Pinjaman Anggota — Test Orphan', 'loan_disbursement', 'd293dc69-cbdc-4500-a36d-d833697eb958', NULL)
       ON CONFLICT (id) DO NOTHING`,
      [orphanJournalId]
    );

    const lineId1 = crypto.randomUUID();
    const lineId2 = crypto.randomUUID();
    await db.run(
      `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, description)
       VALUES (?, ?, ?, 10000000, 0, 'Piutang Pinjaman Anggota')`,
      [lineId1, orphanJournalId, piutangAcc!.id]
    );
    await db.run(
      `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, description)
       VALUES (?, ?, ?, 0, 10000000, 'Bank Mandiri')`,
      [lineId2, orphanJournalId, mandiriAcc!.id]
    );

    // Verify it exists
    const entryCheck = await db
      .query("SELECT id FROM journal_entries WHERE id = ?")
      .get<{ id: string }>(orphanJournalId);
    expect(entryCheck).toBeDefined();

    // 2. Run migration 0047 up()
    const migration = createCleanupOrphanedLoanDisbursementJournalsMigration(db);
    expect(migration.name).toBe("0047_cleanup_orphaned_loan_disbursement_journals");
    await migration.up();

    // 3. Verify entry and lines are completely removed
    const entryAfterMigration = await db
      .query("SELECT id FROM journal_entries WHERE id = ?")
      .get<{ id: string }>(orphanJournalId);
    expect(entryAfterMigration).toBeNull();

    const linesAfterMigration = await db
      .query("SELECT id FROM journal_lines WHERE journal_entry_id = ?")
      .all<{ id: string }>(orphanJournalId);
    expect(linesAfterMigration.length).toBe(0);
  });
});
