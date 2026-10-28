import { createRoute, z } from '@hono/zod-openapi'
import * as schemas from './schemas'

// ---------------------------------------------------------------------------
// 1. Auth Routes
// ---------------------------------------------------------------------------

export const loginRoute = createRoute({
  method: 'post',
  path: '/auth/login',
  tags: ['auth'],
  summary: 'Login admin/pengurus dengan email dan password',
  request: {
    body: {
      content: { 'application/json': { schema: schemas.LoginInputSchema } },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.AuthResponseEnvelope } }, description: 'Login berhasil' },
    401: { content: { 'application/json': { schema: schemas.ApiErrorEnvelope } }, description: 'Email atau password salah' },
  },
})

export const googleAuthRoute = createRoute({
  method: 'post',
  path: '/auth/google',
  tags: ['auth'],
  summary: 'Login pengurus menggunakan Google SSO',
  request: {
    body: {
      content: { 'application/json': { schema: schemas.GoogleAuthInputSchema } },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.AuthResponseEnvelope } }, description: 'Login SSO berhasil' },
    400: { content: { 'application/json': { schema: schemas.ApiErrorEnvelope } }, description: 'Token Google tidak valid' },
  },
})

export const verifyAuthRoute = createRoute({
  method: 'get',
  path: '/auth/verify',
  tags: ['auth'],
  summary: 'Verifikasi status token JWT yang sedang aktif',
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Sesi aktif valid' },
    401: { content: { 'application/json': { schema: schemas.ApiErrorEnvelope } }, description: 'Sesi tidak valid / kedaluwarsa' },
  },
})

export const refreshAuthRoute = createRoute({
  method: 'post',
  path: '/auth/refresh',
  tags: ['auth'],
  summary: 'Refresh access token JWT admin',
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Token berhasil diperbarui' },
    401: { content: { 'application/json': { schema: schemas.ApiErrorEnvelope } }, description: 'Refresh token tidak valid' },
  },
})

export const logoutAuthRoute = createRoute({
  method: 'post',
  path: '/auth/logout',
  tags: ['auth'],
  summary: 'Logout dan blacklist token admin',
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Logout berhasil' },
  },
})

export const memberLoginRoute = createRoute({
  method: 'post',
  path: '/member-auth/login',
  tags: ['member-auth'],
  summary: 'Login anggota koperasi',
  request: {
    body: {
      content: { 'application/json': { schema: schemas.MemberLoginInputSchema } },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.AuthResponseEnvelope } }, description: 'Login anggota berhasil' },
    401: { content: { 'application/json': { schema: schemas.ApiErrorEnvelope } }, description: 'Kredensial tidak valid' },
  },
})

export const memberGoogleAuthRoute = createRoute({
  method: 'post',
  path: '/member-auth/google',
  tags: ['member-auth'],
  summary: 'Login anggota menggunakan Google SSO',
  request: {
    body: {
      content: { 'application/json': { schema: schemas.GoogleAuthInputSchema } },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.AuthResponseEnvelope } }, description: 'Login SSO berhasil' },
  },
})

export const memberRefreshRoute = createRoute({
  method: 'post',
  path: '/member-auth/refresh',
  tags: ['member-auth'],
  summary: 'Refresh access token anggota',
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Token berhasil di-refresh' },
  },
})

export const memberLogoutRoute = createRoute({
  method: 'post',
  path: '/member-auth/logout',
  tags: ['member-auth'],
  summary: 'Logout anggota koperasi',
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Logout berhasil' },
  },
})

// ---------------------------------------------------------------------------
// 2. Member Routes
// ---------------------------------------------------------------------------

export const membersListRoute = createRoute({
  method: 'get',
  path: '/members',
  tags: ['members'],
  summary: 'Mendapatkan daftar anggota terdaftar dengan filter pencarian dan paginasi',
  request: {
    query: z.object({
      search: z.string().optional().openapi({ example: 'Budi' }),
      status: z.string().optional().openapi({ example: 'Aktif' }),
      role: z.string().optional().openapi({ example: 'Anggota' }),
      page: z.string().optional().openapi({ example: '1' }),
      limit: z.string().optional().openapi({ example: '20' }),
    }),
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.PaginatedListSchema } }, description: 'Daftar anggota' },
  },
})

export const memberCreateRoute = createRoute({
  method: 'post',
  path: '/members',
  tags: ['members'],
  summary: 'Menambahkan anggota baru ke dalam koperasi',
  request: {
    body: {
      content: { 'application/json': { schema: schemas.MemberCreateInputSchema } },
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Anggota berhasil dibuat' },
    400: { content: { 'application/json': { schema: schemas.ApiErrorEnvelope } }, description: 'Validasi input gagal' },
  },
})

export const memberUpdateRoute = createRoute({
  method: 'put',
  path: '/members/{id}',
  tags: ['members'],
  summary: 'Memperbarui profil anggota yang sudah ada',
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
    body: {
      content: { 'application/json': { schema: schemas.MemberUpdateInputSchema } },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Data anggota berhasil diperbarui' },
    404: { content: { 'application/json': { schema: schemas.ApiErrorEnvelope } }, description: 'Anggota tidak ditemukan' },
  },
})

export const memberDeleteRoute = createRoute({
  method: 'delete',
  path: '/members/{id}',
  tags: ['members'],
  summary: 'Menghapus anggota (soft-delete)',
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Anggota berhasil dihapus' },
    404: { content: { 'application/json': { schema: schemas.ApiErrorEnvelope } }, description: 'Anggota tidak ditemukan' },
  },
})

export const memberSavingsRoute = createRoute({
  method: 'put',
  path: '/members/{id}/savings',
  tags: ['members'],
  summary: 'Memperbarui saldo simpanan anggota secara langsung',
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
    body: {
      content: { 'application/json': { schema: schemas.MemberSavingsInputSchema } },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Saldo simpanan berhasil diperbarui' },
  },
})

export const memberPortalAccessRoute = createRoute({
  method: 'put',
  path: '/members/{id}/portal-access',
  tags: ['members'],
  summary: 'Mengaktifkan atau menonaktifkan akses portal mandiri anggota',
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
    body: {
      content: { 'application/json': { schema: schemas.MemberPortalAccessInputSchema } },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Akses portal berhasil diperbarui' },
  },
})

export const memberImpersonateRoute = createRoute({
  method: 'post',
  path: '/members/{id}/impersonate',
  tags: ['members'],
  summary: 'Impersonasi akun anggota oleh admin',
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Token impersonasi berhasil diterbitkan' },
  },
})

export const memberTransactionsRoute = createRoute({
  method: 'get',
  path: '/members/{id}/transactions',
  tags: ['members'],
  summary: 'Riwayat transaksi simpanan anggota tertentu',
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Daftar riwayat transaksi' },
  },
})

// ---------------------------------------------------------------------------
// 3. Loan Routes
// ---------------------------------------------------------------------------

export const loansListRoute = createRoute({
  method: 'get',
  path: '/loans',
  tags: ['loans'],
  summary: 'Mendapatkan daftar pinjaman anggota',
  request: {
    query: z.object({
      status: z.string().optional(),
      memberId: z.string().optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.PaginatedListSchema } }, description: 'Daftar pinjaman' },
  },
})

export const loanCreateRoute = createRoute({
  method: 'post',
  path: '/loans',
  tags: ['loans'],
  summary: 'Mengajukan pinjaman baru untuk anggota',
  request: {
    body: {
      content: { 'application/json': { schema: schemas.LoanCreateInputSchema } },
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Pinjaman berhasil diajukan' },
  },
})

export const loanStatusRoute = createRoute({
  method: 'put',
  path: '/loans/{id}/status',
  tags: ['loans'],
  summary: 'Mengubah status persetujuan pinjaman (Disetujui/Ditolak/Lunas/Macet)',
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
    body: {
      content: { 'application/json': { schema: schemas.LoanStatusInputSchema } },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Status pinjaman berhasil diperbarui' },
  },
})

export const loanDisbursementDateRoute = createRoute({
  method: 'put',
  path: '/loans/{id}/disbursement-date',
  tags: ['loans'],
  summary: 'Mengubah tanggal pencairan pinjaman',
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
    body: {
      content: { 'application/json': { schema: z.object({ disbursementDate: z.string() }) } },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Tanggal pencairan berhasil diperbarui' },
  },
})

export const loanDeleteRoute = createRoute({
  method: 'delete',
  path: '/loans/{id}',
  tags: ['loans'],
  summary: 'Menghapus data pinjaman (soft-delete)',
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Pinjaman berhasil dihapus' },
  },
})

export const loanPaymentsRoute = createRoute({
  method: 'get',
  path: '/loans/payments',
  tags: ['loans'],
  summary: 'Daftar seluruh pembayaran angsuran pinjaman (buku besar kas masuk)',
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.PaginatedListSchema } }, description: 'Daftar pembayaran' },
  },
})

export const loanScheduleRoute = createRoute({
  method: 'get',
  path: '/loans/{id}/schedule',
  tags: ['loans'],
  summary: 'Mendapatkan jadwal cicilan/angsuran pinjaman tertentu',
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Daftar jadwal cicilan' },
  },
})

export const loanScheduleRegenerateRoute = createRoute({
  method: 'post',
  path: '/loans/{id}/schedule/regenerate',
  tags: ['loans'],
  summary: 'Menghitung ulang jadwal cicilan anuitas pinjaman',
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
    body: {
      content: { 'application/json': { schema: z.object({ interestRate: z.number().optional() }) } },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Jadwal cicilan berhasil diperbarui' },
  },
})

export const loanScheduleUpdateRoute = createRoute({
  method: 'put',
  path: '/loans/{id}/schedule',
  tags: ['loans'],
  summary: 'Mengedit tabel jadwal cicilan pinjaman secara manual',
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
    body: {
      content: { 'application/json': { schema: z.object({ rows: z.array(z.any()) }) } },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Jadwal berhasil diperbarui' },
  },
})

export const loanPaymentsListRoute = createRoute({
  method: 'get',
  path: '/loans/{id}/payments',
  tags: ['loans'],
  summary: 'Mendapatkan riwayat pembayaran angsuran untuk pinjaman tertentu',
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Daftar pembayaran angsuran' },
  },
})

export const loanPaymentCreateRoute = createRoute({
  method: 'post',
  path: '/loans/{id}/payments',
  tags: ['loans'],
  summary: 'Mencatat pembayaran angsuran pinjaman',
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
    body: {
      content: { 'application/json': { schema: schemas.LoanPaymentInputSchema } },
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Pembayaran berhasil dicatat' },
  },
})

export const loanPaymentUpdateRoute = createRoute({
  method: 'put',
  path: '/loans/{id}/payments/{paymentId}',
  tags: ['loans'],
  summary: 'Memperbarui data pembayaran angsuran pinjaman',
  request: {
    params: z.object({
      id: z.string().openapi({ param: { name: 'id', in: 'path' } }),
      paymentId: z.string().openapi({ param: { name: 'paymentId', in: 'path' } }),
    }),
    body: {
      content: { 'application/json': { schema: schemas.LoanPaymentInputSchema } },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Pembayaran berhasil diperbarui' },
  },
})

export const loanPaymentDeleteRoute = createRoute({
  method: 'delete',
  path: '/loans/{id}/payments/{paymentId}',
  tags: ['loans'],
  summary: 'Menghapus catatan pembayaran angsuran pinjaman',
  request: {
    params: z.object({
      id: z.string().openapi({ param: { name: 'id', in: 'path' } }),
      paymentId: z.string().openapi({ param: { name: 'paymentId', in: 'path' } }),
    }),
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Pembayaran berhasil dibatalkan/dihapus' },
  },
})

// ---------------------------------------------------------------------------
// 4. Savings Routes
// ---------------------------------------------------------------------------

export const savingsTransactionsRoute = createRoute({
  method: 'get',
  path: '/savings/transactions',
  tags: ['savings'],
  summary: 'Mendapatkan daftar mutasi transaksi simpanan anggota',
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.PaginatedListSchema } }, description: 'Daftar transaksi simpanan' },
  },
})

export const savingsTemplateCsvRoute = createRoute({
  method: 'get',
  path: '/savings/template-csv',
  tags: ['savings'],
  summary: 'Mengunduh format template CSV untuk impor massal simpanan',
  responses: {
    200: { content: { 'text/csv': { schema: z.string() } }, description: 'File template CSV' },
  },
})

export const savingsBatchImportRoute = createRoute({
  method: 'post',
  path: '/savings/batch-import',
  tags: ['savings'],
  summary: 'Melakukan impor massal transaksi simpanan anggota',
  request: {
    body: {
      content: { 'application/json': { schema: z.object({ items: z.array(z.any()) }) } },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Hasil impor massal' },
  },
})

// ---------------------------------------------------------------------------
// 5. SHU Routes
// ---------------------------------------------------------------------------

export const shuRoute = createRoute({
  method: 'get',
  path: '/shu',
  tags: ['shu'],
  summary: 'Mendapatkan perhitungan alokasi SHU anggota tahun berjalan atau realisasi',
  request: {
    query: z.object({
      year: z.string().optional(),
      mode: z.enum(['realization', 'projection']).optional(),
    }),
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Data SHU' },
  },
})

export const shuConfigRoute = createRoute({
  method: 'get',
  path: '/shu/config',
  tags: ['shu'],
  summary: 'Mendapatkan konfigurasi persentase alokasi pembagian SHU',
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Konfigurasi SHU' },
  },
})

export const shuCloseRoute = createRoute({
  method: 'post',
  path: '/shu/close',
  tags: ['shu'],
  summary: 'Melakukan tutup buku tahun fiskal SHU',
  request: {
    body: {
      content: { 'application/json': { schema: schemas.ShuCloseInputSchema } },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Tutup buku berhasil' },
  },
})

export const shuReopenRoute = createRoute({
  method: 'post',
  path: '/shu/reopen',
  tags: ['shu'],
  summary: 'Membuka kembali tahun fiskal SHU yang sudah ditutup',
  request: {
    body: {
      content: { 'application/json': { schema: z.object({ year: z.string() }) } },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Tahun buku berhasil dibuka kembali' },
  },
})

// ---------------------------------------------------------------------------
// 6. NPL Route
// ---------------------------------------------------------------------------

export const nplRoute = createRoute({
  method: 'get',
  path: '/npl',
  tags: ['npl'],
  summary: 'Mendapatkan laporan rasio NPL dan daftar pinjaman macet/bermasalah',
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Laporan NPL' },
  },
})

// ---------------------------------------------------------------------------
// 7. Cashflow Route
// ---------------------------------------------------------------------------

export const cashflowRoute = createRoute({
  method: 'get',
  path: '/cashflow',
  tags: ['cashflow'],
  summary: 'Mendapatkan riwayat dan ringkasan arus kas (cashflow ledger)',
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Laporan arus kas' },
  },
})

// ---------------------------------------------------------------------------
// 8. Reports Routes
// ---------------------------------------------------------------------------

export const reportsSummaryRoute = createRoute({
  method: 'get',
  path: '/reports/summary',
  tags: ['reports'],
  summary: 'Ringkasan komprehensif statistik anggota, pinjaman, dan simpanan',
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Ringkasan laporan' },
  },
})

export const reportsMonthlyInterestRoute = createRoute({
  method: 'get',
  path: '/reports/monthly-interest',
  tags: ['reports'],
  summary: 'Mendapatkan laporan pendapatan bunga pinjaman per bulan',
  request: {
    query: z.object({
      year: z.string().optional(),
    }),
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Pendapatan bunga bulanan' },
  },
})

// ---------------------------------------------------------------------------
// 9. Feedback Routes
// ---------------------------------------------------------------------------

export const feedbackCreateRoute = createRoute({
  method: 'post',
  path: '/feedbacks',
  tags: ['feedbacks'],
  summary: 'Mengirimkan feedback atau laporan bug dari pengguna',
  request: {
    body: {
      content: { 'application/json': { schema: schemas.FeedbackInputSchema } },
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Feedback berhasil dikirim' },
  },
})

export const feedbacksListRoute = createRoute({
  method: 'get',
  path: '/feedbacks',
  tags: ['feedbacks'],
  summary: 'Mendapatkan daftar seluruh masukan dan laporan bug pengguna',
  request: {
    query: z.object({
      type: z.string().optional(),
      status: z.string().optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Daftar masukan pengguna' },
  },
})

export const feedbacksStatsRoute = createRoute({
  method: 'get',
  path: '/feedbacks/stats',
  tags: ['feedbacks'],
  summary: 'Statistik agregasi masukan (total, open, bug, feature)',
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Statistik masukan' },
  },
})

export const feedbackStatusRoute = createRoute({
  method: 'put',
  path: '/feedbacks/{id}/status',
  tags: ['feedbacks'],
  summary: 'Memperbarui status penanganan masukan pengguna',
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
    body: {
      content: { 'application/json': { schema: z.object({ status: z.string(), adminNotes: z.string().optional() }) } },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Status masukan diperbarui' },
  },
})

export const feedbackDeleteRoute = createRoute({
  method: 'delete',
  path: '/feedbacks/{id}',
  tags: ['feedbacks'],
  summary: 'Menghapus catatan masukan pengguna',
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Masukan berhasil dihapus' },
  },
})

// ---------------------------------------------------------------------------
// 10. Stats Routes
// ---------------------------------------------------------------------------

export const statsRoute = createRoute({
  method: 'get',
  path: '/stats',
  tags: ['stats'],
  summary: 'Mendapatkan statistik dashboard utama',
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Statistik dashboard' },
  },
})

export const statsPendingActionsRoute = createRoute({
  method: 'get',
  path: '/stats/pending-actions',
  tags: ['stats'],
  summary: 'Mendapatkan daftar tindakan pending yang membutuhkan tindakan admin',
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Daftar pending actions' },
  },
})

// ---------------------------------------------------------------------------
// 11. Settings Routes
// ---------------------------------------------------------------------------

export const settingsGetRoute = createRoute({
  method: 'get',
  path: '/settings',
  tags: ['settings'],
  summary: 'Mendapatkan seluruh konfigurasi koperasi',
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Konfigurasi koperasi' },
  },
})

export const settingsUpdateRoute = createRoute({
  method: 'put',
  path: '/settings',
  tags: ['settings'],
  summary: 'Memperbarui konfigurasi koperasi',
  request: {
    body: {
      content: { 'application/json': { schema: z.record(z.string(), z.any()) } },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Pengaturan berhasil disimpan' },
  },
})

export const settingsBrandingRoute = createRoute({
  method: 'get',
  path: '/settings/branding',
  tags: ['settings'],
  summary: 'Mendapatkan branding publik koperasi (nama, logo, dsb)',
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Branding publik' },
  },
})

// ---------------------------------------------------------------------------
// 12. Admins Routes
// ---------------------------------------------------------------------------

export const adminsListRoute = createRoute({
  method: 'get',
  path: '/admins',
  tags: ['admins'],
  summary: 'Mendapatkan daftar akun pengurus/admin koperasi',
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiDataEnvelope } }, description: 'Daftar pengurus' },
  },
})

export const adminCreateRoute = createRoute({
  method: 'post',
  path: '/admins',
  tags: ['admins'],
  summary: 'Membuat akun pengurus baru',
  request: {
    body: {
      content: { 'application/json': { schema: z.object({ email: z.string().email(), password: z.string().min(6).optional(), role: z.string(), name: z.string().optional() }) } },
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Pengurus berhasil ditambahkan' },
  },
})

export const adminUpdateRoute = createRoute({
  method: 'put',
  path: '/admins/{id}',
  tags: ['admins'],
  summary: 'Memperbarui peran akun pengurus',
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
    body: {
      content: { 'application/json': { schema: z.object({ role: z.string() }) } },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Peran berhasil diperbarui' },
  },
})

export const adminDeleteRoute = createRoute({
  method: 'delete',
  path: '/admins/{id}',
  tags: ['admins'],
  summary: 'Menghapus akun pengurus',
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
  },
  responses: {
    200: { content: { 'application/json': { schema: schemas.ApiMessageEnvelope } }, description: 'Akun pengurus berhasil dihapus' },
  },
})

