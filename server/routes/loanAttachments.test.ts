import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { sign } from "hono/jwt";
import server from "../index";
import { secretKey } from "../middleware";
import db from "../db";

describe("Loan Multi-Attachments & Supplemental Documents API (Issue #319)", () => {
  let adminToken: string;
  let memberToken1: string;
  let memberToken2: string;

  const testMemberId1 = "mem-loan-att-1";
  const testMemberId2 = "mem-loan-att-2";
  const createdLoanIds: string[] = [];

  beforeAll(async () => {
    adminToken = await sign(
      {
        sub: "admin-att-test",
        name: "Admin Koperasi",
        role: "admin",
        email: "admin@koperasi.com",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secretKey
    );

    memberToken1 = await sign(
      {
        sub: testMemberId1,
        memberId: testMemberId1,
        name: "Member Satu",
        role: "member",
        email: "member1@koperasi.com",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secretKey
    );

    memberToken2 = await sign(
      {
        sub: testMemberId2,
        memberId: testMemberId2,
        name: "Member Dua",
        role: "member",
        email: "member2@koperasi.com",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secretKey
    );

    // Seed test members
    await db.run(
      `INSERT INTO members (id, name, status, role, nik, joindate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, 'Aktif', 'Anggota', '3201019999990021', '2026-01-01', 500000, 100000, 50000, 650000)
       ON CONFLICT (id) DO NOTHING`,
      [testMemberId1, "Member Satu"]
    );
    await db.run(
      `INSERT INTO members (id, name, status, role, nik, joindate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, 'Aktif', 'Anggota', '3201019999990022', '2026-01-01', 500000, 100000, 50000, 650000)
       ON CONFLICT (id) DO NOTHING`,
      [testMemberId2, "Member Dua"]
    );
  });

  afterAll(async () => {
    for (const lid of createdLoanIds) {
      await db.run("DELETE FROM loan_attachments WHERE loan_id = ?", [lid]);
      await db.run("DELETE FROM loans WHERE id = ?", [lid]);
    }
    await db.run("DELETE FROM members WHERE id IN (?, ?)", [testMemberId1, testMemberId2]);
  });

  test("POST /api/v1/portal/loans/apply with multiple attachments saves all records to loan_attachments", async () => {
    const res = await server.fetch(
      new Request("http://localhost:3000/api/v1/portal/loans/apply", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${memberToken1}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: 5000000,
          tenor: 12,
          purpose: "Renovasi Rumah & Biaya Pendidikan",
          attachments: [
            {
              url: "/uploads/loans/doc1_kuitansi.pdf",
              name: "kuitansi.pdf",
              size: 204800,
            },
            {
              url: "/uploads/loans/doc2_foto_atap.jpg",
              name: "foto_atap.jpg",
              size: 512000,
            },
            {
              url: "/uploads/loans/doc3_slik.pdf",
              name: "slik.pdf",
              size: 1048576,
            },
          ],
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.attachments.length).toBe(3);
    createdLoanIds.push(body.data.id);

    // Check database records in loan_attachments
    const dbAttachments = await db
      .query("SELECT * FROM loan_attachments WHERE loan_id = ? ORDER BY created_at ASC")
      .all<any>(body.data.id);

    expect(dbAttachments.length).toBe(3);
    expect(dbAttachments[0].file_name).toBe("kuitansi.pdf");
    expect(dbAttachments[0].is_supplemental).toBe(false);
    expect(dbAttachments[1].file_name).toBe("foto_atap.jpg");
    expect(dbAttachments[2].file_name).toBe("slik.pdf");

    // Check legacy columns backwards compatibility
    const dbLoan = await db
      .query('SELECT "attachmentUrl", "attachmentName" FROM loans WHERE id = ?')
      .get<any>(body.data.id);
    expect(dbLoan.attachmentUrl).toBe("/uploads/loans/doc1_kuitansi.pdf");
    expect(dbLoan.attachmentName).toBe("kuitansi.pdf");
  });

  test("POST /api/v1/portal/loans/apply rejects when attachments count exceeds 5", async () => {
    const res = await server.fetch(
      new Request("http://localhost:3000/api/v1/portal/loans/apply", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${memberToken2}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: 3000000,
          tenor: 6,
          purpose: "Pembelian Elektronik",
          attachments: [
            { url: "/uploads/loans/1.pdf", name: "1.pdf" },
            { url: "/uploads/loans/2.pdf", name: "2.pdf" },
            { url: "/uploads/loans/3.pdf", name: "3.pdf" },
            { url: "/uploads/loans/4.pdf", name: "4.pdf" },
            { url: "/uploads/loans/5.pdf", name: "5.pdf" },
            { url: "/uploads/loans/6.pdf", name: "6.pdf" },
          ],
        }),
      })
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("Maksimal 5 berkas");
  });

  test("GET /api/v1/loans/:id/attachments returns full attachments list for admin", async () => {
    const loanId = createdLoanIds[0];
    const res = await server.fetch(
      new Request(`http://localhost:3000/api/v1/loans/${loanId}/attachments`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(3);
    expect(body.data[0].fileName).toBe("kuitansi.pdf");
    expect(body.data[0].isSupplemental).toBe(false);
  });

  test("POST /api/v1/portal/loans/:id/attachments allows member to upload supplemental document while status is Menunggu", async () => {
    const loanId = createdLoanIds[0];
    const res = await server.fetch(
      new Request(`http://localhost:3000/api/v1/portal/loans/${loanId}/attachments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${memberToken1}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "/uploads/loans/doc_susulan_slip_gaji.pdf",
          name: "slip_gaji_tambahan.pdf",
          size: 300000,
        }),
      })
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.fileName).toBe("slip_gaji_tambahan.pdf");
    expect(body.data.isSupplemental).toBe(true);

    // Verify supplemental document in DB
    const supplemental = await db
      .query("SELECT * FROM loan_attachments WHERE id = ?")
      .get<any>(body.data.id);
    expect(supplemental).toBeDefined();
    expect(supplemental.is_supplemental).toBe(true);
  });

  test("POST /api/v1/portal/loans/:id/attachments prevents unauthorized member from adding documents (IDOR guard)", async () => {
    const loanId = createdLoanIds[0];
    const res = await server.fetch(
      new Request(`http://localhost:3000/api/v1/portal/loans/${loanId}/attachments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${memberToken2}`, // Member 2 trying to add to Member 1's loan
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "/uploads/loans/doc_attacker.pdf",
          name: "attacker.pdf",
        }),
      })
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("Akses ditolak");
  });

  test("DELETE /api/v1/portal/loans/:id/attachments/:attachmentId deletes supplemental document", async () => {
    const loanId = createdLoanIds[0];
    // Get supplemental document ID
    const supplemental = await db
      .query("SELECT id FROM loan_attachments WHERE loan_id = ? AND is_supplemental = true LIMIT 1")
      .get<any>(loanId);
    expect(supplemental).toBeDefined();

    const res = await server.fetch(
      new Request(`http://localhost:3000/api/v1/portal/loans/${loanId}/attachments/${supplemental.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${memberToken1}`,
        },
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);

    // Verify deleted
    const checkDb = await db
      .query("SELECT id FROM loan_attachments WHERE id = ?")
      .get<any>(supplemental.id);
    expect(checkDb).toBeNull();
  });

  test("DELETE /api/v1/portal/loans/:id/attachments/:attachmentId rejects deleting initial document", async () => {
    const loanId = createdLoanIds[0];
    const initialDoc = await db
      .query("SELECT id FROM loan_attachments WHERE loan_id = ? AND is_supplemental = false LIMIT 1")
      .get<any>(loanId);
    expect(initialDoc).toBeDefined();

    const res = await server.fetch(
      new Request(`http://localhost:3000/api/v1/portal/loans/${loanId}/attachments/${initialDoc.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${memberToken1}`,
        },
      })
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("Dokumen awal");
  });

  test("POST /api/v1/portal/loans/:id/attachments rejects adding supplemental document when loan is already Disetujui", async () => {
    const loanId = createdLoanIds[0];
    // Update loan status to Disetujui
    await db.run("UPDATE loans SET status = 'Disetujui' WHERE id = ?", [loanId]);

    const res = await server.fetch(
      new Request(`http://localhost:3000/api/v1/portal/loans/${loanId}/attachments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${memberToken1}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "/uploads/loans/late_doc.pdf",
          name: "late_doc.pdf",
        }),
      })
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("status Menunggu");
  });
});
