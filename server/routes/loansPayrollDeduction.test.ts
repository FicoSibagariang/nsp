import { expect, test, describe, beforeAll } from "bun:test";
import { sign } from "hono/jwt";
import server from "../index";
import { secretKey } from "../middleware";

describe("Loans Payroll Deductions API Endpoint", () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await sign(
      {
        sub: "admin-loans-user-1",
        name: "Admin Koperasi",
        role: "admin",
        email: "admin@koperasi.com",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secretKey
    );
  });

  test("GET /api/v1/loans/payroll-deductions requires authentication", async () => {
    const res = await server.fetch(
      new Request("http://localhost:3000/api/v1/loans/payroll-deductions?month=2026-09")
    );
    expect(res.status).toBe(401);
  });

  test("GET /api/v1/loans/payroll-deductions returns 200 and matches September 2026 data", async () => {
    const res = await server.fetch(
      new Request("http://localhost:3000/api/v1/loans/payroll-deductions?month=2026-09", {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.month).toBe("2026-09");
    expect(body.data.startDate).toBe("2026-09-01");
    expect(body.data.endDate).toBe("2026-09-30");
    if (body.data.totalEmployees > 0) {
      expect(body.data.totalEmployees).toBe(38);
      expect(body.data.totalAmount).toBe(38212441);
      expect(body.data.items.length).toBe(38);

      // Verify first item
      const firstItem = body.data.items[0];
      expect(firstItem.employeeId).toBe("0202169");
      expect(firstItem.name).toBe("Abdul Aziz Laia");
      expect(firstItem.newAmount).toBe(548520);
      expect(firstItem.currentAmount).toBe(0);
      expect(firstItem.note).toBe("");
    } else {
      expect(body.data.totalEmployees).toBe(0);
      expect(body.data.totalAmount).toBe(0);
      expect(body.data.items).toEqual([]);
    }
  });

  test("GET /api/v1/loans/payroll-deductions?format=xlsx returns binary spreadsheet", async () => {
    const res = await server.fetch(
      new Request("http://localhost:3000/api/v1/loans/payroll-deductions?month=2026-09&format=xlsx", {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(res.headers.get("content-disposition")).toContain("potong_gaji_angsuran_september_2026.xlsx");
    const arrayBuffer = await res.arrayBuffer();
    expect(arrayBuffer.byteLength).toBeGreaterThan(5000);
  });

  describe("POST /api/v1/loans/payroll/settle (Issue #315)", () => {
    const testPeriod = "2039-11";
    const testMemberId = "member-payroll-settle-test";
    const testLoanId1 = "loan-payroll-settle-1";
    const testLoanId2 = "loan-payroll-settle-2"; // Multiple loans for same member

    beforeAll(async () => {
      const db = (await import("../db")).default;
      // Cleanup previous test leftovers
      await db.run("DELETE FROM journal_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE reference_id = ?)", [testPeriod]);
      await db.run("DELETE FROM journal_entries WHERE reference_id = ?", [testPeriod]);
      await db.run("DELETE FROM loan_payments WHERE loanId IN (?, ?)", [testLoanId1, testLoanId2]);
      await db.run("DELETE FROM loan_schedules WHERE loanId IN (?, ?)", [testLoanId1, testLoanId2]);
      await db.run("DELETE FROM loans WHERE id IN (?, ?)", [testLoanId1, testLoanId2]);
      await db.run("DELETE FROM members WHERE id = ?", [testMemberId]);

      // Seed test member
      await db.run(
        `INSERT INTO members (id, name, status, role, nik, joindate) VALUES (?, ?, 'Aktif', 'Anggota', '3201019999990001', '2039-01-01')`,
        [testMemberId, "Budi Pegawai Payroll"]
      );

      // Seed 2 active loans for the same member (multiple active loans test)
      await db.run(
        `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt)
         VALUES (?, ?, ?, 5000000, 10, 'Pinjaman 1', 'Disetujui', '2039-01-01')`,
        [testLoanId1, testMemberId, "Budi Pegawai Payroll"]
      );
      await db.run(
        `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt)
         VALUES (?, ?, ?, 3000000, 6, 'Pinjaman 2', 'Disetujui', '2039-01-01')`,
        [testLoanId2, testMemberId, "Budi Pegawai Payroll"]
      );

      // Seed installment schedules due in testPeriod
      await db.run(
        `INSERT INTO loan_schedules (id, loanId, installmentNo, dueDate, principalAmount, interestAmount, paidAmount, status)
         VALUES (?, ?, 1, '2039-11-25', 500000, 50000, 0, 'Pending')`,
        ["sch-payroll-1", testLoanId1]
      );
      await db.run(
        `INSERT INTO loan_schedules (id, loanId, installmentNo, dueDate, principalAmount, interestAmount, paidAmount, status)
         VALUES (?, ?, 1, '2039-11-25', 500000, 30000, 0, 'Pending')`,
        ["sch-payroll-2", testLoanId2]
      );
    });

    test("POST /api/v1/loans/payroll/settle requires authentication", async () => {
      const res = await server.fetch(
        new Request("http://localhost:3000/api/v1/loans/payroll/settle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ periodMonth: testPeriod }),
        })
      );
      expect(res.status).toBe(401);
    });

    test("POST /api/v1/loans/payroll/settle validates periodMonth format", async () => {
      const res = await server.fetch(
        new Request("http://localhost:3000/api/v1/loans/payroll/settle", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ periodMonth: "invalid-month" }),
        })
      );
      expect(res.status).toBe(400);
    });

    test("POST /api/v1/loans/payroll/settle settles multiple loans in atomic transaction and creates balanced journal", async () => {
      const res = await server.fetch(
        new Request("http://localhost:3000/api/v1/loans/payroll/settle", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            periodMonth: testPeriod,
            transactionDate: "2039-11-30",
          }),
        })
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.data.periodMonth).toBe(testPeriod);
      expect(body.data.settledSchedulesCount).toBe(2);
      expect(body.data.totalPrincipal).toBe(1000000); // 500k + 500k
      expect(body.data.totalInterest).toBe(80000); // 50k + 30k
      expect(body.data.totalSettledAmount).toBe(1080000);
      expect(body.data.journalEntryId).toBeDefined();

      const db = (await import("../db")).default;

      // Verify schedules updated to Paid
      const schedules = await db.query(
        "SELECT id, status, paidAmount, paidAt FROM loan_schedules WHERE loanId IN (?, ?)"
      ).all(testLoanId1, testLoanId2) as any[];
      expect(schedules.length).toBe(2);
      expect(schedules[0].status).toBe("Paid");
      expect(schedules[1].status).toBe("Paid");

      // Verify payments inserted
      const payments = await db.query(
        "SELECT id, amount, method, paymentDate FROM loan_payments WHERE loanId IN (?, ?)"
      ).all(testLoanId1, testLoanId2) as any[];
      expect(payments.length).toBe(2);
      expect(payments[0].method).toBe("Transfer");
      expect(payments[1].method).toBe("Transfer");

      // Verify consolidated journal entry
      const journal = await db.query(
        "SELECT * FROM journal_entries WHERE reference_type = 'loan_payroll_settlement' AND reference_id = ?"
      ).get(testPeriod) as any;
      expect(journal).toBeDefined();

      const lines = await db.query(
        "SELECT l.*, a.code FROM journal_lines l JOIN accounts a ON a.id = l.account_id WHERE l.journal_entry_id = ?"
      ).all(journal.id) as any[];

      const debitTotal = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
      const creditTotal = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
      expect(debitTotal).toBe(1080000);
      expect(creditTotal).toBe(1080000);
      expect(debitTotal).toBe(creditTotal); // Balanced

      // Check recap endpoint now marks isSettled = true
      const recapRes = await server.fetch(
        new Request(`http://localhost:3000/api/v1/loans/payroll-deductions?month=${testPeriod}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      );
      expect(recapRes.status).toBe(200);
      const recapBody = (await recapRes.json()) as any;
      expect(recapBody.data.isSettled).toBe(true);
      expect(recapBody.data.unpaidCount).toBe(0);
      expect(recapBody.data.paidCount).toBe(2);
    });

    test("POST /api/v1/loans/payroll/settle is idempotent and rejects already settled period", async () => {
      const res = await server.fetch(
        new Request("http://localhost:3000/api/v1/loans/payroll/settle", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            periodMonth: testPeriod,
            transactionDate: "2039-11-30",
          }),
        })
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("sudah lunas dibukukan");
    });
  });
});
