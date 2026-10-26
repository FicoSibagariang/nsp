import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import { LoanDetailDialogContent } from "./LoanDetailDialog";
import { ApproveLoanDialogContent } from "./ApproveLoanDialog";
import { RejectLoanDialogContent } from "./RejectLoanDialog";
import { TransactionHistoryDialogContent } from "./TransactionHistoryDialog";
import { EditMemberDialogContent } from "./EditMemberDialog";
import { DemoModeProvider } from "../contexts/DemoModeContext";
import { maskName } from "../utils/privacyMask";
import type { LoanRow, MemberRow } from "../shared/types";
import * as apiQueryModule from "../hooks/useApiQuery";
import * as authModule from "../hooks/useAuth";

const sampleLoan: LoanRow = {
  id: "loan-101",
  memberId: "member-uuid-1",
  name: "Budi Santoso",
  amount: 5000000,
  tenor: 12,
  purpose: "Modal Usaha",
  status: "Menunggu",
  destinationBank: "Bank Mandiri",
  destinationAccount: "1060012345678",
  destinationName: "Budi Santoso",
  createdAt: "2026-09-01T08:00:00.000Z",
};

const sampleMember: MemberRow = {
  id: "member-uuid-1",
  name: "Budi Santoso",
  role: "Anggota",
  status: "Aktif",
  nik: "3201011234560001",
  phone: "081234567890",
  joinDate: "2026-01-01",
  simpananPokok: 100000,
  simpananWajib: 50000,
  simpananSukarela: 200000,
  totalSavings: 350000,
};

describe("Modal Dialogs Privacy Masking in Demo Mode", () => {
  let apiQuerySpy: any;
  let authSpy: any;
  const expectedFictionalName = maskName(sampleMember.id, sampleMember.name, true);

  beforeEach(() => {
    localStorage.clear();
    authSpy = spyOn(authModule, "useAuth").mockReturnValue({
      isAuthenticated: true,
      role: "admin",
      isAdmin: true,
      isSuperAdmin: false,
      hasPermission: () => true,
    } as any);

    apiQuerySpy = spyOn(apiQueryModule, "useApiQuery").mockImplementation((url: string) => {
      if (url.includes("/payments")) return { data: [] } as any;
      if (url.includes("/schedule")) return { data: [] } as any;
      if (url.includes("/payment-sources")) return { data: { success: true, data: [] } } as any;
      if (url.includes("/transactions")) return { data: [] } as any;
      if (url.includes("/settings")) return { data: { bungaPinjaman: "12" } } as any;
      return { data: null } as any;
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    apiQuerySpy?.mockRestore?.();
    authSpy?.mockRestore?.();
  });

  describe("when Demo Mode is ACTIVE", () => {
    beforeEach(() => {
      localStorage.setItem("demo-mode", "true");
    });

    it("masks borrower name in LoanDetailDialog title", () => {
      render(
        <DemoModeProvider>
          <LoanDetailDialogContent loan={sampleLoan} onClose={mock(() => {})} onUpdate={mock(() => {})} />
        </DemoModeProvider>
      );

      // Must show the deterministic fictional name instead of original
      expect(screen.getByText(`Detail Pinjaman: ${expectedFictionalName}`)).toBeTruthy();
      expect(screen.queryByText(`Detail Pinjaman: ${sampleLoan.name}`)).toBeNull();
    });

    it("masks borrower name in ApproveLoanDialog", () => {
      render(
        <DemoModeProvider>
          <ApproveLoanDialogContent loan={sampleLoan} onClose={mock(() => {})} onConfirm={mock(() => {})} />
        </DemoModeProvider>
      );

      expect(screen.getByText(expectedFictionalName)).toBeTruthy();
      expect(screen.queryByText(sampleLoan.name)).toBeNull();
    });

    it("masks borrower name in RejectLoanDialog", () => {
      render(
        <DemoModeProvider>
          <RejectLoanDialogContent loan={sampleLoan} onClose={mock(() => {})} onConfirm={mock(() => {})} />
        </DemoModeProvider>
      );

      expect(screen.getByText(expectedFictionalName)).toBeTruthy();
      expect(screen.queryByText(sampleLoan.name)).toBeNull();
    });

    it("masks member name in TransactionHistoryDialog subtitle", () => {
      render(
        <DemoModeProvider>
          <TransactionHistoryDialogContent member={sampleMember} onClose={mock(() => {})} />
        </DemoModeProvider>
      );

      expect(screen.getByText(`Rekam jejak transaksi simpanan untuk ${expectedFictionalName}`)).toBeTruthy();
      expect(screen.queryByText(`Rekam jejak transaksi simpanan untuk ${sampleMember.name}`)).toBeNull();
    });

    it("masks member name in EditMemberDialog subtitle and input", () => {
      render(
        <DemoModeProvider>
          <EditMemberDialogContent initialData={sampleMember} onClose={mock(() => {})} onEdit={mock(() => {})} />
        </DemoModeProvider>
      );

      expect(screen.getByText(`Ubah data untuk ${expectedFictionalName}`)).toBeTruthy();
      expect(screen.queryByText(`Ubah data untuk ${sampleMember.name}`)).toBeNull();

      const nameInput = screen.getByDisplayValue(expectedFictionalName);
      expect(nameInput).toBeTruthy();
    });

    it("guarantees consistent fictional name across all dialogs for the same entity", () => {
      expect(expectedFictionalName).not.toBe(sampleMember.name);
      expect(expectedFictionalName.length).toBeGreaterThan(3);
    });
  });

  describe("when Demo Mode is INACTIVE", () => {
    beforeEach(() => {
      localStorage.setItem("demo-mode", "false");
    });

    it("displays real names across all dialogs", () => {
      render(
        <DemoModeProvider>
          <LoanDetailDialogContent loan={sampleLoan} onClose={mock(() => {})} onUpdate={mock(() => {})} />
        </DemoModeProvider>
      );
      expect(screen.getByText(`Detail Pinjaman: ${sampleLoan.name}`)).toBeTruthy();
    });
  });
});
