import { expect, test, describe, afterEach, mock } from "bun:test";
import { render, cleanup, screen, fireEvent, act } from "@testing-library/react";
import { RequestsTab } from "./RequestsTab";
import type { EWARequest } from "../types";
import { maskName } from "../../../utils/privacyMask";

describe("RequestsTab Component (#320)", () => {
  afterEach(() => {
    cleanup();
  });

  const dummyOperators = [
    { id: "adm-1", name: "Budi Santoso" },
    { id: "adm-2", name: "Siti Rahma" },
  ];

  const dummyRequests: EWARequest[] = [
    {
      id: "req-1",
      employeeId: "emp-1",
      employeeName: "Andi Pratama",
      employeeNip: "NIP-001",
      isMember: true,
      periodMonth: "2026-10",
      salaryBasis: 5000000,
      maxLimit: 2500000,
      amountRequested: 1000000,
      feePercentage: 2.5,
      feeAmount: 25000,
      disbursedAmount: 1000000,
      totalPayrollDeduction: 1025000,
      destinationBank: "BCA",
      destinationAccount: "123456789",
      destinationName: "Andi Pratama",
      status: "DISBURSED",
      disbursedAt: "2026-10-15T10:00:00Z",
      disbursedBy: "adm-1",
      disbursedByName: "Budi Santoso",
      createdAt: "2026-10-14T08:00:00Z",
    },
  ];

  test("renders 'Operator Pencair' filter and status filter", () => {
    const setReqSearch = mock(() => {});
    const setStatusFilter = mock(() => {});
    const setDisbursedByFilter = mock(() => {});
    const setDisbursedStartDate = mock(() => {});
    const setDisbursedEndDate = mock(() => {});
    const setReqPage = mock(() => {});
    const onDisburse = mock(() => {});
    const onReject = mock(() => {});

    render(
      <RequestsTab
        requests={dummyRequests}
        reqLoading={false}
        reqSearch=""
        setReqSearch={setReqSearch}
        statusFilter=""
        setStatusFilter={setStatusFilter}
        disbursedByFilter=""
        setDisbursedByFilter={setDisbursedByFilter}
        disbursedStartDate=""
        setDisbursedStartDate={setDisbursedStartDate}
        disbursedEndDate=""
        setDisbursedEndDate={setDisbursedEndDate}
        operators={dummyOperators}
        reqPage={1}
        reqLimit={20}
        reqTotal={1}
        setReqPage={setReqPage}
        isDemoMode={false}
        actionLoading={false}
        onDisburse={onDisburse}
        onReject={onReject}
      />
    );

    // Operator Pencair and Status selectors should be rendered
    expect(screen.getByText("Operator Pencair")).toBeDefined();
    expect(screen.getAllByText("Semua Operator").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Status").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Dari Tanggal")).toBeDefined();
    expect(screen.getByText("Sampai Tanggal")).toBeDefined();
    expect(screen.getByPlaceholderText("Cari nama karyawan / NIP...")).toBeDefined();

    // Table should show disbursed by info
    expect(screen.getByText(/oleh Budi Santoso/i)).toBeDefined();
  });

  test("masks operator name and employee name when isDemoMode is true", () => {
    const setReqSearch = mock(() => {});
    const setStatusFilter = mock(() => {});
    const setDisbursedByFilter = mock(() => {});
    const setDisbursedStartDate = mock(() => {});
    const setDisbursedEndDate = mock(() => {});
    const setReqPage = mock(() => {});
    const onDisburse = mock(() => {});
    const onReject = mock(() => {});

    render(
      <RequestsTab
        requests={dummyRequests}
        reqLoading={false}
        reqSearch=""
        setReqSearch={setReqSearch}
        statusFilter=""
        setStatusFilter={setStatusFilter}
        disbursedByFilter=""
        setDisbursedByFilter={setDisbursedByFilter}
        disbursedStartDate=""
        setDisbursedStartDate={setDisbursedStartDate}
        disbursedEndDate=""
        setDisbursedEndDate={setDisbursedEndDate}
        operators={dummyOperators}
        reqPage={1}
        reqLimit={20}
        reqTotal={1}
        setReqPage={setReqPage}
        isDemoMode={true}
        actionLoading={false}
        onDisburse={onDisburse}
        onReject={onReject}
      />
    );

    const maskedOpName = maskName("adm-1", "Budi Santoso");
    expect(screen.getByText(new RegExp(`oleh ${maskedOpName}`, "i"))).toBeDefined();
    // Raw unmasked name should not be present in table text
    expect(screen.queryByText("Budi Santoso")).toBeNull();
  });

  test("typing in search input resets page to 1", () => {
    const setReqSearch = mock(() => {});
    const setStatusFilter = mock(() => {});
    const setDisbursedByFilter = mock(() => {});
    const setDisbursedStartDate = mock(() => {});
    const setDisbursedEndDate = mock(() => {});
    const setReqPage = mock(() => {});
    const onDisburse = mock(() => {});
    const onReject = mock(() => {});

    render(
      <RequestsTab
        requests={dummyRequests}
        reqLoading={false}
        reqSearch=""
        setReqSearch={setReqSearch}
        statusFilter=""
        setStatusFilter={setStatusFilter}
        disbursedByFilter=""
        setDisbursedByFilter={setDisbursedByFilter}
        disbursedStartDate=""
        setDisbursedStartDate={setDisbursedStartDate}
        disbursedEndDate=""
        setDisbursedEndDate={setDisbursedEndDate}
        operators={dummyOperators}
        reqPage={2}
        reqLimit={20}
        reqTotal={1}
        setReqPage={setReqPage}
        isDemoMode={false}
        actionLoading={false}
        onDisburse={onDisburse}
        onReject={onReject}
      />
    );

    const searchInput = screen.getByPlaceholderText("Cari nama karyawan / NIP...");
    fireEvent.change(searchInput, { target: { value: "Andi" } });

    expect(setReqSearch).toHaveBeenCalledWith("Andi");
    expect(setReqPage).toHaveBeenCalledWith(1);
  });

  test("changing date inputs calls setter and resets page to 1", () => {
    const setDisbursedStartDate = mock(() => {});
    const setDisbursedEndDate = mock(() => {});
    const setReqPage = mock(() => {});

    render(
      <RequestsTab
        requests={dummyRequests}
        reqLoading={false}
        reqSearch=""
        setReqSearch={() => {}}
        statusFilter=""
        setStatusFilter={() => {}}
        disbursedByFilter=""
        setDisbursedByFilter={() => {}}
        disbursedStartDate=""
        setDisbursedStartDate={setDisbursedStartDate}
        disbursedEndDate=""
        setDisbursedEndDate={setDisbursedEndDate}
        operators={dummyOperators}
        reqPage={2}
        reqLimit={20}
        reqTotal={1}
        setReqPage={setReqPage}
        isDemoMode={false}
        actionLoading={false}
        onDisburse={() => {}}
        onReject={() => {}}
      />
    );

    const startDateInput = screen.getByLabelText("Dari Tanggal Pencairan");
    fireEvent.change(startDateInput, { target: { value: "2026-10-01" } });
    expect(setDisbursedStartDate).toHaveBeenCalledWith("2026-10-01");
    expect(setReqPage).toHaveBeenCalledWith(1);

    const endDateInput = screen.getByLabelText("Sampai Tanggal Pencairan");
    fireEvent.change(endDateInput, { target: { value: "2026-10-15" } });
    expect(setDisbursedEndDate).toHaveBeenCalledWith("2026-10-15");
    expect(setReqPage).toHaveBeenCalledWith(1);
  });

  test("renders reset date button when date is filled and clears filters on click", () => {
    const setDisbursedStartDate = mock(() => {});
    const setDisbursedEndDate = mock(() => {});
    const setReqPage = mock(() => {});

    render(
      <RequestsTab
        requests={dummyRequests}
        reqLoading={false}
        reqSearch=""
        setReqSearch={() => {}}
        statusFilter=""
        setStatusFilter={() => {}}
        disbursedByFilter=""
        setDisbursedByFilter={() => {}}
        disbursedStartDate="2026-10-01"
        setDisbursedStartDate={setDisbursedStartDate}
        disbursedEndDate="2026-10-15"
        setDisbursedEndDate={setDisbursedEndDate}
        operators={dummyOperators}
        reqPage={3}
        reqLimit={20}
        reqTotal={1}
        setReqPage={setReqPage}
        isDemoMode={false}
        actionLoading={false}
        onDisburse={() => {}}
        onReject={() => {}}
      />
    );

    const resetButton = screen.getByLabelText("Reset filter tanggal");
    expect(resetButton).toBeDefined();

    fireEvent.click(resetButton);
    expect(setDisbursedStartDate).toHaveBeenCalledWith("");
    expect(setDisbursedEndDate).toHaveBeenCalledWith("");
    expect(setReqPage).toHaveBeenCalledWith(1);
  });

  test("renders copy button for disbursed amount in table and copies plain digits", async () => {
    let copiedText = "";
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          copiedText = text;
        },
      },
      configurable: true,
      writable: true,
    });

    render(
      <RequestsTab
        requests={dummyRequests}
        reqLoading={false}
        reqSearch=""
        setReqSearch={() => {}}
        statusFilter=""
        setStatusFilter={() => {}}
        disbursedByFilter=""
        setDisbursedByFilter={() => {}}
        disbursedStartDate=""
        setDisbursedStartDate={() => {}}
        disbursedEndDate=""
        setDisbursedEndDate={() => {}}
        operators={dummyOperators}
        reqPage={1}
        reqLimit={20}
        reqTotal={1}
        setReqPage={() => {}}
        isDemoMode={false}
        actionLoading={false}
        onDisburse={() => {}}
        onReject={() => {}}
      />
    );

    const copyBtns = screen.getAllByLabelText("Salin nominal dicairkan");
    expect(copyBtns.length).toBeGreaterThanOrEqual(2);

    await act(async () => {
      fireEvent.click(copyBtns[1]);
    });

    expect(copiedText).toBe("1000000");
  });

  test("renders summary card with total amount, count, and copies plain digits to clipboard", async () => {
    let copiedText = "";
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          copiedText = text;
        },
      },
      configurable: true,
      writable: true,
    });

    render(
      <RequestsTab
        requests={dummyRequests}
        reqLoading={false}
        reqSearch=""
        setReqSearch={() => {}}
        statusFilter=""
        setStatusFilter={() => {}}
        disbursedByFilter="adm-1"
        setDisbursedByFilter={() => {}}
        disbursedStartDate="2026-10-01"
        setDisbursedStartDate={() => {}}
        disbursedEndDate="2026-10-15"
        setDisbursedEndDate={() => {}}
        operators={dummyOperators}
        summary={{
          totalDisbursedAmount: 12500000,
          totalFeeAmount: 312500,
          totalPayrollDeduction: 12812500,
          totalRequests: 25,
        }}
        reqPage={1}
        reqLimit={20}
        reqTotal={25}
        setReqPage={() => {}}
        isDemoMode={false}
        actionLoading={false}
        onDisburse={() => {}}
        onReject={() => {}}
      />
    );

    // Summary Card header
    expect(screen.getByText("Total Dana Ditransfer")).toBeDefined();
    expect(screen.getByText("25 Transaksi")).toBeDefined();
    expect(screen.getByText(/12\.500\.000/)).toBeDefined();

    // Context filter text
    expect(screen.getByText(/Pencairan oleh Budi Santoso/i)).toBeDefined();

    // Click to copy the total summary amount
    const copySummaryBtn = screen.getByTitle("Klik untuk salin nominal: 12500000");
    await act(async () => {
      fireEvent.click(copySummaryBtn);
    });

    expect(copiedText).toBe("12500000");
  });

  test("masks operator name in summary card context when isDemoMode is true", () => {
    render(
      <RequestsTab
        requests={dummyRequests}
        reqLoading={false}
        reqSearch=""
        setReqSearch={() => {}}
        statusFilter=""
        setStatusFilter={() => {}}
        disbursedByFilter="adm-1"
        setDisbursedByFilter={() => {}}
        disbursedStartDate=""
        setDisbursedStartDate={() => {}}
        disbursedEndDate=""
        setDisbursedEndDate={() => {}}
        operators={dummyOperators}
        summary={{
          totalDisbursedAmount: 5000000,
          totalFeeAmount: 125000,
          totalPayrollDeduction: 5125000,
          totalRequests: 5,
        }}
        reqPage={1}
        reqLimit={20}
        reqTotal={5}
        setReqPage={() => {}}
        isDemoMode={true}
        actionLoading={false}
        onDisburse={() => {}}
        onReject={() => {}}
      />
    );

    const maskedOpName = maskName("adm-1", "Budi Santoso");
    expect(screen.getByText(new RegExp(`Pencairan oleh ${maskedOpName}`, "i"))).toBeDefined();
  });

  test("renders empty state message when no requests match filter", () => {
    render(
      <RequestsTab
        requests={[]}
        reqLoading={false}
        reqSearch=""
        setReqSearch={() => {}}
        statusFilter=""
        setStatusFilter={() => {}}
        disbursedByFilter="adm-1"
        setDisbursedByFilter={() => {}}
        disbursedStartDate="2026-10-01"
        setDisbursedStartDate={() => {}}
        disbursedEndDate="2026-10-15"
        setDisbursedEndDate={() => {}}
        operators={dummyOperators}
        reqPage={1}
        reqLimit={20}
        reqTotal={0}
        setReqPage={() => {}}
        isDemoMode={false}
        actionLoading={false}
        onDisburse={() => {}}
        onReject={() => {}}
      />
    );

    expect(
      screen.getByText("Tidak ditemukan pengajuan EWA yang sesuai dengan filter pencarian.")
    ).toBeDefined();
  });
});
