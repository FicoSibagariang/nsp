import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { sign } from "hono/jwt";
import server from "../index";
import { secretKey } from "../middleware";
import db from "../db";

describe("EWA Requests Disbursed Summary API (#327)", () => {
  let adminToken: string;

  const testSuffix = Date.now().toString().slice(-6);
  const adminId1 = `adm-sum1-${testSuffix}`;
  const adminId2 = `adm-sum2-${testSuffix}`;
  const adminName1 = `Operator Doni ${testSuffix}`;
  const adminName2 = `Operator Rina ${testSuffix}`;

  let employeeId: number | string;
  let reqId1: number | string;
  let reqId2: number | string;
  let reqId3: number | string;

  beforeAll(async () => {
    adminToken = await sign(
      {
        sub: "admin-sum-test",
        name: "Admin Summary",
        role: "admin",
        email: `adm_sum_${testSuffix}@example.com`,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secretKey
    );

    // Insert 2 test admins
    await db.run(
      `INSERT INTO admins (id, email, password, role, name) VALUES (?, ?, 'secret', 'operator', ?)`,
      [adminId1, `op_sum1_${testSuffix}@example.com`, adminName1]
    );
    await db.run(
      `INSERT INTO admins (id, email, password, role, name) VALUES (?, ?, 'secret', 'operator', ?)`,
      [adminId2, `op_sum2_${testSuffix}@example.com`, adminName2]
    );

    // Insert test employee
    const empRes = await db
      .query(
        `INSERT INTO employees (
          employer_id, name, email, nik, nip, department, position, base_salary,
          status, bank_name, bank_account_number, bank_account_holder
        ) VALUES (
          1, ?, ?, '1234567890123456', ?, 'IT', 'Staff', 8000000,
          'active', 'Bank Mandiri', '8877665544', ?
        ) RETURNING id`
      )
      .get<{ id: number | string }>(
        `Karyawan Summary Test ${testSuffix}`,
        `emp_sum_${testSuffix}@example.com`,
        `NIP-SUM-${testSuffix}`,
        `Karyawan Summary Test ${testSuffix}`
      );
    employeeId = empRes!.id;

    // Insert 3 requests:
    // 1. Disbursed by adminId1 for Rp 1.000.000 (Fee 25.000, Total Deduction 1.025.000) on 2026-11-02
    const r1 = await db
      .query(
        `INSERT INTO withdrawal_requests (
          employer_id, employee_id, amount, status, period_month, pay_period_start, pay_period_end,
          fee, fee_percentage, destination_bank_name, destination_account_number, destination_account_holder,
          disbursed_by, transferred_at, total_payroll_deduction
        ) VALUES (
          1, ?, 1000000, 'transferred', '2026-11', '2026-11-01', '2026-11-30',
          25000, 2.5, 'Bank Mandiri', '8877665544', 'Karyawan',
          ?, '2026-11-02 10:00:00', 1025000
        ) RETURNING id`
      )
      .get<{ id: number | string }>(employeeId, adminId1);
    reqId1 = r1!.id;

    // 2. Disbursed by adminId1 for Rp 2.000.000 (Fee 50.000, Total Deduction 2.050.000) on 2026-11-05
    const r2 = await db
      .query(
        `INSERT INTO withdrawal_requests (
          employer_id, employee_id, amount, status, period_month, pay_period_start, pay_period_end,
          fee, fee_percentage, destination_bank_name, destination_account_number, destination_account_holder,
          disbursed_by, transferred_at, total_payroll_deduction
        ) VALUES (
          1, ?, 2000000, 'transferred', '2026-11', '2026-11-01', '2026-11-30',
          50000, 2.5, 'Bank Mandiri', '8877665544', 'Karyawan',
          ?, '2026-11-05 14:00:00', 2050000
        ) RETURNING id`
      )
      .get<{ id: number | string }>(employeeId, adminId1);
    reqId2 = r2!.id;

    // 3. Disbursed by adminId2 for Rp 3.000.000 (Fee 75.000, Total Deduction 3.075.000) on 2026-11-10
    const r3 = await db
      .query(
        `INSERT INTO withdrawal_requests (
          employer_id, employee_id, amount, status, period_month, pay_period_start, pay_period_end,
          fee, fee_percentage, destination_bank_name, destination_account_number, destination_account_holder,
          disbursed_by, transferred_at, total_payroll_deduction
        ) VALUES (
          1, ?, 3000000, 'transferred', '2026-11', '2026-11-01', '2026-11-30',
          75000, 2.5, 'Bank Mandiri', '8877665544', 'Karyawan',
          ?, '2026-11-10 16:00:00', 3075000
        ) RETURNING id`
      )
      .get<{ id: number | string }>(employeeId, adminId2);
    reqId3 = r3!.id;
  });

  afterAll(async () => {
    if (reqId1 || reqId2 || reqId3) {
      await db.run(
        `DELETE FROM withdrawal_requests WHERE id IN (?, ?, ?)`,
        [reqId1, reqId2, reqId3]
      );
    }
    if (employeeId) {
      await db.run(`DELETE FROM employees WHERE id = ?`, [employeeId]);
    }
    await db.run(`DELETE FROM admins WHERE id IN (?, ?)`, [adminId1, adminId2]);
  });

  test("GET /api/v1/ewa/requests returns summary object across all filtered results", async () => {
    const res = await server.fetch(
      new Request(`http://localhost/api/v1/ewa/requests?employeeId=${employeeId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.summary).toBeDefined();
    expect(body.summary.totalRequests).toBe(3);
    expect(body.summary.totalDisbursedAmount).toBe(6000000); // 1jt + 2jt + 3jt
    expect(body.summary.totalFeeAmount).toBe(150000); // 25k + 50k + 75k
    expect(body.summary.totalPayrollDeduction).toBe(6150000);
  });

  test("summary calculates totals accurately for specific operator (disbursedBy filter)", async () => {
    const res = await server.fetch(
      new Request(
        `http://localhost/api/v1/ewa/requests?employeeId=${employeeId}&disbursedBy=${adminId1}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      )
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.summary).toBeDefined();
    expect(body.summary.totalRequests).toBe(2);
    expect(body.summary.totalDisbursedAmount).toBe(3000000); // 1jt + 2jt
    expect(body.summary.totalFeeAmount).toBe(75000); // 25k + 50k
    expect(body.summary.totalPayrollDeduction).toBe(3075000);
  });

  test("summary aggregates across all pages even with limit=1 (server-side cross-page aggregation)", async () => {
    const res = await server.fetch(
      new Request(
        `http://localhost/api/v1/ewa/requests?employeeId=${employeeId}&limit=1&page=1`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      )
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // data page size is only 1
    expect(body.data.length).toBe(1);
    // summary must still aggregate ALL 3 matching records
    expect(body.summary.totalRequests).toBe(3);
    expect(body.summary.totalDisbursedAmount).toBe(6000000);
  });

  test("summary aggregates accurately for date range filter", async () => {
    const res = await server.fetch(
      new Request(
        `http://localhost/api/v1/ewa/requests?employeeId=${employeeId}&disbursedStartDate=2026-11-01&disbursedEndDate=2026-11-03`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      )
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.summary.totalRequests).toBe(1);
    expect(body.summary.totalDisbursedAmount).toBe(1000000);
  });
});
