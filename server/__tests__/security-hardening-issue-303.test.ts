import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { sign } from "hono/jwt";
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import server from "../index";
import db from "../db";
import { secretKey } from "../middleware";

describe("Security Hardening (Issue #303)", () => {
  let adminToken: string;
  let memberAToken: string;
  let memberBToken: string;
  const memberAId = "member-sec-001";
  const memberBId = "member-sec-002";
  const loanAId = "loan-sec-001";
  const depositAId = "deposit-sec-001";

  const loanFileName = `1730000000_${memberAId}_test123_dokumen.pdf`;
  const savingsFileName = `1730000000_${memberAId}_test123_struk.jpg`;

  const loansDir = join(process.cwd(), "uploads", "loans");
  const savingsDir = join(process.cwd(), "uploads", "savings");

  beforeAll(async () => {
    // Setup directory
    mkdirSync(loansDir, { recursive: true });
    mkdirSync(savingsDir, { recursive: true });

    // Create dummy physical files with valid magic bytes
    const pdfBytes = Buffer.from("%PDF-1.5 test document content for loan attachment");
    writeFileSync(join(loansDir, loanFileName), pdfBytes);

    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    writeFileSync(join(savingsDir, savingsFileName), jpegBytes);

    // Create test members and admin in db
    await db.run("DELETE FROM members WHERE id IN (?, ?)", [memberAId, memberBId]);
    await db.run(
      `INSERT INTO members (id, name, email, role, status, phone, joinDate, totalSavings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberAId, "Member A", "memberA@sec.test", "Anggota", "Aktif", "0812345678", "2026-01-01", 0]
    );
    await db.run(
      `INSERT INTO members (id, name, email, role, status, phone, joinDate, totalSavings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberBId, "Member B", "memberB@sec.test", "Anggota", "Aktif", "0812345679", "2026-01-01", 0]
    );

    // Create test loan and savings deposit
    await db.run("DELETE FROM loans WHERE id = ?", [loanAId]);
    await db.run(
      `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt, "attachmentUrl", "attachmentName")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [loanAId, memberAId, "Member A", 5000000, 12, "Renovasi", "Disetujui", "2026-10-30", `/uploads/loans/${loanFileName}`, "dokumen.pdf"]
    );

    await db.run("DELETE FROM savings_deposits WHERE id = ?", [depositAId]);
    await db.run(
      `INSERT INTO savings_deposits (id, member_id, amount, savings_type, status, proof_url, proof_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [depositAId, memberAId, 500000, "Sukarela", "Menunggu", `/uploads/savings/${savingsFileName}`, "struk.jpg"]
    );

    // Generate JWT tokens
    adminToken = await sign(
      { sub: "admin-sec-id", role: "admin", exp: Math.floor(Date.now() / 1000) + 3600, jti: crypto.randomUUID() },
      secretKey
    );
    memberAToken = await sign(
      { sub: memberAId, role: "member", email: "memberA@sec.test", exp: Math.floor(Date.now() / 1000) + 3600, jti: crypto.randomUUID() },
      secretKey
    );
    memberBToken = await sign(
      { sub: memberBId, role: "member", email: "memberB@sec.test", exp: Math.floor(Date.now() / 1000) + 3600, jti: crypto.randomUUID() },
      secretKey
    );
  });

  afterAll(async () => {
    // Cleanup files
    try {
      if (existsSync(join(loansDir, loanFileName))) unlinkSync(join(loansDir, loanFileName));
      if (existsSync(join(savingsDir, savingsFileName))) unlinkSync(join(savingsDir, savingsFileName));
    } catch {}

    // Cleanup db
    await db.run("DELETE FROM loans WHERE id = ?", [loanAId]);
    await db.run("DELETE FROM savings_deposits WHERE id = ?", [depositAId]);
    await db.run("DELETE FROM members WHERE id IN (?, ?)", [memberAId, memberBId]);
    await db.run("DELETE FROM rate_limits");
  });

  // ---------------------------------------------------------------------------
  // 1. Proteksi Berkas Finansial & IDOR
  // ---------------------------------------------------------------------------
  describe("File Access Protection & IDOR Proof", () => {
    test("GET /uploads/loans/:filename without token returns 401 Unauthorized", async () => {
      const res = await server.fetch(new Request(`http://localhost/uploads/loans/${loanFileName}`));
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    test("GET /uploads/savings/:filename without token returns 401 Unauthorized", async () => {
      const res = await server.fetch(new Request(`http://localhost/uploads/savings/${savingsFileName}`));
      expect(res.status).toBe(401);
    });

    test("GET /uploads/loans/:filename with other member's token returns 403 Forbidden (IDOR)", async () => {
      const res = await server.fetch(
        new Request(`http://localhost/uploads/loans/${loanFileName}`, {
          headers: { Authorization: `Bearer ${memberBToken}` },
        })
      );
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.message).toContain("Akses ditolak");
    });

    test("GET /uploads/savings/:filename with other member's token returns 403 Forbidden (IDOR)", async () => {
      const res = await server.fetch(
        new Request(`http://localhost/uploads/savings/${savingsFileName}`, {
          headers: { Authorization: `Bearer ${memberBToken}` },
        })
      );
      expect(res.status).toBe(403);
    });

    test("GET /uploads/loans/:filename with owner member token returns 200 OK", async () => {
      const res = await server.fetch(
        new Request(`http://localhost/uploads/loans/${loanFileName}`, {
          headers: { Authorization: `Bearer ${memberAToken}` },
        })
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/pdf");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });

    test("GET /uploads/loans/:filename with owner token via query param ?token= returns 200 OK", async () => {
      const res = await server.fetch(
        new Request(`http://localhost/uploads/loans/${loanFileName}?token=${encodeURIComponent(memberAToken)}`)
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/pdf");
    });

    test("GET /uploads/loans/:filename with admin token returns 200 OK", async () => {
      const res = await server.fetch(
        new Request(`http://localhost/uploads/loans/${loanFileName}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      );
      expect(res.status).toBe(200);
    });

    test("GET /api/v1/loans/:id/attachment endpoint enforces IDOR protection", async () => {
      // Unauthenticated
      const unauth = await server.fetch(new Request(`http://localhost/api/v1/loans/${loanAId}/attachment`));
      expect(unauth.status).toBe(401);

      // Other member
      const other = await server.fetch(
        new Request(`http://localhost/api/v1/loans/${loanAId}/attachment`, {
          headers: { Authorization: `Bearer ${memberBToken}` },
        })
      );
      expect(other.status).toBe(403);

      // Owner member
      const owner = await server.fetch(
        new Request(`http://localhost/api/v1/loans/${loanAId}/attachment`, {
          headers: { Authorization: `Bearer ${memberAToken}` },
        })
      );
      expect(owner.status).toBe(200);

      // Admin
      const admin = await server.fetch(
        new Request(`http://localhost/api/v1/loans/${loanAId}/attachment`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      );
      expect(admin.status).toBe(200);
    });

    test("GET /api/v1/savings/deposits/:id/proof endpoint enforces IDOR protection", async () => {
      // Unauthenticated
      const unauth = await server.fetch(new Request(`http://localhost/api/v1/savings/deposits/${depositAId}/proof`));
      expect(unauth.status).toBe(401);

      // Other member
      const other = await server.fetch(
        new Request(`http://localhost/api/v1/savings/deposits/${depositAId}/proof`, {
          headers: { Authorization: `Bearer ${memberBToken}` },
        })
      );
      expect(other.status).toBe(403);

      // Owner member
      const owner = await server.fetch(
        new Request(`http://localhost/api/v1/savings/deposits/${depositAId}/proof`, {
          headers: { Authorization: `Bearer ${memberAToken}` },
        })
      );
      expect(owner.status).toBe(200);
      expect(owner.headers.get("Content-Type")).toBe("image/jpeg");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Validasi Magic Bytes Upload
  // ---------------------------------------------------------------------------
  describe("Magic Bytes Upload Validation", () => {
    test("rejects upload with fake extension (text file named fake.pdf)", async () => {
      const formData = new FormData();
      const fakePdfFile = new File(["This is purely plain text disguised as pdf"], "fake.pdf", { type: "application/pdf" });
      formData.append("file", fakePdfFile);

      const res = await server.fetch(
        new Request("http://localhost/api/v1/upload/loan-attachment", {
          method: "POST",
          headers: { Authorization: `Bearer ${memberAToken}` },
          body: formData,
        })
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.message).toContain("tanda tangan biner");
    });

    test("accepts upload with authentic PDF magic bytes", async () => {
      const formData = new FormData();
      const realPdfBytes = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
      const realPdfFile = new File([realPdfBytes], "valid_ktp.pdf", { type: "application/pdf" });
      formData.append("file", realPdfFile);

      const res = await server.fetch(
        new Request("http://localhost/api/v1/upload/loan-attachment", {
          method: "POST",
          headers: { Authorization: `Bearer ${memberAToken}` },
          body: formData,
        })
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.url).toContain(`/uploads/loans/`);
      expect(json.data.type).toBe("application/pdf");

      // Cleanup uploaded file
      const uploadedPath = join(process.cwd(), json.data.url);
      if (existsSync(uploadedPath)) unlinkSync(uploadedPath);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Member Token Invalidation on Logout
  // ---------------------------------------------------------------------------
  describe("Member Session & Logout Invalidation", () => {
    test("member logout invalidates the access token via jti blacklist", async () => {
      // 1. Login member to get fresh token with jti
      await db.run("UPDATE members SET password = ? WHERE id = ?", [await Bun.password.hash("memberPass123"), memberAId]);

      const loginRes = await server.fetch(
        new Request("http://localhost/api/v1/member-auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "memberA@sec.test", password: "memberPass123" }),
        })
      );
      expect(loginRes.status).toBe(200);
      const loginBody = await loginRes.json();
      const sessionToken = loginBody.data.token;
      expect(sessionToken).toBeDefined();

      // 2. Verify token works
      const testReq = await server.fetch(
        new Request("http://localhost/api/v1/portal/profile", {
          headers: { Authorization: `Bearer ${sessionToken}` },
        })
      );
      expect(testReq.status).toBe(200);

      // 3. Logout member
      const logoutRes = await server.fetch(
        new Request("http://localhost/api/v1/member-auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${sessionToken}` },
        })
      );
      expect(logoutRes.status).toBe(200);

      // 4. Immediately try to use the token again -> must be rejected (401)
      const afterLogout = await server.fetch(
        new Request("http://localhost/api/v1/portal/profile", {
          headers: { Authorization: `Bearer ${sessionToken}` },
        })
      );
      expect(afterLogout.status).toBe(401);
      const afterLogoutJson = await afterLogout.json();
      expect(afterLogoutJson.message).toBe("Token is blacklisted");
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Dual-Key Rate Limiting on Login (IP + Target Account Email)
  // ---------------------------------------------------------------------------
  describe("Dual-Key Rate Limiting", () => {
    test("brute force attack on single email is blocked after 5 failures even across rotating IPs", async () => {
      const targetEmail = "victim_admin@sec.test";

      // 5 failed attempts from 5 completely different IPs
      for (let i = 1; i <= 5; i++) {
        const res = await server.fetch(
          new Request("http://localhost/api/v1/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-forwarded-for": `198.51.100.${i}`,
            },
            body: JSON.stringify({ email: targetEmail, password: "wrong_password_attempt" }),
          })
        );
        expect(res.status).toBe(401);
      }

      // 6th attempt from a brand-new 6th IP against the same email must be rate-limited (429)
      const blockedRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "198.51.100.99",
          },
          body: JSON.stringify({ email: targetEmail, password: "yet_another_wrong_password" }),
        })
      );
      expect(blockedRes.status).toBe(429);
      const json = await blockedRes.json();
      expect(json.message).toContain("Too many failed login attempts");
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Feedback Route Rate Limiting
  // ---------------------------------------------------------------------------
  describe("Feedback Rate Limiting", () => {
    test("POST /api/v1/feedbacks is rate limited to 5 submissions per IP", async () => {
      const ip = "203.0.113.88";

      // Submit 5 feedbacks
      for (let i = 0; i < 5; i++) {
        const res = await server.fetch(
          new Request("http://localhost/api/v1/feedbacks", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-forwarded-for": ip,
            },
            body: JSON.stringify({
              type: "bug",
              title: `Feedback item ${i}`,
              description: "Testing rate limit",
            }),
          })
        );
        expect(res.status).toBe(201);
      }

      // 6th feedback from same IP must be rate limited (429)
      const sixth = await server.fetch(
        new Request("http://localhost/api/v1/feedbacks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": ip,
          },
          body: JSON.stringify({
            type: "bug",
            title: "Feedback item 6",
            description: "Testing rate limit",
          }),
        })
      );
      expect(sixth.status).toBe(429);
      const json = await sixth.json();
      expect(json.message).toContain("Terlalu banyak pengiriman masukan");
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Timing Safe Equal on CRON_SECRET
  // ---------------------------------------------------------------------------
  describe("Cron Secret Timing Comparison", () => {
    test("verifies valid CRON_SECRET and rejects invalid without leaking timing", async () => {
      const invalidRes = await server.fetch(
        new Request("http://localhost/api/v1/cron/due-dates", {
          method: "POST",
          headers: { Authorization: "Bearer wrong-secret" },
        })
      );
      expect(invalidRes.status).toBe(401);

      const validRes = await server.fetch(
        new Request("http://localhost/api/v1/cron/due-dates", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.CRON_SECRET || Bun.env.CRON_SECRET || "default-cron-secret"}` },
        })
      );
      expect(validRes.status).toBe(200);
      const json = await validRes.json();
      expect(json.success).toBe(true);
    });
  });
});
