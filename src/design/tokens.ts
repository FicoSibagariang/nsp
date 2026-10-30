/**
 * Design tokens untuk Sistem Informasi Koperasi
 * Menggunakan Astryx Design System semantic tokens sebagai base
 */

export const semanticColors = {
  // Status colors
  success: 'var(--color-success-500)',
  error: 'var(--color-critical-500)',
  warning: 'var(--color-warning-500)',
  info: 'var(--color-primary-500)',

  // Text colors
  textPrimary: 'var(--color-text-primary)',
  textSecondary: 'var(--color-text-secondary)',
  textCritical: 'var(--color-text-critical)',
  textError: 'var(--color-text-error)',
  textSuccess: 'var(--color-text-success)',
  textWarning: 'var(--color-text-warning)',

  // Background colors
  bgPrimary: 'var(--color-background-primary)',
  bgSecondary: 'var(--color-background-secondary)',
  bgSubtle: 'var(--color-background-subtle)',

  // Border colors
  borderPrimary: 'var(--color-border-primary)',
  border: 'var(--color-border)',

  // Data visualization (for charts)
  dataBlue: 'var(--color-data-categorical-blue)',
  dataOrange: 'var(--color-data-categorical-orange)',
  dataGreen: 'var(--color-data-categorical-green)',
  dataPurple: 'var(--color-data-categorical-purple)',
  dataPink: 'var(--color-data-categorical-pink)',
} as const;

export const spacing = {
  xs: 'var(--spacing-2)',
  sm: 'var(--spacing-3)',
  md: 'var(--spacing-4)',
  lg: 'var(--spacing-6)',
  xl: 'var(--spacing-8)',
} as const;

export const radius = {
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
} as const;

// Helper functions
export function getStatusColor(status: 'success' | 'error' | 'warning' | 'info'): string {
  return semanticColors[status];
}

export function getCashflowColor(type: 'inflow' | 'outflow'): string {
  return type === 'inflow' ? semanticColors.dataGreen : semanticColors.error;
}
