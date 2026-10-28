import { z } from '@hono/zod-openapi'

// ---------------------------------------------------------------------------
// Standard Envelope Schemas (Required by OpenAPI specification)
// ---------------------------------------------------------------------------

export const ApiSuccessEnvelope = z
  .object({
    success: z.literal(true).openapi({ example: true }),
  })
  .openapi('ApiSuccessEnvelope')

export const ApiMessageEnvelope = z
  .object({
    success: z.literal(true).openapi({ example: true }),
    message: z.string().openapi({ example: 'Operasi berhasil dilakukan' }),
    id: z.string().optional().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
  })
  .openapi('ApiMessageEnvelope')

export const ApiErrorEnvelope = z
  .object({
    success: z.literal(false).openapi({ example: false }),
    message: z.string().openapi({ example: 'Terjadi kesalahan pada permintaan' }),
    errors: z.record(z.string(), z.any()).optional().openapi({ description: 'Detail kesalahan validasi Zod' }),
  })
  .openapi('ApiErrorEnvelope')

export const ApiDataEnvelope = z
  .object({
    success: z.literal(true).openapi({ example: true }),
    data: z.any().openapi({ description: 'Payload utama respons' }),
  })
  .openapi('ApiDataEnvelope')

export const PaginatedListSchema = z
  .object({
    data: z.array(z.any()),
    total: z.number().int().openapi({ example: 42 }),
    page: z.number().int().optional().openapi({ example: 1 }),
    limit: z.number().int().optional().openapi({ example: 20 }),
  })
  .openapi('PaginatedList')

// ---------------------------------------------------------------------------
// Auth Schemas
// ---------------------------------------------------------------------------

export const LoginInputSchema = z
  .object({
    email: z.string().email().openapi({ example: 'admin@koperasi.com' }),
    password: z.string().min(1).openapi({ example: 'password123' }),
  })
  .openapi('LoginInput')

export const GoogleAuthInputSchema = z
  .object({
    credential: z.string().min(1).openapi({ example: 'eyJhbGciOiJSUzI1NiIs...' }),
  })
  .openapi('GoogleAuthInput')

export const MemberLoginInputSchema = z
  .object({
    identifier: z.string().min(1).openapi({ example: 'anggota@koperasi.com atau NIK/Nomor Anggota' }),
    password: z.string().min(1).openapi({ example: 'password123' }),
  })
  .openapi('MemberLoginInput')

export const AuthResponseDataSchema = z
  .object({
    token: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }),
    role: z.string().openapi({ example: 'admin' }),
    name: z.string().optional().openapi({ example: 'Pengurus Koperasi' }),
    user: z.record(z.string(), z.any()).optional(),
  })
  .openapi('AuthResponseData')

export const AuthResponseEnvelope = z
  .object({
    success: z.literal(true),
    data: AuthResponseDataSchema,
  })
  .openapi('AuthResponseEnvelope')

// ---------------------------------------------------------------------------
// Member Schemas
// ---------------------------------------------------------------------------

export const MemberItemSchema = z
  .object({
    id: z.string().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    name: z.string().openapi({ example: 'Budi Santoso' }),
    role: z.string().openapi({ example: 'Anggota' }),
    status: z.string().openapi({ example: 'Aktif' }),
    joinDate: z.string().openapi({ example: '2026-01-15' }),
    nik: z.string().nullable().optional().openapi({ example: '1234567890123456' }),
    phone: z.string().nullable().optional().openapi({ example: '+628123456789' }),
    simpananPokok: z.number().openapi({ example: 100000 }),
    simpananWajib: z.number().openapi({ example: 50000 }),
    simpananSukarela: z.number().openapi({ example: 250000 }),
    totalSavings: z.number().openapi({ example: 400000 }),
  })
  .openapi('MemberItem')

export const MemberCreateInputSchema = z
  .object({
    name: z.string().min(1).openapi({ example: 'Budi Santoso' }),
    role: z.string().optional().default('Anggota').openapi({ example: 'Anggota' }),
    status: z.string().optional().default('Aktif').openapi({ example: 'Aktif' }),
    joinDate: z.string().min(1).openapi({ example: '2026-01-15' }),
    nik: z.string().nullable().optional().openapi({ example: '1234567890123456' }),
    phone: z.string().nullable().optional().openapi({ example: '+628123456789' }),
    simpananPokok: z.number().nonnegative().optional().default(0),
    simpananWajib: z.number().nonnegative().optional().default(0),
    simpananSukarela: z.number().nonnegative().optional().default(0),
    email: z.string().email().nullable().optional(),
    password: z.string().min(6).nullable().optional(),
  })
  .openapi('MemberCreateInput')

export const MemberUpdateInputSchema = z
  .object({
    name: z.string().min(1).openapi({ example: 'Budi Santoso' }),
    role: z.string().optional().openapi({ example: 'Anggota' }),
    status: z.string().optional().openapi({ example: 'Aktif' }),
    nik: z.string().nullable().optional().openapi({ example: '1234567890123456' }),
    phone: z.string().nullable().optional().openapi({ example: '+628123456789' }),
  })
  .openapi('MemberUpdateInput')

export const MemberSavingsInputSchema = z
  .object({
    simpananPokok: z.number().nonnegative().optional(),
    simpananWajib: z.number().nonnegative().optional(),
    simpananSukarela: z.number().nonnegative().optional(),
    totalSavings: z.number().nonnegative().optional(),
  })
  .openapi('MemberSavingsInput')

export const MemberPortalAccessInputSchema = z
  .object({
    hasPortalAccess: z.boolean().openapi({ example: true }),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
  })
  .openapi('MemberPortalAccessInput')

// ---------------------------------------------------------------------------
// Loan Schemas
// ---------------------------------------------------------------------------

export const LoanItemSchema = z
  .object({
    id: z.string().openapi({ example: 'loan-uuid-1234' }),
    memberId: z.string().openapi({ example: 'member-uuid-5678' }),
    name: z.string().openapi({ example: 'Pinjaman Renovasi Rumah' }),
    amount: z.number().openapi({ example: 10000000 }),
    tenor: z.number().openapi({ example: 12 }),
    purpose: z.string().openapi({ example: 'Renovasi' }),
    status: z.string().openapi({ example: 'Disetujui' }),
    interestRate: z.number().optional().openapi({ example: 18 }),
    monthlyPayment: z.number().optional().openapi({ example: 916800 }),
    totalAmount: z.number().optional().openapi({ example: 11001600 }),
    paidAmount: z.number().optional().openapi({ example: 1833600 }),
    createdAt: z.string().optional(),
    approvedAt: z.string().optional(),
  })
  .openapi('LoanItem')

export const LoanCreateInputSchema = z
  .object({
    memberId: z.string().min(1).openapi({ example: 'member-uuid-5678' }),
    name: z.string().min(1).openapi({ example: 'Pinjaman Modal Usaha' }),
    amount: z.number().positive().openapi({ example: 5000000 }),
    tenor: z.number().int().positive().openapi({ example: 6 }),
    purpose: z.string().min(1).openapi({ example: 'Modal Usaha' }),
    interestRate: z.number().nonnegative().optional(),
    loanDate: z.string().optional(),
  })
  .openapi('LoanCreateInput')

export const LoanStatusInputSchema = z
  .object({
    status: z.enum(['Disetujui', 'Ditolak', 'Lunas', 'Macet', 'Menunggu']).openapi({ example: 'Disetujui' }),
    approvedDate: z.string().optional().openapi({ example: '2026-02-01' }),
    firstInstallmentDate: z.string().optional().openapi({ example: '2026-02-28' }),
    paymentSourceAccountId: z.string().optional(),
    rejectionReason: z.string().optional(),
  })
  .openapi('LoanStatusInput')

export const LoanPaymentInputSchema = z
  .object({
    amount: z.number().positive().openapi({ example: 916800 }),
    paymentDate: z.string().optional().openapi({ example: '2026-03-01' }),
    notes: z.string().optional(),
    paymentMethod: z.string().optional().default('Transfer'),
    paymentSourceAccountId: z.string().optional(),
  })
  .openapi('LoanPaymentInput')

export const LoanScheduleItemSchema = z
  .object({
    id: z.string(),
    loanId: z.string(),
    installmentNo: z.number(),
    dueDate: z.string(),
    principalAmount: z.number(),
    interestAmount: z.number(),
    paidAmount: z.number(),
    status: z.string(),
  })
  .openapi('LoanScheduleItem')

// ---------------------------------------------------------------------------
// Savings & Transactions Schemas
// ---------------------------------------------------------------------------

export const TransactionItemSchema = z
  .object({
    id: z.string(),
    memberId: z.string(),
    type: z.string().openapi({ example: 'setor_sukarela' }),
    amount: z.number().openapi({ example: 100000 }),
    balanceBefore: z.number().openapi({ example: 500000 }),
    balanceAfter: z.number().openapi({ example: 600000 }),
    createdAt: z.string(),
    memberName: z.string().optional(),
  })
  .openapi('TransactionItem')

// ---------------------------------------------------------------------------
// SHU Schemas
// ---------------------------------------------------------------------------

export const ShuConfigSchema = z
  .object({
    jasaModalPct: z.number().min(0).max(100).openapi({ example: 30 }),
    jasaAnggotaPct: z.number().min(0).max(100).openapi({ example: 70 }),
    danaCadanganPct: z.number().min(0).max(100).optional(),
    danaPengurusPct: z.number().min(0).max(100).optional(),
    danaKaryawanPct: z.number().min(0).max(100).optional(),
    danaPendidikanPct: z.number().min(0).max(100).optional(),
    danaSosialPct: z.number().min(0).max(100).optional(),
  })
  .openapi('ShuConfig')

export const ShuCloseInputSchema = z
  .object({
    year: z.string().openapi({ example: '2026' }),
    biayaOperasional: z.number().optional().openapi({ example: 5000000 }),
  })
  .openapi('ShuCloseInput')

// ---------------------------------------------------------------------------
// Reports & Stats Schemas
// ---------------------------------------------------------------------------

export const ReportsSummarySchema = z
  .object({
    members: z.object({
      totalMembers: z.number(),
      activeMembers: z.number(),
      passiveMembers: z.number(),
      totalPokok: z.number(),
      totalWajib: z.number(),
      totalSukarela: z.number(),
      totalSavings: z.number(),
    }),
    loans: z.object({
      totalLoansCount: z.number(),
      totalLoansAmount: z.number(),
      activeLoansAmount: z.number(),
      badLoansAmount: z.number(),
      paidLoansAmount: z.number(),
      totalPaymentsReceived: z.number(),
    }),
    timestamp: z.string(),
  })
  .openapi('ReportsSummary')

export const MonthlyInterestItemSchema = z
  .object({
    monthKey: z.string().openapi({ example: '2026-01' }),
    monthName: z.string().openapi({ example: 'Januari' }),
    interestIncome: z.number().openapi({ example: 1250000 }),
  })
  .openapi('MonthlyInterestItem')

// ---------------------------------------------------------------------------
// Feedback Schemas
// ---------------------------------------------------------------------------

export const FeedbackInputSchema = z
  .object({
    type: z.enum(['bug', 'feature', 'general']).openapi({ example: 'feature' }),
    title: z.string().min(1).openapi({ example: 'Saran Tambah Metode Pembayaran' }),
    description: z.string().optional(),
    rating: z.number().int().min(1).max(5).optional(),
    screenshotUrl: z.string().optional(),
  })
  .openapi('FeedbackInput')
