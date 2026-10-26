import { expect, test, describe } from "bun:test";
import { sign } from "hono/jwt";
import server from "../index";
import { secretKey } from "../middleware";

async function viewerToken(): Promise<string> {
  return sign(
    { email: "viewer@example.com", role: "viewer", exp: Math.floor(Date.now() / 1000) + 3600 },
    secretKey
  );
}

async function adminToken(): Promise<string> {
  return sign(
    { email: "admin@example.com", role: "admin", exp: Math.floor(Date.now() / 1000) + 3600 },
    secretKey
  );
}

describe("granular RBAC: cashflow, npl, reports", () => {
  test("viewer is forbidden from cashflow, npl, and reports", async () => {
    const token = await viewerToken();
    const headers = { Authorization: `Bearer ${token}` };

    const endpoints = [
      "http://localhost/api/v1/cashflow",
      "http://localhost/api/v1/npl",
      "http://localhost/api/v1/reports/summary",
      `http://localhost/api/v1/reports/monthly-interest?year=${new Date().getFullYear()}`,
    ];

    for (const url of endpoints) {
      const res = await server.fetch(new Request(url, { headers }));
      expect(res.status).toBe(403);
      const body = (await res.json()) as { success: boolean; message: string };
      expect(body.success).toBe(false);
      expect(body.message).toContain("Forbidden");
    }
  });

  test("admin can access cashflow, npl, and reports", async () => {
    const token = await adminToken();
    const headers = { Authorization: `Bearer ${token}` };

    const endpoints = [
      "http://localhost/api/v1/cashflow",
      "http://localhost/api/v1/npl",
      "http://localhost/api/v1/reports/summary",
      `http://localhost/api/v1/reports/monthly-interest?year=${new Date().getFullYear()}`,
    ];

    for (const url of endpoints) {
      const res = await server.fetch(new Request(url, { headers }));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
    }
  });

  test("viewer can still access dashboard stats", async () => {
    const token = await viewerToken();
    const res = await server.fetch(
      new Request("http://localhost/api/v1/stats", {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    expect(res.status).toBe(200);
  });

  test("viewer is forbidden from accessing ewa company employees data and mutations", async () => {
    const token = await viewerToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // GET /api/v1/ewa/employees should be forbidden for viewer
    const getRes = await server.fetch(
      new Request("http://localhost/api/v1/ewa/employees", { headers })
    );
    expect(getRes.status).toBe(403);
    const getBody = (await getRes.json()) as { success: boolean; message: string };
    expect(getBody.success).toBe(false);
    expect(getBody.message).toContain("Forbidden");

    // POST /api/v1/ewa/employees should be forbidden for viewer
    const postRes = await server.fetch(
      new Request("http://localhost/api/v1/ewa/employees", {
        method: "POST",
        headers,
        body: JSON.stringify({
          nip: "EMP-TEST",
          name: "Test Employee",
          email: "test@example.com",
          baseSalary: 5000000,
        }),
      })
    );
    expect(postRes.status).toBe(403);

    // POST /api/v1/ewa/employees/batch-import should be forbidden for viewer
    const batchRes = await server.fetch(
      new Request("http://localhost/api/v1/ewa/employees/batch-import", {
        method: "POST",
        headers,
        body: JSON.stringify({
          items: [
            {
              nip: "EMP-TEST",
              name: "Test Employee",
              email: "test@example.com",
              baseSalary: 5000000,
            },
          ],
        }),
      })
    );
    expect(batchRes.status).toBe(403);
  });

  test("admin can access ewa company employees list", async () => {
    const token = await adminToken();
    const headers = { Authorization: `Bearer ${token}` };

    const res = await server.fetch(
      new Request("http://localhost/api/v1/ewa/employees", { headers })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: any[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("viewer can still access ewa requests and fee tiers", async () => {
    const token = await viewerToken();
    const headers = { Authorization: `Bearer ${token}` };

    const reqRes = await server.fetch(
      new Request("http://localhost/api/v1/ewa/requests", { headers })
    );
    expect(reqRes.status).toBe(200);

    const tierRes = await server.fetch(
      new Request("http://localhost/api/v1/ewa/fee-tiers", { headers })
    );
    expect(tierRes.status).toBe(200);
  });
});