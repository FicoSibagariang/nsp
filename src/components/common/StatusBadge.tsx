import { Badge, type BadgeVariant } from '@astryxdesign/core/Badge';

export type StatusType =
  // Member status
  | 'Aktif'
  | 'Pasif'
  | 'Non-aktif'
  // Loan status
  | 'Menunggu'
  | 'Disetujui'
  | 'Ditolak'
  | 'Lunas'
  | 'Macet'
  // NPL
  | 'Lancar (Kol 1)'
  | 'DPK (Kol 2)'
  | 'Kurang Lancar (Kol 3)'
  | 'Diragukan (Kol 4)'
  | 'Macet (Kol 5)'
  // Savings transaction types
  | 'setor_pokok'
  | 'setor_wajib'
  | 'setor_sukarela'
  | 'tarik_sukarela'
  | 'Setor Pokok'
  | 'Setor Wajib'
  | 'Setor Sukarela'
  | 'Tarik Sukarela'
  | 'Pokok'
  | 'Wajib'
  | 'Sukarela'
  // EWA status
  | 'PENDING'
  | 'APPROVED'
  | 'DISBURSED'
  | 'REJECTED'
  | 'PAID_SETTLED'
  | 'CANCELLED'
  | 'Menunggu Cair'
  | 'Sudah Cair'
  | 'Lunas Payroll'
  // Letters & Feedbacks
  | 'Draft'
  | 'Terkirim'
  | 'DRAFT'
  | 'SENT'
  | 'Open'
  | 'In Progress'
  | 'Resolved'
  | 'Closed'
  | 'Baru (Open)'
  | 'Ditinjau'
  | 'Selesai'
  | 'Ditutup'
  | 'Bug'
  | 'Usulan Fitur'
  | 'Masukan'
  // Cashflow & Roles
  | 'Masuk'
  | 'Keluar'
  | 'Debit'
  | 'Kredit'
  // Generic
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'neutral'
  | (string & {});

export interface StatusBadgeProps {
  status?: StatusType | string | null;
  /** Override default label (useful for custom display text) */
  label?: string;
  style?: React.CSSProperties;
  className?: string;
}

const statusConfig: Record<string, { variant: BadgeVariant; label?: string }> = {
  // Member status
  Aktif: { variant: 'success', label: 'Aktif' },
  Pasif: { variant: 'neutral', label: 'Pasif' },
  'Non-aktif': { variant: 'neutral', label: 'Non-aktif' },

  // Loan status
  Menunggu: { variant: 'warning', label: 'Menunggu' },
  Disetujui: { variant: 'info', label: 'Disetujui' },
  Diverifikasi: { variant: 'success', label: 'Diverifikasi' },
  Ditolak: { variant: 'error', label: 'Ditolak' },
  Lunas: { variant: 'success', label: 'Lunas' },
  Macet: { variant: 'error', label: 'Macet' },
  Paid: { variant: 'success', label: 'Lunas' },
  Late: { variant: 'error', label: 'Terlambat' },
  Belum: { variant: 'neutral', label: 'Belum' },
  pencairan: { variant: 'error', label: 'Pencairan' },
  angsuran: { variant: 'success', label: 'Angsuran' },
  Pencairan: { variant: 'error', label: 'Pencairan' },
  Angsuran: { variant: 'success', label: 'Angsuran' },
  Transfer: { variant: 'success', label: 'Transfer Bank' },
  Tunai: { variant: 'neutral', label: 'Tunai' },
  'Potong Gaji': { variant: 'info', label: 'Potong Gaji' },

  // NPL Kolektibilitas
  'Lancar (Kol 1)': { variant: 'success', label: 'Lancar (Kol 1)' },
  'DPK (Kol 2)': { variant: 'warning', label: 'DPK (Kol 2)' },
  'Kurang Lancar (Kol 3)': { variant: 'warning', label: 'Kurang Lancar (Kol 3)' },
  'Diragukan (Kol 4)': { variant: 'error', label: 'Diragukan (Kol 4)' },
  'Macet (Kol 5)': { variant: 'error', label: 'Macet (Kol 5)' },
  'Dalam Perhatian Khusus': { variant: 'warning', label: 'DPK (Kol 2)' },
  Diragukan: { variant: 'error', label: 'Diragukan (Kol 4)' },
  'Kurang Lancar': { variant: 'warning', label: 'Kurang Lancar (Kol 3)' },
  Lancar: { variant: 'success', label: 'Lancar (Kol 1)' },

  // Savings mutations & transactions
  setor_pokok: { variant: 'success', label: 'Setor Pokok' },
  setor_wajib: { variant: 'success', label: 'Setor Wajib' },
  setor_sukarela: { variant: 'success', label: 'Setor Sukarela' },
  tarik_sukarela: { variant: 'warning', label: 'Tarik Sukarela' },
  bunga: { variant: 'info', label: 'Jasa Simpanan' },
  'Jasa Simpanan': { variant: 'info', label: 'Jasa Simpanan' },
  'Setor Pokok': { variant: 'success', label: 'Setor Pokok' },
  'Setor Wajib': { variant: 'success', label: 'Setor Wajib' },
  'Setor Sukarela': { variant: 'success', label: 'Setor Sukarela' },
  'Tarik Sukarela': { variant: 'warning', label: 'Tarik Sukarela' },
  'Simpanan Pokok': { variant: 'info', label: 'Simpanan Pokok' },
  'Simpanan Wajib': { variant: 'success', label: 'Simpanan Wajib' },
  'Simpanan Sukarela': { variant: 'neutral', label: 'Simpanan Sukarela' },
  pokok: { variant: 'info', label: 'Simpanan Pokok' },
  wajib: { variant: 'success', label: 'Simpanan Wajib' },
  sukarela: { variant: 'neutral', label: 'Simpanan Sukarela' },
  Pokok: { variant: 'info', label: 'Pokok' },
  Wajib: { variant: 'success', label: 'Wajib' },
  Sukarela: { variant: 'neutral', label: 'Sukarela' },

  // EWA status
  PENDING: { variant: 'warning', label: 'Menunggu Cair' },
  APPROVED: { variant: 'info', label: 'Disetujui' },
  DISBURSED: { variant: 'info', label: 'Sudah Cair' },
  REJECTED: { variant: 'error', label: 'Ditolak' },
  PAID_SETTLED: { variant: 'success', label: 'Lunas Payroll' },
  CANCELLED: { variant: 'neutral', label: 'Dibatalkan' },
  'Menunggu Cair': { variant: 'warning', label: 'Menunggu Cair' },
  'Sudah Cair': { variant: 'info', label: 'Sudah Cair' },
  'Lunas Payroll': { variant: 'success', label: 'Lunas Payroll' },

  // Letters
  Draft: { variant: 'neutral', label: 'Draft' },
  Terkirim: { variant: 'success', label: 'Terkirim' },
  DRAFT: { variant: 'neutral', label: 'Draft' },
  SENT: { variant: 'success', label: 'Terkirim' },
  PINJAMAN_ANGGOTA: { variant: 'info', label: 'Pinjaman Anggota' },
  PINJAMAN_MODAL: { variant: 'warning', label: 'Pinjaman Modal' },

  // Feedback Categories & Statuses
  Bug: { variant: 'error', label: 'Bug' },
  bug: { variant: 'error', label: 'Bug' },
  'Usulan Fitur': { variant: 'info', label: 'Usulan Fitur' },
  feature: { variant: 'info', label: 'Usulan Fitur' },
  Masukan: { variant: 'success', label: 'Masukan' },
  'Baru (Open)': { variant: 'warning', label: 'Baru (Open)' },
  Open: { variant: 'warning', label: 'Open' },
  OPEN: { variant: 'warning', label: 'Open' },
  open: { variant: 'warning', label: 'Baru (Open)' },
  Ditinjau: { variant: 'info', label: 'Ditinjau' },
  'In Progress': { variant: 'info', label: 'In Progress' },
  IN_PROGRESS: { variant: 'info', label: 'In Progress' },
  in_review: { variant: 'info', label: 'Ditinjau' },
  Selesai: { variant: 'success', label: 'Selesai' },
  Resolved: { variant: 'success', label: 'Resolved' },
  RESOLVED: { variant: 'success', label: 'Resolved' },
  resolved: { variant: 'success', label: 'Selesai' },
  Ditutup: { variant: 'neutral', label: 'Ditutup' },
  Closed: { variant: 'neutral', label: 'Closed' },
  CLOSED: { variant: 'neutral', label: 'Closed' },
  closed: { variant: 'neutral', label: 'Ditutup' },

  // Cashflow & Roles
  Masuk: { variant: 'success', label: 'Masuk' },
  Keluar: { variant: 'warning', label: 'Keluar' },
  inflow: { variant: 'success', label: 'Masuk' },
  outflow: { variant: 'error', label: 'Keluar' },
  Debit: { variant: 'warning', label: 'Debit' },
  Kredit: { variant: 'success', label: 'Kredit' },
  superadmin: { variant: 'success', label: 'Superadmin' },
  admin: { variant: 'warning', label: 'Admin' },
  viewer: { variant: 'neutral', label: 'Viewer' },
  Superadmin: { variant: 'success', label: 'Superadmin' },
  Admin: { variant: 'warning', label: 'Admin' },
  Viewer: { variant: 'neutral', label: 'Viewer' },

  // Generic status
  success: { variant: 'success', label: 'Sukses' },
  error: { variant: 'error', label: 'Gagal' },
  warning: { variant: 'warning', label: 'Peringatan' },
  info: { variant: 'info', label: 'Info' },
  neutral: { variant: 'neutral', label: 'Netral' },
};

/**
 * Consistent status badge for members, loans, savings, EWA, and other cooperative entities.
 * Automatically maps status to appropriate semantic color and localized label.
 */
export function StatusBadge({ status, label, style, className }: StatusBadgeProps) {
  const safeStatus = status || '-';
  const config = statusConfig[safeStatus] ?? { variant: 'neutral', label: safeStatus };
  const displayLabel = label ?? config.label ?? safeStatus;

  return <Badge variant={config.variant} label={displayLabel} style={style} className={className} />;
}
