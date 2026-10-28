import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import * as routes from './routes'
import * as schemas from './schemas'

const dummyHandler = (c: any) => c.json({ success: true })

/**
 * Typed OpenAPI Contract Application.
 * Chains all typed route contracts to enable complete end-to-end
 * type inference for Hono RPC Client (`hc<AppContractType>`).
 */
export const contractApp = new OpenAPIHono()
  .openapi(routes.adminCreateRoute, dummyHandler)
  .openapi(routes.adminDeleteRoute, dummyHandler)
  .openapi(routes.adminUpdateRoute, dummyHandler)
  .openapi(routes.adminsListRoute, dummyHandler)
  .openapi(routes.cashflowRoute, dummyHandler)
  .openapi(routes.feedbackCreateRoute, dummyHandler)
  .openapi(routes.feedbackDeleteRoute, dummyHandler)
  .openapi(routes.feedbackStatusRoute, dummyHandler)
  .openapi(routes.feedbacksListRoute, dummyHandler)
  .openapi(routes.feedbacksStatsRoute, dummyHandler)
  .openapi(routes.googleAuthRoute, dummyHandler)
  .openapi(routes.loanCreateRoute, dummyHandler)
  .openapi(routes.loanDeleteRoute, dummyHandler)
  .openapi(routes.loanDisbursementDateRoute, dummyHandler)
  .openapi(routes.loanPaymentCreateRoute, dummyHandler)
  .openapi(routes.loanPaymentDeleteRoute, dummyHandler)
  .openapi(routes.loanPaymentUpdateRoute, dummyHandler)
  .openapi(routes.loanPaymentsListRoute, dummyHandler)
  .openapi(routes.loanPaymentsRoute, dummyHandler)
  .openapi(routes.loanScheduleRegenerateRoute, dummyHandler)
  .openapi(routes.loanScheduleRoute, dummyHandler)
  .openapi(routes.loanScheduleUpdateRoute, dummyHandler)
  .openapi(routes.loanStatusRoute, dummyHandler)
  .openapi(routes.loansListRoute, dummyHandler)
  .openapi(routes.loginRoute, dummyHandler)
  .openapi(routes.logoutAuthRoute, dummyHandler)
  .openapi(routes.memberCreateRoute, dummyHandler)
  .openapi(routes.memberDeleteRoute, dummyHandler)
  .openapi(routes.memberGoogleAuthRoute, dummyHandler)
  .openapi(routes.memberImpersonateRoute, dummyHandler)
  .openapi(routes.memberLoginRoute, dummyHandler)
  .openapi(routes.memberLogoutRoute, dummyHandler)
  .openapi(routes.memberPortalAccessRoute, dummyHandler)
  .openapi(routes.memberRefreshRoute, dummyHandler)
  .openapi(routes.memberSavingsRoute, dummyHandler)
  .openapi(routes.memberTransactionsRoute, dummyHandler)
  .openapi(routes.memberUpdateRoute, dummyHandler)
  .openapi(routes.membersListRoute, dummyHandler)
  .openapi(routes.nplRoute, dummyHandler)
  .openapi(routes.refreshAuthRoute, dummyHandler)
  .openapi(routes.reportsMonthlyInterestRoute, dummyHandler)
  .openapi(routes.reportsSummaryRoute, dummyHandler)
  .openapi(routes.savingsBatchImportRoute, dummyHandler)
  .openapi(routes.savingsTemplateCsvRoute, dummyHandler)
  .openapi(routes.savingsTransactionsRoute, dummyHandler)
  .openapi(routes.settingsBrandingRoute, dummyHandler)
  .openapi(routes.settingsGetRoute, dummyHandler)
  .openapi(routes.settingsUpdateRoute, dummyHandler)
  .openapi(routes.shuCloseRoute, dummyHandler)
  .openapi(routes.shuConfigRoute, dummyHandler)
  .openapi(routes.shuReopenRoute, dummyHandler)
  .openapi(routes.shuRoute, dummyHandler)
  .openapi(routes.statsPendingActionsRoute, dummyHandler)
  .openapi(routes.statsRoute, dummyHandler)
  .openapi(routes.verifyAuthRoute, dummyHandler)

export type AppContractType = typeof contractApp

let cachedDoc: any = null

/**
 * Builds and returns the complete, auto-generated OpenAPI 3.0 specification.
 */
export function getOpenApiDocument(): any {
  if (cachedDoc) return cachedDoc

  // Register all shared envelope & entity schemas in components.schemas
  const registry = contractApp.openAPIRegistry
  registry.register('ApiSuccessEnvelope', schemas.ApiSuccessEnvelope)
  registry.register('ApiDataEnvelope', schemas.ApiDataEnvelope)
  registry.register('ApiMessageEnvelope', schemas.ApiMessageEnvelope)
  registry.register('ApiErrorEnvelope', schemas.ApiErrorEnvelope)
  registry.register('PaginatedList', schemas.PaginatedListSchema)
  registry.register('MemberItem', schemas.MemberItemSchema)
  registry.register('MemberCreateInput', schemas.MemberCreateInputSchema)
  registry.register('LoanItem', schemas.LoanItemSchema)
  registry.register('LoanCreateInput', schemas.LoanCreateInputSchema)
  registry.register('TransactionItem', schemas.TransactionItemSchema)
  registry.register('ShuConfig', schemas.ShuConfigSchema)
  registry.register('ReportsSummary', schemas.ReportsSummarySchema)

  cachedDoc = contractApp.getOpenAPIDocument({
    openapi: '3.0.3',
    info: {
      title: 'Koperasi API',
      version: '1.0.0',
      description: 'Dokumentasi otomatis API Koperasi Simpan Pinjam berbasis @hono/zod-openapi',
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Local development server',
      },
    ],
    tags: [
      { name: 'auth', description: 'Autentikasi Pengurus & Admin' },
      { name: 'member-auth', description: 'Autentikasi Anggota Koperasi' },
      { name: 'members', description: 'Manajemen Data Anggota' },
      { name: 'loans', description: 'Manajemen Pinjaman & Cicilan' },
      { name: 'savings', description: 'Manajemen Simpanan & Transaksi' },
      { name: 'shu', description: 'Perhitungan & Tutup Buku SHU' },
      { name: 'npl', description: 'Kolektibilitas & Kredit Macet (NPL)' },
      { name: 'cashflow', description: 'Arus Kas & Pembukuan Kas Masuk/Keluar' },
      { name: 'reports', description: 'Laporan Keuangan & Statistik' },
      { name: 'stats', description: 'Statistik Dashboard & Ringkasan Pending' },
      { name: 'settings', description: 'Pengaturan Koperasi' },
      { name: 'admins', description: 'Manajemen Pengurus & Superadmin' },
      { name: 'feedbacks', description: 'Laporan Bug & Masukan Pengguna' },
      { name: 'letters', description: 'Manajemen Surat Resmi Koperasi' },
    ],
  })

  return cachedDoc
}

/**
 * Mount OpenAPI endpoints (/openapi.json, /openapi.yaml, /doc, /swagger)
 * directly onto a Hono or OpenAPIHono application instance.
 */
export function registerOpenApiDocumentation(app: any): void {
  app.get('/openapi.json', (c: any) => {
    const doc = getOpenApiDocument()
    return c.json(doc)
  })

  app.get('/openapi.yaml', (c: any) => {
    const doc = getOpenApiDocument()
    return c.text(Bun.YAML.stringify(doc), 200, {
      'Content-Type': 'application/yaml; charset=utf-8',
    })
  })

  app.get('/doc', swaggerUI({ url: '/openapi.json' }))
  app.get('/swagger', swaggerUI({ url: '/openapi.json' }))
}

export * from './schemas'
export * from './routes'
export { createRoute, OpenAPIHono, z, swaggerUI }
