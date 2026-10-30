import { VStack } from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { formatRp } from '../../../utils/format';
import type { RevenueProjectionData } from '../types';

interface RevenueProjectionReportProps {
  data: RevenueProjectionData;
}

export function RevenueProjectionReport({ data }: RevenueProjectionReportProps) {
  const netIncome = data.summary.projectedNetIncome ?? 0;
  const isProfit = netIncome > 0;
  const isLoss = netIncome < 0;
  const totalRev =
    data.summary.totalProjectedRevenue ?? data.summary.totalEstimatedFullYearInterest;
  const totalExp = data.summary.totalRealizedExpense ?? 0;

  const statusBg = isProfit
    ? 'var(--color-background-success-subtle)'
    : isLoss
    ? 'var(--color-background-danger-subtle)'
    : 'var(--color-background-subtle)';
  const statusBorder = isProfit
    ? 'var(--color-success-500)'
    : isLoss
    ? 'var(--color-critical-500)'
    : 'var(--color-border-primary)';
  const statusTextColor = isProfit
    ? 'var(--color-success-500)'
    : isLoss
    ? 'var(--color-critical-500)'
    : 'var(--color-text-secondary)';
  const statusLabel = isProfit
    ? '🟢 ESTIMASI UNTUNG (SURPLUS SHU)'
    : isLoss
    ? '🔴 ESTIMASI RUGI (DEFISIT)'
    : '⚪ ESTIMASI IMPAS (BREAK-EVEN)';

  return (
    <VStack gap={4}>
      <Text type="body">
        Laporan ini menyajikan analisis komprehensif proyeksi keuangan akhir tahun {data.year},
        memperhitungkan pendapatan yang telah masuk, proyeksi bunga pinjaman sisa tahun, dan seluruh
        beban operasional/pengeluaran yang telah dicatat di jurnal.
      </Text>

      {/* Banner Estimasi Laba/Rugi Akhir Tahun */}
      <div
        style={{
          padding: '20px',
          borderRadius: '10px',
          border: `2px solid ${statusBorder}`,
          backgroundColor: statusBg,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            <Text
              type="supporting"
              color="secondary"
              style={{
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Proyeksi Hasil Akhir Tahun Buku {data.year}
            </Text>
            <div style={{ fontSize: '26px', fontWeight: 800, color: statusTextColor, marginTop: '2px' }}>
              {isProfit ? `+${formatRp(netIncome)}` : isLoss ? `-${formatRp(Math.abs(netIncome))}` : formatRp(0)}
            </div>
          </div>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              backgroundColor: isProfit
                ? 'var(--color-success-500)'
                : isLoss
                ? 'var(--color-critical-500)'
                : 'var(--color-text-secondary)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '13px',
              letterSpacing: '0.3px',
            }}
          >
            {statusLabel}
          </div>
        </div>
        <Text type="supporting" color="secondary" style={{ fontSize: '13px', lineHeight: 1.5 }}>
          Berdasarkan estimasi total pendapatan <strong>{formatRp(totalRev)}</strong> (Realisasi:{' '}
          {formatRp(data.summary.totalRealizedRevenue ?? data.summary.totalRealizedInterest)} + Proyeksi Bunga:{' '}
          {formatRp(data.summary.totalProjectedInterest)}) dikurangi seluruh pengeluaran/beban tercatat senilai{' '}
          <strong>{formatRp(totalExp)}</strong>.
        </Text>
      </div>

      {/* KPI Highlight Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginTop: '8px',
        }}
      >
        {/* Card 1: Realisasi Pendapatan Masuk */}
        <div
          style={{
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid var(--color-border-primary)',
            backgroundColor: 'var(--color-background-subtle)',
          }}
        >
          <Text
            type="supporting"
            color="secondary"
            style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}
          >
            Pendapatan Masuk (Realisasi)
          </Text>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--color-success-500)',
              marginTop: '4px',
            }}
          >
            {formatRp(data.summary.totalRealizedRevenue ?? data.summary.totalRealizedInterest)}
          </div>
          <Text type="supporting" color="secondary" style={{ fontSize: '11px', marginTop: '4px' }}>
            Bunga: {formatRp(data.summary.totalRealizedInterest)}
            {(data.summary.totalRealizedOtherRevenue ?? 0) > 0 &&
              ` + Lain: ${formatRp(data.summary.totalRealizedOtherRevenue!)}`}
          </Text>
        </div>

        {/* Card 2: Proyeksi Bunga Sisa Tahun */}
        <div
          style={{
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid var(--color-border-primary)',
            backgroundColor: 'var(--color-background-subtle)',
          }}
        >
          <Text
            type="supporting"
            color="secondary"
            style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}
          >
            Proyeksi Bunga Sisa Tahun
          </Text>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--color-primary-500)',
              marginTop: '4px',
            }}
          >
            {formatRp(data.summary.totalProjectedInterest)}
          </div>
          <Text type="supporting" color="secondary" style={{ fontSize: '11px', marginTop: '4px' }}>
            Dari {data.summary.totalProjectedInstallments} angsuran terjadwal
          </Text>
        </div>

        {/* Card 3: Total Estimasi Pendapatan 1 Tahun */}
        <div
          style={{
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid var(--color-border-primary)',
            backgroundColor: 'var(--color-background-subtle)',
          }}
        >
          <Text
            type="supporting"
            color="secondary"
            style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}
          >
            Total Estimasi Pendapatan
          </Text>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              marginTop: '4px',
            }}
          >
            {formatRp(data.summary.totalProjectedRevenue ?? data.summary.totalEstimatedFullYearInterest)}
          </div>
          <Text type="supporting" color="secondary" style={{ fontSize: '11px', marginTop: '4px' }}>
            Realisasi Masuk + Proyeksi Bunga
          </Text>
        </div>

        {/* Card 4: Pengeluaran / Beban Tercatat */}
        <div
          style={{
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid var(--color-border-primary)',
            backgroundColor: 'var(--color-background-subtle)',
          }}
        >
          <Text
            type="supporting"
            color="secondary"
            style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}
          >
            Pengeluaran Tercatat (Beban)
          </Text>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color:
                (data.summary.totalRealizedExpense ?? 0) > 0
                  ? 'var(--color-error-500)'
                  : 'var(--color-text-primary)',
              marginTop: '4px',
            }}
          >
            {formatRp(data.summary.totalRealizedExpense ?? 0)}
          </div>
          <Text type="supporting" color="secondary" style={{ fontSize: '11px', marginTop: '4px' }}>
            Beban operasional di jurnal {data.year}
          </Text>
        </div>

        {/* Card 5: Total Kas Masuk Sisa Tahun */}
        <div
          style={{
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid var(--color-border-primary)',
            backgroundColor: 'var(--color-background-subtle)',
          }}
        >
          <Text
            type="supporting"
            color="secondary"
            style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}
          >
            Proyeksi Kas Masuk Sisa Tahun
          </Text>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--color-success-500)',
              marginTop: '4px',
            }}
          >
            {formatRp(data.summary.totalProjectedCashInflow)}
          </div>
          <Text type="supporting" color="secondary" style={{ fontSize: '11px', marginTop: '4px' }}>
            Pokok: {formatRp(data.summary.totalProjectedPrincipal)} + Bunga
          </Text>
        </div>
      </div>

      {/* Tabel 1: Simulasi Perhitungan Laba / Rugi Akhir Tahun */}
      <div style={{ marginTop: '12px' }}>
        <Heading level={4} style={{ marginBottom: '8px' }}>
          Simulasi Perhitungan Laba / Rugi Akhir Tahun ({data.year})
        </Heading>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px' }}>
          <thead>
            <tr
              style={{
                borderBottom: '2px solid var(--color-border)',
                textAlign: 'left',
                backgroundColor: 'var(--color-background-secondary)',
              }}
            >
              <th style={{ padding: '10px 8px', fontWeight: 600 }}>Komponen Keuangan</th>
              <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'right', width: '220px' }}>
                Nominal
              </th>
              <th style={{ padding: '10px 8px', fontWeight: 600, width: '42%' }}>
                Keterangan / Sumber
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
              <td style={{ padding: '10px 8px', fontWeight: 500 }}>
                1. Pendapatan yang Sudah Masuk (Realisasi)
              </td>
              <td
                style={{
                  padding: '10px 8px',
                  textAlign: 'right',
                  fontWeight: 600,
                  color: 'var(--color-success-500)',
                }}
              >
                {formatRp(data.summary.totalRealizedRevenue ?? data.summary.totalRealizedInterest)}
              </td>
              <td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                Pendapatan bunga pinjaman ({formatRp(data.summary.totalRealizedInterest)}) dan pos
                pendapatan lain yang telah tercatat
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
              <td style={{ padding: '10px 8px', fontWeight: 500 }}>
                2. Proyeksi Pendapatan Bunga Sisa Tahun
              </td>
              <td
                style={{
                  padding: '10px 8px',
                  textAlign: 'right',
                  fontWeight: 600,
                  color: 'var(--color-primary-500)',
                }}
              >
                +{formatRp(data.summary.totalProjectedInterest)}
              </td>
              <td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                Dari {data.summary.totalProjectedInstallments} tagihan angsuran pending s.d 31 Desember
              </td>
            </tr>
            <tr
              style={{
                borderBottom: '1px solid var(--color-border-primary)',
                backgroundColor: 'var(--color-background-subtle)',
                fontWeight: 600,
              }}
            >
              <td style={{ padding: '10px 8px' }}>Subtotal Total Estimasi Pendapatan (1 + 2)</td>
              <td
                style={{
                  padding: '10px 8px',
                  textAlign: 'right',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                }}
              >
                {formatRp(
                  data.summary.totalProjectedRevenue ?? data.summary.totalEstimatedFullYearInterest
                )}
              </td>
              <td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                Asumsi tidak ada pendapatan baru selain sisa bunga pinjaman berjalan
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
              <td style={{ padding: '10px 8px', fontWeight: 500 }}>
                3. Pengeluaran yang Sudah Tercatat (Beban)
              </td>
              <td
                style={{
                  padding: '10px 8px',
                  textAlign: 'right',
                  fontWeight: 600,
                  color:
                    (data.summary.totalRealizedExpense ?? 0) > 0
                      ? 'var(--color-error-500)'
                      : 'inherit',
                }}
              >
                -{formatRp(data.summary.totalRealizedExpense ?? 0)}
              </td>
              <td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                Beban operasional, gaji, dan biaya lain yang telah dibukukan di jurnal tahun berjalan
              </td>
            </tr>
            <tr
              style={{
                borderBottom: '2px solid var(--color-border)',
                backgroundColor: 'var(--color-background-secondary)',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              <td style={{ padding: '12px 8px' }}>Estimasi Laba / Rugi Akhir Tahun (Proyeksi Bersih)</td>
              <td
                style={{
                  padding: '12px 8px',
                  textAlign: 'right',
                  fontWeight: 700,
                  color:
                    (data.summary.projectedNetIncome ?? 0) >= 0
                      ? 'var(--color-success-500)'
                      : 'var(--color-error-500)',
                }}
              >
                {(data.summary.projectedNetIncome ?? 0) >= 0 ? '+' : ''}
                {formatRp(data.summary.projectedNetIncome ?? 0)}
              </td>
              <td style={{ padding: '12px 8px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    backgroundColor:
                      (data.summary.projectedNetIncome ?? 0) > 0
                        ? 'rgba(16, 185, 129, 0.15)'
                        : (data.summary.projectedNetIncome ?? 0) < 0
                        ? 'rgba(239, 68, 68, 0.15)'
                        : 'rgba(107, 114, 128, 0.15)',
                    color:
                      (data.summary.projectedNetIncome ?? 0) > 0
                        ? 'var(--color-success-500)'
                        : (data.summary.projectedNetIncome ?? 0) < 0
                        ? 'var(--color-error-500)'
                        : 'inherit',
                    fontWeight: 600,
                    fontSize: '12px',
                  }}
                >
                  {(data.summary.projectedNetIncome ?? 0) > 0
                    ? '🟢 UNTUNG (Laba Bersih)'
                    : (data.summary.projectedNetIncome ?? 0) < 0
                    ? '🔴 RUGI (Defisit Bersih)'
                    : '⚪ IMPAS'}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <div
          style={{
            marginTop: '8px',
            padding: '10px 14px',
            borderRadius: '6px',
            backgroundColor: 'var(--color-background-subtle)',
            border: '1px solid var(--color-border-primary)',
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          ℹ️ <strong>Catatan Asumsi:</strong> Perhitungan mengasumsikan seluruh jadwal cicilan pinjaman
          sisa tahun terbayar tepat waktu, tidak ada pendapatan lain selain bunga pinjaman terjadwal,
          dan tidak ada pengeluaran/beban baru selain yang telah tercatat.
        </div>
      </div>

      {/* Tabel 2: Rekapitulasi Bulanan */}
      <div style={{ marginTop: '12px' }}>
        <Heading level={4} style={{ marginBottom: '8px' }}>
          Rekapitulasi Bulanan Pendapatan & Kas Masuk ({data.year})
        </Heading>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px' }}>
          <thead>
            <tr
              style={{
                borderBottom: '2px solid var(--color-border)',
                textAlign: 'left',
                backgroundColor: 'var(--color-background-secondary)',
              }}
            >
              <th style={{ padding: '10px 8px', fontWeight: 600 }}>Bulan</th>
              <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'right' }}>
                Realisasi Bunga
              </th>
              <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'center' }}>
                Jml Cicilan
              </th>
              <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'right' }}>
                Proyeksi Bunga
              </th>
              <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'right' }}>
                Proyeksi Pokok
              </th>
              <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'right' }}>
                Total Kas Masuk
              </th>
            </tr>
          </thead>
          <tbody>
            {data.monthlyBreakdown.map((row) => (
              <tr key={row.monthKey} style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                <td style={{ padding: '10px 8px', fontWeight: 500 }}>{row.monthName}</td>
                <td
                  style={{
                    padding: '10px 8px',
                    textAlign: 'right',
                    color: row.realizedInterest > 0 ? 'var(--color-success-500)' : 'inherit',
                  }}
                >
                  {formatRp(row.realizedInterest)}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                  {row.installmentsCount > 0 ? `${row.installmentsCount} tagihan` : '-'}
                </td>
                <td
                  style={{
                    padding: '10px 8px',
                    textAlign: 'right',
                    color: row.projectedInterest > 0 ? 'var(--color-primary-500)' : 'inherit',
                  }}
                >
                  {formatRp(row.projectedInterest)}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                  {formatRp(row.projectedPrincipal)}
                </td>
                <td
                  style={{
                    padding: '10px 8px',
                    textAlign: 'right',
                    fontWeight: 500,
                    color: row.projectedTotal > 0 ? 'var(--color-success-500)' : 'inherit',
                  }}
                >
                  {formatRp(row.projectedTotal)}
                </td>
              </tr>
            ))}
            <tr
              style={{
                borderBottom: '2px solid var(--color-border)',
                backgroundColor: 'var(--color-background-secondary)',
                fontWeight: 600,
              }}
            >
              <td style={{ padding: '12px 8px' }}>Total ({data.year})</td>
              <td
                style={{
                  padding: '12px 8px',
                  textAlign: 'right',
                  color: 'var(--color-success-500)',
                }}
              >
                {formatRp(data.summary.totalRealizedInterest)}
              </td>
              <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                {data.summary.totalProjectedInstallments} tagihan
              </td>
              <td
                style={{
                  padding: '12px 8px',
                  textAlign: 'right',
                  color: 'var(--color-primary-500)',
                }}
              >
                {formatRp(data.summary.totalProjectedInterest)}
              </td>
              <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                {formatRp(data.summary.totalProjectedPrincipal)}
              </td>
              <td
                style={{
                  padding: '12px 8px',
                  textAlign: 'right',
                  color: 'var(--color-success-500)',
                }}
              >
                {formatRp(data.summary.totalProjectedCashInflow)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </VStack>
  );
}
