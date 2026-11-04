import { expect, test, describe, afterEach, mock } from "bun:test";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
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
    expect(screen.getByPlaceholderText("Cari nama karyawan / NIP...")).toBeDefined();

    // Table should show disbursed by info
    expect(screen.getByText(/oleh Budi Santoso/i)).toBeDefined();
  });

  test("masks operator name and employee name when isDemoMode is true", () => {
    const setReqSearch = mock(() => {});
    const setStatusFilter = mock(() => {});
    const setDisbursedByFilter = mock(() => {});
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
