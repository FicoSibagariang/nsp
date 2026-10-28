import type { z } from "zod";

/**
 * Dynamic column mapping dictionary.
 * Maps lowercase key -> canonical camelCase key.
 */
const dynamicColumnKeyMap = new Map<string, string>();

/** Helper to convert snake_case to camelCase */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Register canonical field names into the dynamic dictionary.
 * Automatically enables lowercase Postgres identifiers to map to camelCase
 * without requiring manual additions to a static whitelist array.
 */
export function registerColumnNames(fields: Iterable<string>): void {
  for (const f of fields) {
    if (typeof f === "string" && f.length > 0) {
      dynamicColumnKeyMap.set(f.toLowerCase(), f);
      // Also register snake_case version mapped to camelCase
      const snake = f.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      if (snake !== f) {
        dynamicColumnKeyMap.set(snake, f);
      }
    }
  }
}

/**
 * Extract keys from a Zod schema object if applicable.
 */
export function extractSchemaKeys(schema: z.ZodTypeAny): string[] {
  let curr: any = schema;
  // Unwrap optional, nullable, default, effects, pipeline, etc.
  while (curr) {
    if (curr.shape && typeof curr.shape === "object") {
      return Object.keys(curr.shape);
    }
    if (curr._def) {
      if (curr._def.schema) {
        curr = curr._def.schema;
      } else if (curr._def.innerType) {
        curr = curr._def.innerType;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return [];
}

/**
 * Register all keys defined in a Zod schema.
 */
export function registerSchema(schema: z.ZodTypeAny): void {
  const keys = extractSchemaKeys(schema);
  if (keys.length > 0) {
    registerColumnNames(keys);
  }
}

/**
 * Baseline canonical field names for backwards compatibility.
 */
export const INITIAL_CAMEL_CASE_FIELDS = [
  // members
  "joinDate",
  "simpananPokok",
  "simpananWajib",
  "simpananSukarela",
  "totalSavings",
  "averageSavings",
  // transactions
  "memberId",
  "balanceBefore",
  "balanceAfter",
  "createdAt",
  "createdBy",
  "memberName",
  // loans
  "interestRate",
  "monthlyPayment",
  "interestAmount",
  "totalAmount",
  "approvedAt",
  "scheduleGenerated",
  "totalInstallments",
  "paidInstallments",
  "paidAmount",
  "attachmentUrl",
  "attachmentName",
  "destinationBank",
  "destinationAccount",
  "destinationName",
  "rejectionReason",
  // loan_payments / cashflow aliases
  "loanId",
  "paymentDate",
  "paymentAmount",
  "principalAmount",
  "borrowerName",
  "partyName",
  "flowType",
  "deletedAt",
  "hasPortalAccess",
  // loan_schedules
  "installmentNo",
  "dueDate",
  "lateFee",
  "paidAt",
  "updatedAt",
  "oldestOverdueDate",
  "oldestDueDate",
  // shu
  "biayaOperasional",
  "shuNetto",
  "closedAt",
  "closedBy",
  "savingsShare",
  "loansShare",
  "totalSHU",
  // reports / reconciliation aliases
  "totalMembers",
  "activeMembers",
  "passiveMembers",
  "totalPokok",
  "totalWajib",
  "totalSukarela",
  "totalLoansCount",
  "totalLoansAmount",
  "activeLoansAmount",
  "badLoansAmount",
  "paidLoansAmount",
  "totalPaymentsReceived",
  "dbTotalSavings",
  "calculatedTotal",
  "contractEndDate",
  "payrollMonth",
  "repaymentType",
] as const;

// Prepopulate baseline fields
registerColumnNames(INITIAL_CAMEL_CASE_FIELDS);

/** Dynamic view of COLUMN_KEY_MAP for backward compatibility */
export const COLUMN_KEY_MAP: Readonly<Record<string, string>> = new Proxy(
  {},
  {
    get: (_target, prop: string) => dynamicColumnKeyMap.get(prop.toLowerCase()),
    has: (_target, prop: string) => dynamicColumnKeyMap.has(prop.toLowerCase()),
    ownKeys: () => Array.from(dynamicColumnKeyMap.keys()),
    getOwnPropertyDescriptor: (_target, prop: string) => {
      if (dynamicColumnKeyMap.has(prop.toLowerCase())) {
        return {
          configurable: true,
          enumerable: true,
          value: dynamicColumnKeyMap.get(prop.toLowerCase()),
        };
      }
      return undefined;
    },
  }
);

/** Dynamic view of CAMEL_CASE_FIELDS for backward compatibility */
export const CAMEL_CASE_FIELDS: readonly string[] = new Proxy(
  [],
  {
    get: (target, prop) => {
      if (prop === "length") return dynamicColumnKeyMap.size;
      if (typeof prop === "string" && !isNaN(Number(prop))) {
        return Array.from(dynamicColumnKeyMap.values())[Number(prop)];
      }
      if (prop === "includes") {
        return (item: string) =>
          Array.from(dynamicColumnKeyMap.values()).includes(item);
      }
      return (target as any)[prop];
    },
  }
);

/**
 * Map raw Postgres row to app-facing keys using schema introspection if provided,
 * otherwise falling back to dynamic registry and snake_to_camel normalization.
 */
export function mapRow<T = Record<string, unknown>>(
  row: Record<string, unknown> | null | undefined,
  schema?: z.ZodTypeAny
): T | null {
  if (!row) return null;
  const mapped: Record<string, unknown> = {};

  // Build schema-specific lookup if schema is provided
  const schemaLookup = new Map<string, string>();
  if (schema) {
    const keys = extractSchemaKeys(schema);
    for (const k of keys) {
      schemaLookup.set(k.toLowerCase(), k);
      registerColumnNames([k]);
    }
  }

  for (const [k, v] of Object.entries(row)) {
    const lowerKey = k.toLowerCase();
    const mappedKey =
      schemaLookup.get(lowerKey) ??
      dynamicColumnKeyMap.get(lowerKey) ??
      (k.includes("_") ? snakeToCamel(k) : k);

    mapped[mappedKey] = v;
    if (k.includes("_") && k !== mappedKey) {
      mapped[k] = v;
    }

    // Backward compatibility for rejection_reason
    if (k === "rejection_reason" && mapped.rejectionReason === undefined) {
      mapped.rejectionReason = v;
    }
  }

  return mapped as T;
}

export function mapRows<T = Record<string, unknown>>(
  rows: Array<Record<string, unknown>> | null | undefined,
  schema?: z.ZodTypeAny
): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => mapRow<T>(r, schema)!);
}
