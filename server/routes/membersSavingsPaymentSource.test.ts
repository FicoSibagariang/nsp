import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { sign } from "hono/jwt";
import server from "../index";
import { secretKey } from "../middleware";
import db from "../db";

describe("Members Savings Mutation Payment Source API (#333)", () => {
  let adminToken: string;
  const testSuffix = Date.now().toString().slice(-6);
  const memberId = crypto.randomUUID();
  const memberName = `Member Mutasi Rekening ${testSuffix}`;

  let kasKecilAccountId: string;

  beforeAll(async () => {
    adminToken = await sign(
      {
        sub: `adm-savings-${testSuffix}`,
        name: "Admin Savings",
        role: "admin",
        email: `adm_savings_${testSuffix}@example.com`,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secretKey
    );

    // Ensure member exists
    await db.run(
      `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, 'Anggota', 'Aktif', '01 Jan 2026', 100000, 100000, 500000, 700000)`,
      [memberId, memberName]
    );

    // Lookup account IDs
    const kasKecil = await db.query("SELECT id FROM accounts WHERE code = '11101'").get<{ id: string }>();
    kasKecilAccountId = kasKecil!.id;
  });

  afterAll(async () => {
    // Cleanup journals and transactions for this member
    await db.run(
      `DELETE FROM journal_lines WHERE journal_entry_id IN (
        SELECT id FROM journal_entries WHERE reference_id IN (
          SELECT id FROM transactions WHERE memberId = ?
        )
      )`,
      [memberId]
    );
    await db.run(
      `DELETE FROM journal_entries WHERE reference_id IN (
        SELECT id FROM transactions WHERE memberId = ?
      )`,
      [memberId]
    );
    await db.run("DELETE FROM transactions WHERE memberId = ?", [memberId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });

  test("PUT /api/v1/members/:id/savings with paymentSourceAccountId records auto-journal on Kas Kecil (11101)", async () => {
    const res = await server.fetch(
      new Request(`http://localhost/api/v1/members/${memberId}/savings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          additionalSavings: 250000,
          savingsType: "sukarela",
          paymentSourceAccountId: kasKecilAccountId,
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify transaction row was created
    const tx = await db
      .query("SELECT id, type, amount FROM transactions WHERE memberId = ? ORDER BY createdAt DESC LIMIT 1")
      .get<{ id: string; type: string; amount: number }>(memberId);
    expect(tx?.type).toBe("setor_sukarela");
    expect(Number(tx?.amount)).toBe(250000);

    // Verify journal lines debited Kas Kecil (11101), not Bank Mandiri (11102)
    const journal = await db
      .query("SELECT id FROM journal_entries WHERE reference_id = ?")
      .get<{ id: string }>(tx!.id);
    expect(journal).toBeDefined();

    const debitLine = await db
      .query(
        `SELECT jl.*, a.code as account_code 
         FROM journal_lines jl 
         JOIN accounts a ON jl.account_id = a.id 
         WHERE jl.journal_entry_id = ? AND jl.debit > 0`
      )
      .get<{ account_code: string; debit: number }>(journal!.id);

    expect(debitLine?.account_code).toBe("11101");
    expect(Number(debitLine?.debit)).toBe(250000);
  });

  test("PUT /api/v1/members/:id/savings without paymentSourceAccountId defaults to Bank Mandiri (11102)", async () => {
    const res = await server.fetch(
      new Request(`http://localhost/api/v1/members/${memberId}/savings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          additionalSavings: 150000,
          savingsType: "sukarela",
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const tx = await db
      .query("SELECT id FROM transactions WHERE memberId = ? ORDER BY createdAt DESC LIMIT 1")
      .get<{ id: string }>(memberId);

    const journal = await db
      .query("SELECT id FROM journal_entries WHERE reference_id = ?")
      .get<{ id: string }>(tx!.id);

    const debitLine = await db
      .query(
        `SELECT jl.*, a.code as account_code 
         FROM journal_lines jl 
         JOIN accounts a ON jl.account_id = a.id 
         WHERE jl.journal_entry_id = ? AND jl.debit > 0`
      )
      .get<{ account_code: string; debit: number }>(journal!.id);

    expect(debitLine?.account_code).toBe("11102");
    expect(Number(debitLine?.debit)).toBe(150000);
  });

  test("PUT /api/v1/members/:id/savings withdrawal with Kas Kecil (11101) credits Kas Kecil", async () => {
    const res = await server.fetch(
      new Request(`http://localhost/api/v1/members/${memberId}/savings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          additionalSavings: -50000,
          savingsType: "sukarela",
          paymentSourceAccountId: kasKecilAccountId,
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const tx = await db
      .query("SELECT id FROM transactions WHERE memberId = ? ORDER BY createdAt DESC LIMIT 1")
      .get<{ id: string }>(memberId);

    const journal = await db
      .query("SELECT id FROM journal_entries WHERE reference_id = ?")
      .get<{ id: string }>(tx!.id);

    // For withdrawal, kas/bank is CREDITED
    const creditLine = await db
      .query(
        `SELECT jl.*, a.code as account_code 
         FROM journal_lines jl 
         JOIN accounts a ON jl.account_id = a.id 
         WHERE jl.journal_entry_id = ? AND jl.credit > 0`
      )
      .get<{ account_code: string; credit: number }>(journal!.id);

    expect(creditLine?.account_code).toBe("11101");
    expect(Number(creditLine?.credit)).toBe(50000);
  });
});
