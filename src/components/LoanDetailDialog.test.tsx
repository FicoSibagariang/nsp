import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { render, screen, cleanup, act } from "@testing-library/react";
import { LoanDetailDialogContent } from "./LoanDetailDialog";
import type { LoanRow } from "@shared/types";
import * as apiQueryModule from "../hooks/useApiQuery";
import * as authModule from "../hooks/useAuth";

const sampleLoan: LoanRow = {
  id: "loan-test-detail",
  memberId: "mem-1",
  name: "Budi Santoso",
  amount: 10000000,
  tenor: 12,
  purpose: "Renovasi Rumah",
  status: "Menunggu",
  createdAt: "2026-10-01T08:00:00.000Z",
};

describe("LoanDetailDialog Multi-Attachments (Issue #319)", () => {
  let useApiQuerySpy: any;
  let useAuthSpy: any;

  beforeEach(() => {
    useAuthSpy = spyOn(authModule, "useAuth").mockReturnValue({
      hasPermission: () => true,
    } as any);

    useApiQuerySpy = spyOn(apiQueryModule, "useApiQuery").mockImplementation((url: string) => {
      if (url.includes("/attachments")) {
        return {
          data: [
            {
              id: "att-1",
              loanId: "loan-test-detail",
              fileName: "kuitansi_utama.pdf",
              fileUrl: "/uploads/loans/kuitansi_utama.pdf",
              fileSize: 204800,
              isSupplemental: false,
              uploadedBy: "mem-1",
              createdAt: "2026-10-01T08:00:00.000Z",
            },
            {
              id: "att-2",
              loanId: "loan-test-detail",
              fileName: "foto_atap_susulan.jpg",
              fileUrl: "/uploads/loans/foto_atap_susulan.jpg",
              fileSize: 512000,
              isSupplemental: true,
              uploadedBy: "mem-1",
              createdAt: "2026-10-05T10:30:00.000Z",
            },
          ],
          isLoading: false,
          refetch: () => {},
        } as any;
      }
      return { data: [], isLoading: false, refetch: () => {} } as any;
    });
  });

  afterEach(() => {
    cleanup();
    useApiQuerySpy?.mockRestore?.();
    useAuthSpy?.mockRestore?.();
  });

  it("renders grouped initial and supplemental documents correctly in admin modal", async () => {
    await act(async () => {
      render(
        <LoanDetailDialogContent
          loan={sampleLoan}
          onClose={() => {}}
          onUpdate={() => {}}
        />
      );
    });

    // Check title & count
    expect(screen.getByText("Dokumen Lampiran Pengajuan (2)")).toBeDefined();

    // Check Dokumen Utama section
    expect(screen.getByText("Dokumen Utama / Awal (1)")).toBeDefined();
    expect(screen.getByText("kuitansi_utama.pdf")).toBeDefined();

    // Check Dokumen Susulan section
    expect(screen.getByText("Dokumen Susulan / Tambahan (1)")).toBeDefined();
    expect(screen.getByText("foto_atap_susulan.jpg")).toBeDefined();

    // Check download buttons
    const downloadBtns = screen.getAllByText("Buka / Unduh");
    expect(downloadBtns.length).toBe(2);
  });
});
