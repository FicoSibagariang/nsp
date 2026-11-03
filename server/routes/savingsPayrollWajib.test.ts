import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { sign } from "hono/jwt";
import server from "../index";
import { secretKey } from "../middleware";
import db from "../db";

describe("Savings Payroll Mandatory (Simpanan Wajib) API Endpoints (Issue #316)", () => {
  let adminToken: string;
  const testPeriod = "2027-05";
  const memberId1 = "mem-test-wajib-1";
  const memberId2 = "mem-test-wajib-2";

  beforeAll(async () => {
    adminToken = await sign(
      {
        sub: "admin-savings-user-1",
        name: "Admin Koperasi",
        role: "admin",
        email: "admin@koperasi.com",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secretKey
    );

    // Bersihkan sisa data test terdahulu jika ada
    await db.run("DELETE FROM transactions WHERE memberId IN (?, ?)", [memberId1, memberId2]);
    await db.run("DELETE FROM journal_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE reference_id = ?)", [testPeriod]);
    await db.run("DELETE FROM journal_entries WHERE reference_id = ?", [testPeriod]);
    await db.run("DELETE FROM members WHERE id IN (?, ?)", [memberId1, memberId2]);

    // Seed 2 anggota aktif pengujian
    await db.run(
      `INSERT INTO members (id, name, status, role, nik, joindate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, 'Aktif', 'Anggota', '3201019999990011', '2027-01-01', 500000, 100000, 50000, 650000)`,
      [memberId1, "Anggota Wajib A"]
    );
    await db.run(
      `INSERT INTO members (id, name, status, role, nik, joindate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, 'Aktif', 'Anggota', '3201019999990012', '2027-01-01', 500000, 150000, 0, 650000)`,
      [memberId2, "Anggota Wajib B"]
    );
  });

  afterAll(async () => {
    await db.run("DELETE FROM transactions WHERE memberId IN (?, ?)", [memberId1, memberId2]);
    await db.run("DELETE FROM journal_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE reference_id = ?)", [testPeriod]);
    await db.run("DELETE FROM journal_entries WHERE reference_id = ?", [testPeriod]);
    await db.run("DELETE FROM members WHERE id IN (?, ?)", [memberId1, memberId2]);
  });

  test("GET /api/v1/savings/payroll/recap-wajib requires authentication", async () => {
    const res = await server.fetch(
      new Request(`http://localhost:3000/api/v1/savings/payroll/recap-wajib?month=${testPeriod}`)
    );
    expect(res.status).toBe(401);
  });

  test("GET /api/v1/savings/payroll/recap-wajib returns pending members for unsaved period", async () => {
    const res = await server.fetch(
      new Request(`http://localhost:3000/api/v1/savings/payroll/recap-wajib?month=${testPeriod}`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.periodMonth).toBe(testPeriod);
    expect(body.data.totalActiveMembers).toBeGreaterThanOrEqual(2);
    expect(body.data.pendingCount).toBeGreaterThanOrEqual(2);
    expect(body.data.isSettled).toBe(false);

    const pendingIds = body.data.pendingMembers.map((m: any) => m.id);
    expect(pendingIds).toContain(memberId1);
    expect(pendingIds).toContain(memberId2);
  });

  test("POST /api/v1/savings/payroll/settle-wajib validates request body", async () => {
    const res = await server.fetch(
      new Request("http://localhost:3000/api/v1/savings/payroll/settle-wajib", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          periodMonth: "invalid-month",
        }),
      })
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
  });

  test("POST /api/v1/savings/payroll/settle-wajib settles pending active members and creates balanced journal", async () => {
    const res = await server.fetch(
      new Request("http://localhost:3000/api/v1/savings/payroll/settle-wajib", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          periodMonth: testPeriod,
          transactionDate: `${testPeriod}-31`,
          amountPerMember: 50000,
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.periodMonth).toBe(testPeriod);
    expect(body.data.settledMembersCount).toBeGreaterThanOrEqual(2);
    expect(body.data.amountPerMember).toBe(50000);
    expect(body.data.journalEntryId).toBeDefined();

    // Verifikasi saldo kedua member uji bertambah tepat Rp 50.000
    const m1 = await db.query("SELECT * FROM members WHERE id = ?").get<any>(memberId1);
    expect(Number(m1.simpananWajib)).toBe(150000); // 100.000 + 50.000
    expect(Number(m1.totalSavings)).toBe(700000);  // 650.000 + 50.000

    const m2 = await db.query("SELECT * FROM members WHERE id = ?").get<any>(memberId2);
    expect(Number(m2.simpananWajib)).toBe(200000); // 150.000 + 50.000
    expect(Number(m2.totalSavings)).toBe(700000);  // 650.000 + 50.000

    // Verifikasi mutasi transaksi setor_wajib tercatat
    const tx1 = await db.query("SELECT * FROM transactions WHERE memberId = ? AND type = 'setor_wajib' AND createdAt LIKE ?").get<any>(memberId1, `${testPeriod}%`);
    expect(tx1).toBeDefined();
    expect(Number(tx1.amount)).toBe(50000);
    expect(Number(tx1.balanceBefore)).toBe(650000);
    expect(Number(tx1.balanceAfter)).toBe(700000);

    // Verifikasi jurnal akuntansi seimbang
    const journal = await db.query("SELECT * FROM journal_entries WHERE reference_id = ? AND reference_type = 'savings_payroll_wajib'").get<any>(testPeriod);
    expect(journal).toBeDefined();

    const lines = await db.query(
      "SELECT l.*, a.code as account_code FROM journal_lines l JOIN accounts a ON a.id = l.account_id WHERE l.journal_entry_id = ?"
    ).all<any>(journal.id);
    expect(lines.length).toBe(2);

    const debitLine = lines.find((l: any) => Number(l.debit) > 0);
    const creditLine = lines.find((l: any) => Number(l.credit) > 0);
    expect(debitLine.account_code).toBe("11102"); // Bank Mandiri
    expect(creditLine.account_code).toBe("31102"); // Simpanan Wajib
    expect(Number(debitLine.debit)).toBe(Number(creditLine.credit));
  });

  test("POST /api/v1/savings/payroll/settle-wajib prevents duplicate deduction (idempotency)", async () => {
    const res = await server.fetch(
      new Request("http://localhost:3000/api/v1/savings/payroll/settle-wajib", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          periodMonth: testPeriod,
        }),
      })
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("Seluruh anggota aktif sudah menyetor simpanan wajib");
  });

  test("GET /api/v1/savings/payroll/recap-wajib shows settled state after execution", async () => {
    const res = await server.fetch(
      new Request(`http://localhost:3000/api/v1/savings/payroll/recap-wajib?month=${testPeriod}`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.isSettled).toBe(true);
    expect(body.data.pendingCount).toBe(0);
    expect(body.data.pendingMembers).toEqual([]);
    expect(body.data.settledAt).toBeDefined();
  });
});
