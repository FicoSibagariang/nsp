import React from 'react';
import { VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { formatRp } from '../../../utils/format';
import type {
  CashflowRow,
  IncomeStatementData,
  BalanceSheetData,
  ReportType,
} from '../types';

interface FinancialStatementsReportProps {
  selectedReport: 'cashflow_statement' | 'income_statement' | 'balance_sheet' | ReportType;
  cashflowData?: CashflowRow[] | null;
  incomeData?: IncomeStatementData | null;
  balanceData?: BalanceSheetData | null;
  hideZeroBalance: boolean;
}

export function FinancialStatementsReport({
  selectedReport,
  cashflowData,
  incomeData,
  balanceData,
  hideZeroBalance,
}: FinancialStatementsReportProps) {
  if (selectedReport === 'cashflow_statement' && cashflowData) {
    const totalInflow = cashflowData
      .filter((c) => c.category === 'inflow')
      .reduce((sum, item) => sum + Number(item.total || 0), 0);
    const totalOutflow = cashflowData
      .filter((c) => c.category === 'outflow')
      .reduce((sum, item) => sum + Number(item.total || 0), 0);
    const netCashflow = totalInflow - totalOutflow;

    return (
      <VStack gap={4}>
        <Text type="body">
          Laporan arus kas masuk (Inflow) dan keluar (Outflow) riil berdasarkan pos aktivitas
          transaksi.
        </Text>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '12px 8px', fontWeight: 600 }}>Pos Transaksi Arus Kas</th>
              <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>
                Total Nominal
              </th>
            </tr>
          </thead>
          <tbody>
            {['inflow', 'outflow'].map((cat) => {
              const isCatInflow = cat === 'inflow';
              const items = cashflowData.filter((c) => c.category === cat);
              const catTotal = isCatInflow ? totalInflow : totalOutflow;

              return (
                <React.Fragment key={cat}>
                  <tr>
                    <td
                      colSpan={2}
                      style={{
                        padding: '12px 8px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        backgroundColor: 'var(--color-background-secondary)',
                      }}
                    >
                      {isCatInflow ? '🟢 ARUS KAS MASUK (INFLOW)' : '🔴 ARUS KAS KELUAR (OUTFLOW)'}
                    </td>
                  </tr>
                  {items.map((item, idx) => (
                    <tr
                      key={idx}
                      style={{ borderBottom: '1px solid var(--color-border-primary)' }}
                    >
                      <td style={{ padding: '12px 8px', fontWeight: 500 }}>
                        {item.label || item.subcategory}
                      </td>
                      <td
                        style={{
                          padding: '12px 8px',
                          textAlign: 'right',
                          fontWeight: 600,
                          color: isCatInflow
                            ? 'var(--color-success-500)'
                            : 'var(--color-critical-500)',
                        }}
                      >
                        {isCatInflow ? '+' : '-'}
                        {formatRp(item.total)}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td
                        colSpan={2}
                        style={{
                          padding: '12px 8px',
                          color: 'var(--color-text-secondary)',
                          fontStyle: 'italic',
                        }}
                      >
                        Tidak ada transaksi kas pada periode ini.
                      </td>
                    </tr>
                  )}
                  <tr
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      fontWeight: 600,
                      backgroundColor: 'var(--color-background-subtle)',
                    }}
                  >
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      Total {isCatInflow ? 'Kas Masuk' : 'Kas Keluar'}
                    </td>
                    <td
                      style={{
                        padding: '12px 8px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: isCatInflow
                          ? 'var(--color-success-500)'
                          : 'var(--color-critical-500)',
                      }}
                    >
                      {formatRp(catTotal)}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}

            <tr
              style={{
                borderBottom: '2px solid var(--color-border)',
                backgroundColor: 'var(--color-background-secondary)',
                fontWeight: 700,
                fontSize: '15px',
              }}
            >
              <td style={{ padding: '16px 8px' }}>ARUS KAS BERSIH (NET CASH FLOW)</td>
              <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                {formatRp(netCashflow)}
              </td>
            </tr>
          </tbody>
        </table>
      </VStack>
    );
  }

  if (selectedReport === 'income_statement' && incomeData) {
    const revenues = hideZeroBalance
      ? incomeData.revenues.filter((item) => Number(item.balance) !== 0)
      : incomeData.revenues;
    const expenses = hideZeroBalance
      ? incomeData.expenses.filter((item) => Number(item.balance) !== 0)
      : incomeData.expenses;

    return (
      <VStack gap={4}>
        <Text type="body">
          Laporan Pendapatan dan Beban untuk mengetahui sisa hasil usaha periode berjalan.
        </Text>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '12px 8px', fontWeight: 600 }}>Kode Akun</th>
              <th style={{ padding: '12px 8px', fontWeight: 600 }}>Nama Akun</th>
              <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Saldo</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={3}
                style={{
                  padding: '12px 8px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  backgroundColor: 'var(--color-background-secondary)',
                }}
              >
                PENDAPATAN (REVENUE)
              </td>
            </tr>
            {revenues.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                <td style={{ padding: '12px 8px', fontFamily: 'monospace' }}>{item.code}</td>
                <td style={{ padding: '12px 8px' }}>{item.name}</td>
                <td
                  style={{
                    padding: '12px 8px',
                    textAlign: 'right',
                    color: 'var(--color-success-500)',
                  }}
                >
                  {formatRp(item.balance)}
                </td>
              </tr>
            ))}
            {revenues.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  style={{
                    padding: '12px 8px',
                    textAlign: 'center',
                    color: 'var(--color-text-secondary)',
                    fontStyle: 'italic',
                  }}
                >
                  Tidak ada pos pendapatan bersaldo pada periode ini.
                </td>
              </tr>
            )}
            <tr style={{ borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>
              <td colSpan={2} style={{ padding: '12px 8px', textAlign: 'right' }}>
                Total Pendapatan
              </td>
              <td
                style={{
                  padding: '12px 8px',
                  textAlign: 'right',
                  color: 'var(--color-success-500)',
                }}
              >
                {formatRp(incomeData.totalRevenue)}
              </td>
            </tr>

            <tr>
              <td
                colSpan={3}
                style={{
                  padding: '12px 8px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  backgroundColor: 'var(--color-background-secondary)',
                }}
              >
                BEBAN (EXPENSE)
              </td>
            </tr>
            {expenses.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                <td style={{ padding: '12px 8px', fontFamily: 'monospace' }}>{item.code}</td>
                <td style={{ padding: '12px 8px' }}>{item.name}</td>
                <td
                  style={{
                    padding: '12px 8px',
                    textAlign: 'right',
                    color: 'var(--color-critical-500)',
                  }}
                >
                  {formatRp(item.balance)}
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  style={{
                    padding: '12px 8px',
                    textAlign: 'center',
                    color: 'var(--color-text-secondary)',
                    fontStyle: 'italic',
                  }}
                >
                  Tidak ada pos beban bersaldo pada periode ini.
                </td>
              </tr>
            )}
            <tr style={{ borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>
              <td colSpan={2} style={{ padding: '12px 8px', textAlign: 'right' }}>
                Total Beban
              </td>
              <td
                style={{
                  padding: '12px 8px',
                  textAlign: 'right',
                  color: 'var(--color-critical-500)',
                }}
              >
                {formatRp(incomeData.totalExpense)}
              </td>
            </tr>

            <tr
              style={{
                borderBottom: '2px solid var(--color-border)',
                backgroundColor: 'var(--color-background-subtle)',
                fontWeight: 600,
              }}
            >
              <td colSpan={2} style={{ padding: '16px 8px' }}>
                LABA BERSIH (NET INCOME)
              </td>
              <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                {formatRp(incomeData.netIncome)}
              </td>
            </tr>
          </tbody>
        </table>
      </VStack>
    );
  }

  if (selectedReport === 'balance_sheet' && balanceData) {
    const assets = hideZeroBalance
      ? balanceData.assets.filter((item) => Number(item.balance) !== 0)
      : balanceData.assets;
    const liabilities = hideZeroBalance
      ? balanceData.liabilities.filter((item) => Number(item.balance) !== 0)
      : balanceData.liabilities;
    const equity = hideZeroBalance
      ? balanceData.equity.filter((item) => Number(item.balance) !== 0)
      : balanceData.equity;

    return (
      <VStack gap={3}>
        <Text type="body" style={{ fontSize: '13px' }}>
          Laporan Posisi Keuangan (Neraca) menyajikan perbandingan antara Aset (Aktiva) di sisi kiri
          dengan Kewajiban & Ekuitas (Pasiva) di sisi kanan.
        </Text>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px',
            alignItems: 'stretch',
            marginTop: '4px',
          }}
        >
          {/* SISI KIRI: ASET (AKTIVA) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              overflow: 'hidden',
              backgroundColor: 'var(--color-background-primary)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--color-background-secondary)',
                    borderBottom: '2px solid var(--color-border)',
                    textAlign: 'left',
                  }}
                >
                  <th
                    colSpan={3}
                    style={{
                      padding: '8px 10px',
                      fontWeight: 700,
                      fontSize: '13px',
                      textTransform: 'uppercase',
                    }}
                  >
                    ASET (AKTIVA)
                  </th>
                </tr>
                <tr
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)',
                    textAlign: 'left',
                  }}
                >
                  <th style={{ padding: '6px 10px', width: '65px', fontWeight: 600 }}>Kode</th>
                  <th style={{ padding: '6px 10px', fontWeight: 600 }}>Nama Akun</th>
                  <th
                    style={{
                      padding: '6px 10px',
                      width: '110px',
                      fontWeight: 600,
                      textAlign: 'right',
                    }}
                  >
                    Saldo
                  </th>
                </tr>
              </thead>
              <tbody>
                {assets.map((item, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid var(--color-border-primary)',
                      fontSize: '13px',
                    }}
                  >
                    <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: '12px' }}>
                      {item.code}
                    </td>
                    <td style={{ padding: '6px 10px' }}>{item.name}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                      {formatRp(item.balance)}
                    </td>
                  </tr>
                ))}
                {assets.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        padding: '12px 10px',
                        textAlign: 'center',
                        color: 'var(--color-text-secondary)',
                        fontStyle: 'italic',
                        fontSize: '12px',
                      }}
                    >
                      Tidak ada pos aset bersaldo pada periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* TOTAL ASET */}
            <div
              style={{
                marginTop: 'auto',
                borderTop: '2px solid var(--color-border)',
                backgroundColor: 'var(--color-background-subtle)',
                padding: '10px 10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontWeight: 700,
                fontSize: '13px',
              }}
            >
              <span>TOTAL ASET</span>
              <span style={{ color: 'var(--color-primary-600, inherit)' }}>
                {formatRp(balanceData.totalAssets)}
              </span>
            </div>
          </div>

          {/* SISI KANAN: KEWAJIBAN & EKUITAS (PASIVA) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              overflow: 'hidden',
              backgroundColor: 'var(--color-background-primary)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--color-background-secondary)',
                    borderBottom: '2px solid var(--color-border)',
                    textAlign: 'left',
                  }}
                >
                  <th
                    colSpan={3}
                    style={{
                      padding: '8px 10px',
                      fontWeight: 700,
                      fontSize: '13px',
                      textTransform: 'uppercase',
                    }}
                  >
                    KEWAJIBAN & EKUITAS (PASIVA)
                  </th>
                </tr>
                <tr
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)',
                    textAlign: 'left',
                  }}
                >
                  <th style={{ padding: '6px 10px', width: '65px', fontWeight: 600 }}>Kode</th>
                  <th style={{ padding: '6px 10px', fontWeight: 600 }}>Nama Akun</th>
                  <th
                    style={{
                      padding: '6px 10px',
                      width: '110px',
                      fontWeight: 600,
                      textAlign: 'right',
                    }}
                  >
                    Saldo
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Sub-header: Kewajiban */}
                <tr style={{ backgroundColor: 'var(--color-background-subtle)' }}>
                  <td
                    colSpan={3}
                    style={{
                      padding: '5px 10px',
                      fontWeight: 600,
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    1. KEWAJIBAN (LIABILITIES)
                  </td>
                </tr>
                {liabilities.map((item, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid var(--color-border-primary)',
                      fontSize: '13px',
                    }}
                  >
                    <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: '12px' }}>
                      {item.code}
                    </td>
                    <td style={{ padding: '6px 10px' }}>{item.name}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                      {formatRp(item.balance)}
                    </td>
                  </tr>
                ))}
                {liabilities.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        padding: '6px 10px',
                        textAlign: 'center',
                        color: 'var(--color-text-secondary)',
                        fontStyle: 'italic',
                        fontSize: '12px',
                      }}
                    >
                      Tidak ada pos kewajiban bersaldo.
                    </td>
                  </tr>
                )}
                <tr
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    fontWeight: 600,
                    fontSize: '12px',
                    backgroundColor: 'var(--color-background-primary)',
                  }}
                >
                  <td colSpan={2} style={{ padding: '6px 10px', textAlign: 'right' }}>
                    Total Kewajiban:
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                    {formatRp(balanceData.totalLiabilities)}
                  </td>
                </tr>

                {/* Sub-header: Ekuitas */}
                <tr style={{ backgroundColor: 'var(--color-background-subtle)' }}>
                  <td
                    colSpan={3}
                    style={{
                      padding: '5px 10px',
                      fontWeight: 600,
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    2. EKUITAS (EQUITY)
                  </td>
                </tr>
                {equity.map((item, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid var(--color-border-primary)',
                      fontSize: '13px',
                    }}
                  >
                    <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: '12px' }}>
                      {item.code}
                    </td>
                    <td style={{ padding: '6px 10px' }}>
                      {item.name}
                      {item.code === '33102' && (
                        <Text
                          type="supporting"
                          color="secondary"
                          style={{ display: 'block', fontSize: '10px' }}
                        >
                          * Termasuk Laba Bersih Tahun Berjalan
                        </Text>
                      )}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                      {formatRp(item.balance)}
                    </td>
                  </tr>
                ))}
                {equity.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        padding: '6px 10px',
                        textAlign: 'center',
                        color: 'var(--color-text-secondary)',
                        fontStyle: 'italic',
                        fontSize: '12px',
                      }}
                    >
                      Tidak ada pos ekuitas bersaldo.
                    </td>
                  </tr>
                )}
                <tr
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    fontWeight: 600,
                    fontSize: '12px',
                    backgroundColor: 'var(--color-background-primary)',
                  }}
                >
                  <td colSpan={2} style={{ padding: '6px 10px', textAlign: 'right' }}>
                    Total Ekuitas:
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                    {formatRp(balanceData.totalEquity)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* TOTAL KEWAJIBAN & EKUITAS */}
            <div
              style={{
                marginTop: 'auto',
                borderTop: '2px solid var(--color-border)',
                backgroundColor: 'var(--color-background-subtle)',
                padding: '10px 10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontWeight: 700,
                fontSize: '13px',
                color:
                  balanceData.totalAssets ===
                  balanceData.totalLiabilities + balanceData.totalEquity
                    ? 'inherit'
                    : 'var(--color-critical-500)',
              }}
            >
              <span>TOTAL KEWAJIBAN & EKUITAS</span>
              <span>
                {formatRp(balanceData.totalLiabilities + balanceData.totalEquity)}
              </span>
            </div>
          </div>
        </div>
      </VStack>
    );
  }

  return null;
}
