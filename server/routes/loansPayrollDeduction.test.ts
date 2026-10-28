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
});
