import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import db from "../db";
import {
  updateMemberSavings,
} from "../services/savingsService";
import {
  createSavingsWithdrawalRequest,
  approveSavingsWithdrawal,
  getWithdrawalsList,
} from "../services/savingsWithdrawalService";
import {
  createSavingsDepositRequest,
  approveSavingsDeposit,
} from "../services/savingsDepositService";

describe("Financial Transaction Integrity & Concurrency (Issue #305)", () => {
  const memberTestId = "mem-fin-integ-001";
  const memberAdminId = "adm-fin-integ-001";

  async function getMemberSavings(id: string) {
    const row = await db
      .query(
        `SELECT totalsavings as total, simpanansukarela as sukarela, simpananpokok as pokok, simpananwajib as wajib
         FROM members WHERE id = ?`
      )
      .get<{ total: number; sukarela: number; pokok: number; wajib: number }>(id);
    return {
      total: Number(row?.total || 0),
      sukarela: Number(row?.sukarela || 0),
      pokok: Number(row?.pokok || 0),
      wajib: Number(row?.wajib || 0),
    };
  }

  beforeAll(async () => {
    // Clean up test data
    await db.run("DELETE FROM savings_withdrawals WHERE member_id = ?", [memberTestId]);
    await db.run("DELETE FROM savings_deposits WHERE member_id = ?", [memberTestId]);
    await db.run("DELETE FROM transactions WHERE memberid = ?", [memberTestId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberTestId]);
    await db.run("DELETE FROM admins WHERE id = ?", [memberAdminId]);

    // Insert test member with initial 100,000 sukarela balance
    await db.run(
      `INSERT INTO members (
        id, name, email, role, status, phone, joindate,
        totalsavings, simpanansukarela, simpananpokok, simpananwajib
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        memberTestId,
        "Financial Integrity Tester",
        "fin.test@koperasi.test",
        "Anggota",
        "Aktif",
        "081299990001",
        "2026-01-01",
        100000,
        100000,
        0,
        0,
      ]
    );

    // Insert test admin
    await db.run(
      `INSERT INTO admins (id, name, email, password, role)
       VALUES (?, ?, ?, ?, ?)`,
      [memberAdminId, "Admin Tester", "adm.fin@koperasi.test", "hash", "superadmin"]
    );
  });

  afterAll(async () => {
    await db.run("DELETE FROM savings_withdrawals WHERE member_id = ?", [memberTestId]);
    await db.run("DELETE FROM savings_deposits WHERE member_id = ?", [memberTestId]);
    await db.run("DELETE FROM transactions WHERE memberid = ?", [memberTestId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberTestId]);
    await db.run("DELETE FROM admins WHERE id = ?", [memberAdminId]);
  });

  describe("Dead Code Elimination", () => {
    test("vestigial files scratch.tsx and test-hono-login.ts are completely deleted", () => {
      const scratchPath = join(process.cwd(), "scratch.tsx");
      const testHonoLoginPath = join(process.cwd(), "test-hono-login.ts");

      expect(existsSync(scratchPath)).toBe(false);
      expect(existsSync(testHonoLoginPath)).toBe(false);
    });
  });

  describe("Concurrent Savings Withdrawals (Race Condition Prevention)", () => {
    test("simultaneous withdrawal requests exceeding borderline balance are prevented", async () => {
      // Balance is 100,000 sukarela.
      // We launch two parallel withdrawal requests of 70,000 each.
      // Expected: Exactly one succeeds, one fails with insufficient balance.
      // Member balance or pending commitment must never exceed 100,000.
      const p1 = createSavingsWithdrawalRequest(db, memberTestId, {
        amount: 70000,
        destinationBank: "BCA",
        destinationAccount: "1234567890",
        destinationName: "Financial Integrity Tester",
      });

      const p2 = createSavingsWithdrawalRequest(db, memberTestId, {
        amount: 70000,
        destinationBank: "BCA",
        destinationAccount: "1234567890",
        destinationName: "Financial Integrity Tester",
      });

      const results = await Promise.allSettled([p1, p2]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      // Verify rejection error message (pending request conflict or insufficient balance)
      const rejectionError = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectionError.message).toMatch(/(Saldo sukarela tidak mencukupi|masih memiliki pengajuan)/);

      // Verify pending withdrawals in db
      const withdrawals = await getWithdrawalsList(db, { memberId: memberTestId, status: "Menunggu" });
      expect(withdrawals.data.length).toBe(1);
      expect(withdrawals.data[0].amount).toBe(70000);

      // Clean up the created pending withdrawal
      await db.run("DELETE FROM savings_withdrawals WHERE member_id = ?", [memberTestId]);
    });

    test("simultaneous direct withdrawals (updateMemberSavings) prevent negative balance", async () => {
      // Reset member balance to 100,000
      await db.run(
        `UPDATE members SET totalsavings = 100000, simpanansukarela = 100000 WHERE id = ?`,
        [memberTestId]
      );

      // Run two parallel deductions of 70,000 each directly
      const p1 = updateMemberSavings(
        db,
        memberTestId,
        { savingsType: "sukarela", additionalSavings: -70000 },
        "admin-test"
      );
      const p2 = updateMemberSavings(
        db,
        memberTestId,
        { savingsType: "sukarela", additionalSavings: -70000 },
        "admin-test"
      );

      const results = await Promise.allSettled([p1, p2]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const err = (rejected[0] as PromiseRejectedResult).reason;
      expect(err.message).toContain("Penarikan melebihi saldo sukarela tersedia");

      // Check current balance: must be exactly 30,000, NEVER negative
      const summary = await getMemberSavings(memberTestId);
      expect(summary.sukarela).toBe(30000);
      expect(summary.total).toBe(30000);
    });

    test("simultaneous double approval of the same withdrawal request executes only once", async () => {
      // Ensure clean state from previous tests
      await db.run("DELETE FROM savings_withdrawals WHERE member_id = ?", [memberTestId]);

      // Top up balance to 100,000
      await db.run(
        `UPDATE members SET totalsavings = 100000, simpanansukarela = 100000 WHERE id = ?`,
        [memberTestId]
      );

      // Create a pending withdrawal request of 40,000
      const withdrawal = await createSavingsWithdrawalRequest(db, memberTestId, {
        amount: 40000,
        destinationBank: "BCA",
        destinationAccount: "1234567890",
        destinationName: "Financial Integrity Tester",
      });

      // Concurrently approve the exact same withdrawal request twice
      const p1 = approveSavingsWithdrawal(db, withdrawal.id, memberAdminId);
      const p2 = approveSavingsWithdrawal(db, withdrawal.id, memberAdminId);

      const results = await Promise.allSettled([p1, p2]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const err = (rejected[0] as PromiseRejectedResult).reason;
      expect(err.message).toMatch(/(sudah diproses sebelumnya|tidak dapat disetujui)/);

      // Balance must have been deducted exactly once (100,000 - 40,000 = 60,000)
      const summary = await getMemberSavings(memberTestId);
      expect(summary.sukarela).toBe(60000);
      expect(summary.total).toBe(60000);
    });
  });

  describe("Atomic Database Rollback on Auto-Journal Failure", () => {
    test("updateMemberSavings rolls back balance & ledger completely if auto-journal fails", async () => {
      // Set initial balance to 50,000
      await db.run(
        `UPDATE members SET totalsavings = 50000, simpanansukarela = 50000 WHERE id = ?`,
        [memberTestId]
      );

      // Get current transactions count
      const ledgerBefore = await db
        .query("SELECT COUNT(*)::int as cnt FROM transactions WHERE memberid = ?")
        .get<{ cnt: number }>(memberTestId);
      const countBefore = ledgerBefore?.cnt || 0;

      // Install a temporary DB trigger on journal_entries to simulate catastrophic auto-journal failure
      await db.run(`
        CREATE OR REPLACE FUNCTION fail_journal_entries() RETURNS TRIGGER AS $$
        BEGIN
          RAISE EXCEPTION 'Simulated auto-journal ledger failure: DB constraint violation';
        END;
        $$ LANGUAGE plpgsql;
      `);

      await db.run(`
        CREATE TRIGGER trg_test_fail_journal
        BEFORE INSERT ON journal_entries
        FOR EACH ROW
        EXECUTE FUNCTION fail_journal_entries();
      `);

      try {
        let caughtError: any = null;
        try {
          await updateMemberSavings(
            db,
            memberTestId,
            { savingsType: "sukarela", additionalSavings: 25000 },
            "admin-test"
          );
        } catch (e: any) {
          caughtError = e;
        }

        expect(caughtError).not.toBeNull();
        expect(caughtError.message).toContain("Simulated auto-journal ledger failure");

        // Verify ATOMIC ROLLBACK:
        // 1. Member balance must NOT be updated (must remain 50,000)
        const summary = await getMemberSavings(memberTestId);
        expect(summary.sukarela).toBe(50000);
        expect(summary.total).toBe(50000);

        // 2. Transactions table must NOT have new records
        const ledgerAfter = await db
          .query("SELECT COUNT(*)::int as cnt FROM transactions WHERE memberid = ?")
          .get<{ cnt: number }>(memberTestId);
        expect(ledgerAfter?.cnt).toBe(countBefore);
      } finally {
        await db.run("DROP TRIGGER IF EXISTS trg_test_fail_journal ON journal_entries;");
        await db.run("DROP FUNCTION IF EXISTS fail_journal_entries();");
      }
    });

    test("approveSavingsDeposit succeeds and records auto-journal atomically", async () => {
      // Reset member balance to 50,000
      await db.run(
        `UPDATE members SET totalsavings = 50000, simpanansukarela = 50000 WHERE id = ?`,
        [memberTestId]
      );

      // Test the happy path of deposit approval to ensure auto-journal and deposit status update are intact
      const deposit = await createSavingsDepositRequest(db, memberTestId, {
        savingsType: "sukarela",
        amount: 20000,
        transferDate: "2026-10-30",
        proofUrl: "/uploads/savings/dummy.jpg",
        proofName: "dummy.jpg",
      });

      const approved = await approveSavingsDeposit(db, deposit.id, memberAdminId);
      expect(approved.status).toBe("Diverifikasi");

      const summary = await getMemberSavings(memberTestId);
      expect(summary.sukarela).toBe(70000);
      expect(summary.total).toBe(70000);
    });
  });
});
