import { VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { formatRp } from '../../../utils/format';
import { maskName } from '../../../utils/privacyMask';
import type { ArReportRow, SavingsMemberRow, ReportType } from '../types';

interface MemberAccountsReportProps {
  selectedReport: 'ar_summary' | 'savings_member' | ReportType;
  arData?: ArReportRow[] | null;
  savingsMemberData?: SavingsMemberRow[] | null;
  isDemoMode: boolean;
}

export function MemberAccountsReport({
  selectedReport,
  arData,
  savingsMemberData,
  isDemoMode,
}: MemberAccountsReportProps) {
  if (selectedReport === 'ar_summary' && arData) {
    const totalRemaining = arData.reduce(
      (sum, item) => sum + Number(item.remainingAmount || 0),
      0
    );

    return (
      <VStack gap={4}>
        <Text type="body">
          Rincian tagihan pinjaman per anggota yang masih memiliki sisa piutang aktif atau macet.
        </Text>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '12px 8px', fontWeight: 600 }}>Nama Anggota</th>
              <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>
                Pokok Pinjaman
              </th>
              <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>
                Total Tagihan
              </th>
              <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>
                Telah Dibayar
              </th>
              <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>
                Sisa Piutang
              </th>
              <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'center' }}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {arData.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                <td style={{ padding: '12px 8px' }}>
                  {isDemoMode ? maskName(item.memberName, item.memberName) : item.memberName}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>{formatRp(item.principal)}</td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>{formatRp(item.totalAmount)}</td>
                <td
                  style={{
                    padding: '12px 8px',
                    textAlign: 'right',
                    color: 'var(--color-success-500)',
                  }}
                >
                  {formatRp(item.paidAmount)}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>
                  {formatRp(item.remainingAmount)}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                  <StatusBadge status={item.status as any} />
                </td>
              </tr>
            ))}
            {arData.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Tidak ada piutang.
                </td>
              </tr>
            )}
            <tr
              style={{
                borderBottom: '2px solid var(--color-border)',
                backgroundColor: 'var(--color-background-secondary)',
                fontWeight: 600,
              }}
            >
              <td colSpan={4} style={{ padding: '12px 8px' }}>
                Total Sisa Piutang Koperasi
              </td>
              <td style={{ padding: '12px 8px', textAlign: 'right' }}>{formatRp(totalRemaining)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </VStack>
    );
  }

  if (selectedReport === 'savings_member' && savingsMemberData) {
    const totalSavings = savingsMemberData.reduce(
      (sum, item) => sum + Number(item.totalSavings || 0),
      0
    );

    return (
      <VStack gap={4}>
        <Text type="body">Rincian simpanan (Pokok, Wajib, Sukarela) per anggota koperasi.</Text>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '12px 8px', fontWeight: 600 }}>Nama Anggota</th>
              <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Pokok</th>
              <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Wajib</th>
              <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>
                Sukarela
              </th>
              <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>
                Total Simpanan
              </th>
            </tr>
          </thead>
          <tbody>
            {savingsMemberData.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                <td style={{ padding: '12px 8px' }}>
                  {isDemoMode ? maskName(item.memberName, item.memberName) : item.memberName}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                  {formatRp(item.simpananPokok)}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                  {formatRp(item.simpananWajib)}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                  {formatRp(item.simpananSukarela)}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>
                  {formatRp(item.totalSavings)}
                </td>
              </tr>
            ))}
            {savingsMemberData.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Tidak ada data anggota.
                </td>
              </tr>
            )}
            <tr
              style={{
                borderBottom: '2px solid var(--color-border)',
                backgroundColor: 'var(--color-background-secondary)',
                fontWeight: 600,
              }}
            >
              <td colSpan={4} style={{ padding: '12px 8px' }}>
                Total Simpanan Koperasi
              </td>
              <td style={{ padding: '12px 8px', textAlign: 'right' }}>{formatRp(totalSavings)}</td>
            </tr>
          </tbody>
        </table>
      </VStack>
    );
  }

  return null;
}
