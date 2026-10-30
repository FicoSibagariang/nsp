import { VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { formatRp } from '../../../utils/format';
import type { ReportData } from '@shared/types';
import type { ReportType } from '../types';

interface CooperativeSummaryReportProps {
  selectedReport: 'cooperative_summary' | 'savings_summary' | 'loans_summary' | ReportType;
  data: ReportData;
}

export function CooperativeSummaryReport({ selectedReport, data }: CooperativeSummaryReportProps) {
  if (selectedReport === 'cooperative_summary') {
    return (
      <VStack gap={4}>
        <Text type="body">
          Laporan ini menyajikan rangkuman perkembangan koperasi secara umum yang mencakup data
          keanggotaan, akumulasi simpanan, serta total portofolio penyaluran pinjaman.
        </Text>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '12px 8px', fontWeight: 600 }}>
                Parameter Keuangan & Operasional
              </th>
              <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>
                Nilai/Jumlah
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
              <td style={{ padding: '12px 8px' }}>Total Anggota Terdaftar</td>
              <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>
                {data.members?.totalMembers ?? 0} Orang
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
              <td style={{ padding: '12px 8px' }}>Anggota Berstatus Aktif</td>
              <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>
                {data.members?.activeMembers ?? 0} Orang
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
              <td style={{ padding: '12px 8px' }}>Total Dana Simpanan Anggota</td>
              <td
                style={{
                  padding: '12px 8px',
                  textAlign: 'right',
                  fontWeight: 500,
                  color: 'var(--color-success-500)',
                }}
              >
                {formatRp(data.members?.totalSavings)}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
              <td style={{ padding: '12px 8px' }}>Total Pinjaman Tersalurkan (Kredit Aktif)</td>
              <td
                style={{
                  padding: '12px 8px',
                  textAlign: 'right',
                  fontWeight: 500,
                  color: 'var(--color-primary-500)',
                }}
              >
                {formatRp(data.loans?.totalLoansAmount)}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '12px 8px' }}>Total Penerimaan Angsuran Pinjaman</td>
              <td
                style={{
                  padding: '12px 8px',
                  textAlign: 'right',
                  fontWeight: 500,
                  color: 'var(--color-success-500)',
                }}
              >
                {formatRp(data.loans?.totalPaymentsReceived)}
              </td>
            </tr>
          </tbody>
        </table>
      </VStack>
    );
  }

  if (selectedReport === 'savings_summary') {
    return (
      <VStack gap={4}>
        <Text type="body">
          Rincian portfolio dana simpanan yang dihimpun dari seluruh anggota koperasi yang terbagi
          berdasarkan jenis simpanan pokok, wajib, dan sukarela.
        </Text>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '12px 8px', fontWeight: 600 }}>Jenis Simpanan</th>
              <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>
                Total Akumulasi
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
              <td style={{ padding: '12px 8px' }}>Simpanan Pokok (Modal Awal)</td>
              <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>
                {formatRp(data.members?.totalPokok)}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
              <td style={{ padding: '12px 8px' }}>Simpanan Wajib (Bulanan)</td>
              <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>
                {formatRp(data.members?.totalWajib)}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
              <td style={{ padding: '12px 8px' }}>Simpanan Sukarela (Tabungan Bebas)</td>
              <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>
                {formatRp(data.members?.totalSukarela)}
              </td>
            </tr>
            <tr
              style={{
                borderBottom: '2px solid var(--color-border)',
                backgroundColor: 'var(--color-background-secondary)',
              }}
            >
              <td style={{ padding: '12px 8px', fontWeight: 600 }}>Total Seluruh Simpanan</td>
              <td
                style={{
                  padding: '12px 8px',
                  textAlign: 'right',
                  fontWeight: 600,
                  color: 'var(--color-success-500)',
                }}
              >
                {formatRp(data.members?.totalSavings)}
              </td>
            </tr>
          </tbody>
        </table>
      </VStack>
    );
  }

  if (selectedReport === 'loans_summary') {
    return (
      <VStack gap={4}>
        <Text type="body">
          Rincian portofolio kredit dan pinjaman yang telah disalurkan kepada anggota beserta status
          pengembalian dan kualitas aset kredit.
        </Text>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '12px 8px', fontWeight: 600 }}>Status Portofolio Kredit</th>
              <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>
                Total Nominal
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
              <td style={{ padding: '12px 8px' }}>Kredit Lancar Aktif (Disetujui)</td>
              <td
                style={{
                  padding: '12px 8px',
                  textAlign: 'right',
                  fontWeight: 500,
                  color: 'var(--color-primary-500)',
                }}
              >
                {formatRp(data.loans?.activeLoansAmount)}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
              <td style={{ padding: '12px 8px' }}>Kredit Lunas (Telah Diselesaikan)</td>
              <td
                style={{
                  padding: '12px 8px',
                  textAlign: 'right',
                  fontWeight: 500,
                  color: 'var(--color-success-500)',
                }}
              >
                {formatRp(data.loans?.paidLoansAmount)}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
              <td style={{ padding: '12px 8px' }}>Kredit Bermasalah (Macet / NPL)</td>
              <td
                style={{
                  padding: '12px 8px',
                  textAlign: 'right',
                  fontWeight: 500,
                  color: 'var(--color-critical-500)',
                }}
              >
                {formatRp(data.loans?.badLoansAmount)}
              </td>
            </tr>
            <tr
              style={{
                borderBottom: '2px solid var(--color-border)',
                backgroundColor: 'var(--color-background-secondary)',
              }}
            >
              <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                Total Kumulatif Penyaluran Pinjaman
              </td>
              <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>
                {formatRp(data.loans?.totalLoansAmount)}
              </td>
            </tr>
          </tbody>
        </table>
      </VStack>
    );
  }

  return null;
}
