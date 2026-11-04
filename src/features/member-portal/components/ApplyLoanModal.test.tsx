import { expect, test, describe, beforeEach, afterEach, spyOn } from "bun:test";
import { render, cleanup, screen, fireEvent, act } from "@testing-library/react";
import { ApplyLoanModal } from "./ApplyLoanModal";

describe("ApplyLoanModal Multi-Attachments (Issue #319)", () => {
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation(((url: any, _opts: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/v1/upload/loan-attachment")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                url: "/uploads/loans/test-file.pdf",
                name: "test-file.pdf",
                size: 102400,
                type: "application/pdf",
              },
            }),
        } as any);
      }

      if (urlStr.includes("/api/v1/portal/loans/apply")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              message: "Pengajuan pinjaman berhasil dikirim!",
              data: { id: "loan-123" },
            }),
        } as any);
      }

      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) } as any);
    }) as any);
  });

  afterEach(() => {
    cleanup();
    fetchSpy?.mockRestore?.();
  });

  test("renders modal with multi-file upload support and allows removing uploaded file", async () => {
    const handleClose = spyOn({ fn: () => {} }, "fn");
    const handleSuccess = spyOn({ fn: () => {} }, "fn");

    await act(async () => {
      render(
        <ApplyLoanModal
          isOpen={true}
          onClose={handleClose}
          profile={{ id: "mem-1", name: "Budi", email: "budi@test.com" } as any}
          portalToken="token-123"
          onSuccess={handleSuccess}
        />
      );
    });

    // Verify title and upload area
    expect(screen.getByText("Formulir Pengajuan Pinjaman Baru")).toBeDefined();
    expect(screen.getByText(/Klik untuk Unggah Dokumen \/ Foto Pendukung/)).toBeDefined();

    // Trigger file upload
    const fileInput = document.getElementById("loan-attachment-input") as HTMLInputElement;
    expect(fileInput).toBeDefined();
    expect(fileInput.multiple).toBe(true);

    const dummyFile = new File(["dummy content"], "kuitansi.pdf", { type: "application/pdf" });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [dummyFile] } });
    });

    // Check file rendered in list
    expect(screen.getByText("test-file.pdf")).toBeDefined();
    expect(screen.getByText("Lihat File")).toBeDefined();
    expect(screen.getByText("Hapus")).toBeDefined();

    // Test remove file
    const removeBtn = screen.getByText("Hapus");
    await act(async () => {
      fireEvent.click(removeBtn);
    });

    // File should be removed from view
    expect(screen.queryByText("test-file.pdf")).toBeNull();
  });

  test("submits form with attachments array payload", async () => {
    const handleClose = spyOn({ fn: () => {} }, "fn");
    const handleSuccess = spyOn({ fn: () => {} }, "fn");

    await act(async () => {
      render(
        <ApplyLoanModal
          isOpen={true}
          onClose={handleClose}
          profile={{ id: "mem-1", name: "Budi" } as any}
          portalToken="token-123"
          onSuccess={handleSuccess}
        />
      );
    });

    // Fill nominal and purpose
    const amountInput = screen.getByPlaceholderText("Contoh: 5.000.000");
    const purposeInput = screen.getByPlaceholderText(/Jelaskan keperluan pengajuan pinjaman/);

    await act(async () => {
      fireEvent.change(amountInput, { target: { value: "5000000" } });
      fireEvent.change(purposeInput, { target: { value: "Renovasi Rumah" } });
    });

    // Upload attachment
    const fileInput = document.getElementById("loan-attachment-input") as HTMLInputElement;
    const dummyFile = new File(["content"], "bukti.pdf", { type: "application/pdf" });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [dummyFile] } });
    });

    // Submit form
    const form = fileInput.closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(fetchSpy).toHaveBeenCalled();
    const applyCall = fetchSpy.mock.calls.find((call: any[]) =>
      String(call[0]).includes("/api/v1/portal/loans/apply")
    );
    expect(applyCall).toBeDefined();

    const payload = JSON.parse(applyCall[1].body);
    expect(payload.amount).toBe(5000000);
    expect(payload.purpose).toBe("Renovasi Rumah");
    expect(Array.isArray(payload.attachments)).toBe(true);
    expect(payload.attachments.length).toBe(1);
    expect(payload.attachments[0].url).toBe("/uploads/loans/test-file.pdf");
  });
});
