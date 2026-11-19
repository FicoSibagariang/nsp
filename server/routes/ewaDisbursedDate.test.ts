import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { sign } from "hono/jwt";
import server from "../index";
import { secretKey } from "../middleware";
import db from "../db";

describe("EWA Disbursed Date Range Filter API (#323)", () => {
  let adminToken: string;

  const testSuffix = Date.now().toString().slice(-6);
  const adminId = `adm-date-${testSuffix}`;
  const adminName = `Admin Date Test ${testSuffix}`;

  let employeeId: number | string;
  let reqId1: number | string;
  let reqId2: number | string;
  let reqIdPending: number | string;
  let reqEarlyMorning: number | string;
  let reqLateNight: number | string;
  let reqNextDayEarly: number | string;

  beforeAll(async () => {
    adminToken = await sign(
      {
        sub: adminId,
        name: adminName,
        role: "admin",
        email: `adm_date_${testSuffix}@example.com`,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secretKey
    );

    // Insert test admin
    await db.run(
      `INSERT INTO admins (id, email, password, role, name) VALUES (?, ?, 'secret', 'admin', ?)`,
      [adminId, `adm_date_${testSuffix}@example.com`, adminName]
    );

    // Insert test employee
    const empRes = await db
      .query(
        `INSERT INTO employees (
          employer_id, name, email, nik, nip, department, position, base_salary,
          status, bank_name, bank_account_number, bank_account_holder
        ) VALUES (
          1, ?, ?, '1234567890123456', ?, 'Finance', 'Analyst', 7000000,
          'active', 'Bank BCA', '1122334455', ?
        ) RETURNING id`
      )
      .get<{ id: number | string }>(
        `Karyawan Date Test ${testSuffix}`,
        `emp_date_${testSuffix}@example.com`,
        `NIP-DATE-${testSuffix}`,
        `Karyawan Date Test ${testSuffix}`
      );
    employeeId = empRes!.id;

    // Insert 3 withdrawal requests:
    // 1. Transferred on 2026-10-10
    const r1 = await db
      .query(
        `INSERT INTO withdrawal_requests (
          employer_id, employee_id, amount, status, period_month, pay_period_start, pay_period_end,
          fee, fee_percentage, destination_bank_name, destination_account_number, destination_account_holder,
          disbursed_by, transferred_at
        ) VALUES (
          1, ?, 1000000, 'transferred', '2026-10', '2026-10-01', '2026-10-31',
          25000, 2.5, 'Bank BCA', '1122334455', 'Karyawan',
          ?, '2026-10-10 09:30:00'
        ) RETURNING id`
      )
      .get<{ id: number | string }>(employeeId, adminId);
    reqId1 = r1!.id;

    // 2. Transferred on 2026-10-20
    const r2 = await db
      .query(
        `INSERT INTO withdrawal_requests (
          employer_id, employee_id, amount, status, period_month, pay_period_start, pay_period_end,
          fee, fee_percentage, destination_bank_name, destination_account_number, destination_account_holder,
          disbursed_by, transferred_at
        ) VALUES (
          1, ?, 1500000, 'transferred', '2026-10', '2026-10-01', '2026-10-31',
          37500, 2.5, 'Bank BCA', '1122334455', 'Karyawan',
          ?, '2026-10-20 16:45:00'
        ) RETURNING id`
      )
      .get<{ id: number | string }>(employeeId, adminId);
    reqId2 = r2!.id;

    // 3. Pending (transferred_at is NULL)
    const r3 = await db
      .query(
        `INSERT INTO withdrawal_requests (
          employer_id, employee_id, amount, status, period_month, pay_period_start, pay_period_end,
          fee, fee_percentage, destination_bank_name, destination_account_number, destination_account_holder,
          disbursed_by, transferred_at
        ) VALUES (
          1, ?, 500000, 'pending_transfer', '2026-10', '2026-10-01', '2026-10-31',
          12500, 2.5, 'Bank BCA', '1122334455', 'Karyawan',
          NULL, NULL
        ) RETURNING id`
      )
      .get<{ id: number | string }>(employeeId);
    reqIdPending = r3!.id;

    // 4. Early morning transaction on 2026-11-15 01:10:41 WIB (UTC: 2026-11-14 18:10:41Z)
    const rEarly = await db
      .query(
        `INSERT INTO withdrawal_requests (
          employer_id, employee_id, amount, status, period_month, pay_period_start, pay_period_end,
          fee, fee_percentage, destination_bank_name, destination_account_number, destination_account_holder,
          disbursed_by, transferred_at
        ) VALUES (
          1, ?, 1200000, 'transferred', '2026-11', '2026-11-01', '2026-11-30',
          30000, 2.5, 'Bank BCA', '1122334455', 'Karyawan',
          ?, '2026-11-14 18:10:41+00'
        ) RETURNING id`
      )
      .get<{ id: number | string }>(employeeId, adminId);
    reqEarlyMorning = rEarly!.id;

    // 5. Late night transaction on 2026-11-15 23:45:00 WIB (UTC: 2026-11-15 16:45:00Z)
    const rLate = await db
      .query(
        `INSERT INTO withdrawal_requests (
          employer_id, employee_id, amount, status, period_month, pay_period_start, pay_period_end,
          fee, fee_percentage, destination_bank_name, destination_account_number, destination_account_holder,
          disbursed_by, transferred_at
        ) VALUES (
          1, ?, 800000, 'transferred', '2026-11', '2026-11-01', '2026-11-30',
          20000, 2.5, 'Bank BCA', '1122334455', 'Karyawan',
          ?, '2026-11-15 16:45:00+00'
        ) RETURNING id`
      )
      .get<{ id: number | string }>(employeeId, adminId);
    reqLateNight = rLate!.id;

    // 6. Next day early morning on 2026-11-16 00:15:00 WIB (UTC: 2026-11-15 17:15:00Z)
    const rNext = await db
      .query(
        `INSERT INTO withdrawal_requests (
          employer_id, employee_id, amount, status, period_month, pay_period_start, pay_period_end,
          fee, fee_percentage, destination_bank_name, destination_account_number, destination_account_holder,
          disbursed_by, transferred_at
        ) VALUES (
          1, ?, 500000, 'transferred', '2026-11', '2026-11-01', '2026-11-30',
          12500, 2.5, 'Bank BCA', '1122334455', 'Karyawan',
          ?, '2026-11-15 17:15:00+00'
        ) RETURNING id`
      )
      .get<{ id: number | string }>(employeeId, adminId);
    reqNextDayEarly = rNext!.id;
  });

  afterAll(async () => {
    const allIds = [reqId1, reqId2, reqIdPending, reqEarlyMorning, reqLateNight, reqNextDayEarly].filter(Boolean);
    if (allIds.length > 0) {
      const placeholders = allIds.map(() => '?').join(', ');
      await db.run(
        `DELETE FROM withdrawal_requests WHERE id IN (${placeholders})`,
        allIds
      );
    }
    if (employeeId) {
      await db.run(`DELETE FROM employees WHERE id = ?`, [employeeId]);
    }
    await db.run(`DELETE FROM admins WHERE id = ?`, [adminId]);
  });

  test("GET /api/v1/ewa/requests filters by disbursedStartDate and disbursedEndDate", async () => {
    const res = await server.fetch(
      new Request(
        `http://localhost/api/v1/ewa/requests?employeeId=${employeeId}&disbursedStartDate=2026-10-01&disbursedEndDate=2026-10-15`,
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
    expect(body.data.length).toBe(1);
    expect(String(body.data[0].id)).toBe(String(reqId1));
  });

  test("GET /api/v1/ewa/requests filters single day accurately (including timestamps throughout that day)", async () => {
    const res = await server.fetch(
      new Request(
        `http://localhost/api/v1/ewa/requests?employeeId=${employeeId}&disbursedStartDate=2026-10-20&disbursedEndDate=2026-10-20`,
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
    expect(body.data.length).toBe(1);
    expect(String(body.data[0].id)).toBe(String(reqId2));
  });

  test("GET /api/v1/ewa/requests excludes pending transactions when date range filter is active", async () => {
    const res = await server.fetch(
      new Request(
        `http://localhost/api/v1/ewa/requests?employeeId=${employeeId}&disbursedStartDate=2026-10-01&disbursedEndDate=2026-10-31`,
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
    // Should include reqId1 and reqId2, but NEVER reqIdPending
    const ids = body.data.map((r: any) => String(r.id));
    expect(ids).toContain(String(reqId1));
    expect(ids).toContain(String(reqId2));
    expect(ids).not.toContain(String(reqIdPending));
  });

  test("GET /api/v1/ewa/requests combines date filter with operator filter", async () => {
    const res = await server.fetch(
      new Request(
        `http://localhost/api/v1/ewa/requests?employeeId=${employeeId}&disbursedBy=${adminId}&disbursedStartDate=2026-10-15&disbursedEndDate=2026-10-25`,
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
    expect(body.data.length).toBe(1);
    expect(String(body.data[0].id)).toBe(String(reqId2));
  });

  test("GET /api/v1/ewa/requests returns empty list when no transactions fall in date range", async () => {
    const res = await server.fetch(
      new Request(
        `http://localhost/api/v1/ewa/requests?employeeId=${employeeId}&disbursedStartDate=2026-11-01&disbursedEndDate=2026-11-05`,
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
    expect(body.data.length).toBe(0);
    expect(body.total).toBe(0);
  });

  test("GET /api/v1/ewa/requests includes early morning WIB transactions (00:00 - 06:59 WIB) when filtering single day with timezone=Asia/Jakarta (#331)", async () => {
    const res = await server.fetch(
      new Request(
        `http://localhost/api/v1/ewa/requests?employeeId=${employeeId}&disbursedStartDate=2026-11-15&disbursedEndDate=2026-11-15&timezone=Asia/Jakarta`,
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
    expect(body.data.length).toBe(2);

    const ids = body.data.map((r: any) => String(r.id));
    // Early morning 01:10 WIB (UTC 18:10 previous day) must be present
    expect(ids).toContain(String(reqEarlyMorning));
    // Late night 23:45 WIB must be present
    expect(ids).toContain(String(reqLateNight));
    // Next day 00:15 WIB must NOT be present
    expect(ids).not.toContain(String(reqNextDayEarly));
  });

  test("GET /api/v1/ewa/requests defaults to Asia/Jakarta timezone when timezone parameter is omitted (#331)", async () => {
    const res = await server.fetch(
      new Request(
        `http://localhost/api/v1/ewa/requests?employeeId=${employeeId}&disbursedStartDate=2026-11-15&disbursedEndDate=2026-11-15`,
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
    expect(body.data.length).toBe(2);

    const ids = body.data.map((r: any) => String(r.id));
    expect(ids).toContain(String(reqEarlyMorning));
    expect(ids).toContain(String(reqLateNight));
  });

  test("GET /api/v1/ewa/requests respects UTC timezone when explicitly requested (#331)", async () => {
    // In UTC:
    // reqEarlyMorning (2026-11-14 18:10:41 UTC) is on 2026-11-14, NOT 2026-11-15
    // reqLateNight (2026-11-15 16:45:00 UTC) is on 2026-11-15
    // reqNextDayEarly (2026-11-15 17:15:00 UTC) is on 2026-11-15
    const res = await server.fetch(
      new Request(
        `http://localhost/api/v1/ewa/requests?employeeId=${employeeId}&disbursedStartDate=2026-11-15&disbursedEndDate=2026-11-15&timezone=UTC`,
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
    expect(body.data.length).toBe(2);

    const ids = body.data.map((r: any) => String(r.id));
    expect(ids).not.toContain(String(reqEarlyMorning));
    expect(ids).toContain(String(reqLateNight));
    expect(ids).toContain(String(reqNextDayEarly));
  });

  test("GET /api/v1/ewa/requests includes early morning transactions in summary card totals (#331)", async () => {
    const res = await server.fetch(
      new Request(
        `http://localhost/api/v1/ewa/requests?employeeId=${employeeId}&disbursedStartDate=2026-11-15&disbursedEndDate=2026-11-15&timezone=Asia/Jakarta`,
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
    // 1.200.000 + 800.000 = 2.000.000
    expect(body.summary.totalDisbursedAmount).toBe(2000000);
    // 30.000 + 20.000 = 50.000
    expect(body.summary.totalFeeAmount).toBe(50000);
  });

  test("GET /api/v1/ewa/requests sanitizes invalid or malicious timezone parameters safely (#331)", async () => {
    const res = await server.fetch(
      new Request(
        `http://localhost/api/v1/ewa/requests?employeeId=${employeeId}&disbursedStartDate=2026-11-15&disbursedEndDate=2026-11-15&timezone=InvalidZone%27;DROP%20TABLE%20users;--`,
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
    // Falls back to Asia/Jakarta cleanly without error
    expect(body.data.length).toBe(2);
  });
});
