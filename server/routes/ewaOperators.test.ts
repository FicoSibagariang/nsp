import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { sign } from "hono/jwt";
import server from "../index";
import { secretKey } from "../middleware";
import db from "../db";

describe("EWA Operators and DisbursedBy Filter API (#320)", () => {
  let adminToken: string;

  const testSuffix = Date.now().toString().slice(-6);
  const adminId1 = `adm-op1-${testSuffix}`;
  const adminId2 = `adm-op2-${testSuffix}`;
  const adminName1 = `Operator Budi ${testSuffix}`;
  const adminName2 = `Operator Siti ${testSuffix}`;

  let employeeId: number | string;
  let reqId1: number | string;
  let reqId2: number | string;
  let reqIdPending: number | string;

  beforeAll(async () => {
    adminToken = await sign(
      {
        sub: "admin-ewa-test",
        name: "Admin EWA",
        role: "admin",
        email: `admin-ewa-${testSuffix}@example.com`,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secretKey
    );

    // Insert 2 test admins
    await db.run(
      `INSERT INTO admins (id, email, password, role, name) VALUES (?, ?, 'secret', 'operator', ?)`,
      [adminId1, `op1_${testSuffix}@example.com`, adminName1]
    );
    await db.run(
      `INSERT INTO admins (id, email, password, role, name) VALUES (?, ?, 'secret', 'operator', ?)`,
      [adminId2, `op2_${testSuffix}@example.com`, adminName2]
    );

    // Insert test employee
    const empRes = await db
      .query(
        `INSERT INTO employees (
          employer_id, name, email, nik, nip, department, position, base_salary,
          status, bank_name, bank_account_number, bank_account_holder
        ) VALUES (
          1, ?, ?, '1234567890123456', ?, 'IT', 'Engineer', 6000000,
          'active', 'Bank BCA', '9876543210', ?
        ) RETURNING id`
      )
      .get<{ id: number | string }>(
        `Karyawan Operator Test ${testSuffix}`,
        `karyawan_${testSuffix}@example.com`,
        `NIP-OP-${testSuffix}`,
        `Karyawan Operator Test ${testSuffix}`
      );
    employeeId = empRes!.id;

    // Insert test withdrawal requests:
    // 1. Disbursed by adminId1
    const r1 = await db
      .query(
        `INSERT INTO withdrawal_requests (
          employer_id, employee_id, amount, status, period_month, pay_period_start, pay_period_end,
          fee, fee_percentage, destination_bank_name, destination_account_number, destination_account_holder,
          disbursed_by, transferred_at
        ) VALUES (
          1, ?, 1000000, 'transferred', '2026-10', '2026-10-01', '2026-10-31',
          25000, 2.5, 'Bank BCA', '9876543210', 'Karyawan',
          ?, '2026-10-15 10:00:00'
        ) RETURNING id`
      )
      .get<{ id: number | string }>(employeeId, adminId1);
    reqId1 = r1!.id;

    // 2. Disbursed by adminId2
    const r2 = await db
      .query(
        `INSERT INTO withdrawal_requests (
          employer_id, employee_id, amount, status, period_month, pay_period_start, pay_period_end,
          fee, fee_percentage, destination_bank_name, destination_account_number, destination_account_holder,
          disbursed_by, transferred_at
        ) VALUES (
          1, ?, 1500000, 'transferred', '2026-10', '2026-10-01', '2026-10-31',
          37500, 2.5, 'Bank BCA', '9876543210', 'Karyawan',
          ?, '2026-10-16 11:00:00'
        ) RETURNING id`
      )
      .get<{ id: number | string }>(employeeId, adminId2);
    reqId2 = r2!.id;

    // 3. Pending (disbursed_by IS NULL)
    const r3 = await db
      .query(
        `INSERT INTO withdrawal_requests (
          employer_id, employee_id, amount, status, period_month, pay_period_start, pay_period_end,
          fee, fee_percentage, destination_bank_name, destination_account_number, destination_account_holder,
          disbursed_by
        ) VALUES (
          1, ?, 500000, 'pending_transfer', '2026-10', '2026-10-01', '2026-10-31',
          12500, 2.5, 'Bank BCA', '9876543210', 'Karyawan',
          NULL
        ) RETURNING id`
      )
      .get<{ id: number | string }>(employeeId);
    reqIdPending = r3!.id;
  });

  afterAll(async () => {
    if (reqId1 || reqId2 || reqIdPending) {
      await db.run(
        `DELETE FROM withdrawal_requests WHERE id IN (?, ?, ?)`,
        [reqId1, reqId2, reqIdPending]
      );
    }
    if (employeeId) {
      await db.run(`DELETE FROM employees WHERE id = ?`, [employeeId]);
    }
    await db.run(`DELETE FROM admins WHERE id IN (?, ?)`, [adminId1, adminId2]);
  });

  test("GET /api/v1/ewa/operators requires authentication", async () => {
    const res = await server.fetch(
      new Request("http://localhost/api/v1/ewa/operators", {
        method: "GET",
      })
    );
    expect(res.status).toBe(401);
  });

  test("GET /api/v1/ewa/operators returns distinct list of operators", async () => {
    const res = await server.fetch(
      new Request("http://localhost/api/v1/ewa/operators", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const op1 = body.data.find((o: any) => o.id === adminId1);
    const op2 = body.data.find((o: any) => o.id === adminId2);
    expect(op1).toBeDefined();
    expect(op1.name).toBe(adminName1);
    expect(op2).toBeDefined();
    expect(op2.name).toBe(adminName2);
  });

  test("GET /api/v1/ewa/requests filters by disbursedBy correctly", async () => {
    // Filter for adminId1
    const res1 = await server.fetch(
      new Request(`http://localhost/api/v1/ewa/requests?disbursedBy=${adminId1}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
    );

    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.success).toBe(true);
    expect(body1.data.length).toBeGreaterThan(0);
    // Every request returned must be disbursed by adminId1
    for (const req of body1.data) {
      expect(req.disbursedBy).toBe(adminId1);
    }
    const hasReq1 = body1.data.some((r: any) => String(r.id) === String(reqId1));
    const hasReq2 = body1.data.some((r: any) => String(r.id) === String(reqId2));
    expect(hasReq1).toBe(true);
    expect(hasReq2).toBe(false);

    // Filter for adminId2
    const res2 = await server.fetch(
      new Request(`http://localhost/api/v1/ewa/requests?disbursedBy=${adminId2}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
    );

    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.success).toBe(true);
    expect(body2.data.length).toBeGreaterThan(0);
    for (const req of body2.data) {
      expect(req.disbursedBy).toBe(adminId2);
    }
    const hasReq2In2 = body2.data.some((r: any) => String(r.id) === String(reqId2));
    const hasReq1In2 = body2.data.some((r: any) => String(r.id) === String(reqId1));
    expect(hasReq2In2).toBe(true);
    expect(hasReq1In2).toBe(false);
  });

  test("GET /api/v1/ewa/requests returns empty when disbursedBy does not match", async () => {
    const res = await server.fetch(
      new Request(`http://localhost/api/v1/ewa/requests?disbursedBy=non-existent-operator-id`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(0);
    expect(body.total).toBe(0);
  });
});
