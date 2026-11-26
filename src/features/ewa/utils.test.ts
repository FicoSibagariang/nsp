import { expect, test, describe } from "bun:test";
import { getCurrentEwaCycleRange, getDefaultSettleDate } from "./utils";

describe("EWA Utility Functions (#334)", () => {
  describe("getCurrentEwaCycleRange", () => {
    test("calculates cycle range when current date is between 1 and 25 (e.g. 2026-11-25)", () => {
      // 2026-11-25 -> startDate should be 26th of previous month (2026-10-26), endDate is today (2026-11-25)
      const mockDate = new Date(2026, 10, 25); // Nov is month 10 (0-indexed)
      const range = getCurrentEwaCycleRange(mockDate);
      expect(range.startDate).toBe("2026-10-26");
      expect(range.endDate).toBe("2026-11-25");
    });

    test("calculates cycle range when current date is on 26th (start of new cycle)", () => {
      // 2026-11-26 -> startDate should be 26th of current month (2026-11-26), endDate is today (2026-11-26)
      const mockDate = new Date(2026, 10, 26);
      const range = getCurrentEwaCycleRange(mockDate);
      expect(range.startDate).toBe("2026-11-26");
      expect(range.endDate).toBe("2026-11-26");
    });

    test("calculates cycle range when current date is between 26 and end of month (e.g. 2026-11-30)", () => {
      // 2026-11-30 -> startDate is 2026-11-26, endDate is 2026-11-30
      const mockDate = new Date(2026, 10, 30);
      const range = getCurrentEwaCycleRange(mockDate);
      expect(range.startDate).toBe("2026-11-26");
      expect(range.endDate).toBe("2026-11-30");
    });

    test("handles January 1-25 across year boundary (e.g. 2027-01-15)", () => {
      // 2027-01-15 -> previous month is Dec 2026 -> startDate is 2026-12-26, endDate is 2027-01-15
      const mockDate = new Date(2027, 0, 15);
      const range = getCurrentEwaCycleRange(mockDate);
      expect(range.startDate).toBe("2026-12-26");
      expect(range.endDate).toBe("2027-01-15");
    });

    test("handles January 26-31 (e.g. 2027-01-26)", () => {
      const mockDate = new Date(2027, 0, 26);
      const range = getCurrentEwaCycleRange(mockDate);
      expect(range.startDate).toBe("2027-01-26");
      expect(range.endDate).toBe("2027-01-26");
    });

    test("handles December 26-31 (e.g. 2026-12-31)", () => {
      const mockDate = new Date(2026, 11, 31);
      const range = getCurrentEwaCycleRange(mockDate);
      expect(range.startDate).toBe("2026-12-26");
      expect(range.endDate).toBe("2026-12-31");
    });

    test("defaults to today's date when no parameter is passed", () => {
      const today = new Date();
      const range = getCurrentEwaCycleRange();
      const expectedEnd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      expect(range.endDate).toBe(expectedEnd);
      expect(range.startDate).toMatch(/^\d{4}-\d{2}-26$/);
    });
  });

  describe("getDefaultSettleDate", () => {
    test("returns last day of period month", () => {
      expect(getDefaultSettleDate("2026-11")).toBe("2026-11-30");
      expect(getDefaultSettleDate("2026-02")).toBe("2026-02-28");
    });
  });
});
