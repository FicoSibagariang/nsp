import React, { useMemo } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Heading, Text } from '@astryxdesign/core/Text';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Table, proportional, pixel } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { Badge } from '@astryxdesign/core/Badge';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Pagination } from '../../../components/Pagination';
import { formatRp } from '../../../utils/format';
import { maskName, maskNip, maskNik, maskEmail, maskAccountNumber } from '../../../utils/privacyMask';
import type { CompanyEmployee } from '../types';

interface EmployeesTabProps {
  empTotal: number;
  empSearch: string;
  setEmpSearch: (val: string) => void;
  empLoading: boolean;
  employees: CompanyEmployee[];
  empPage: number;
  empLimit: number;
  setEmpPage: (val: number) => void;
  isDemoMode: boolean;
}

export function EmployeesTab({
  empTotal,
  empSearch,
  setEmpSearch,
  empLoading,
  employees,
  empPage,
  empLimit,
  setEmpPage,
  isDemoMode,
}: EmployeesTabProps) {
  const employeeColumns: TableColumn<CompanyEmployee>[] = useMemo(
    () => [
      {
        key: 'nip',
        header: 'NIP / NIK',
        width: pixel(140),
        renderCell: (e: CompanyEmployee) => {
          const displayNip = isDemoMode ? maskNip(e.id, e.nip) : e.nip;
          const displayNik = isDemoMode ? maskNik(e.id, e.nik) : (e.nik || '-');
          return (
            <VStack gap={0}>
              <Text type="body" weight="medium">{displayNip}</Text>
              <Text type="supporting" color="secondary">{displayNik}</Text>
            </VStack>
          );
        },
      },
      {
        key: 'name',
        header: 'Nama & Email',
        width: proportional(1.5),
        renderCell: (e: CompanyEmployee) => {
          const displayName = isDemoMode ? maskName(e.id, e.name) : e.name;
          const displayEmail = isDemoMode ? maskEmail(e.id, e.email) : e.email;
          return (
            <VStack gap={0}>
              <Text type="body" weight="semibold">{displayName}</Text>
              <Text type="supporting" color="secondary">{displayEmail}</Text>
            </VStack>
          );
        },
      },
      {
        key: 'salary',
        header: 'Plafon EWA',
        width: proportional(1.5),
        renderCell: (e: CompanyEmployee) => {
          const effective = e.effectiveSalary ?? e.baseSalary;
          const dailyLimit = e.dailyAccumulatedLimit ?? Math.floor(effective * 0.5);
          const maxMonthly = Math.floor(effective * 0.5);
          return (
            <VStack gap={0}>
              <Text type="body" weight="bold" color="primary">
                {formatRp(dailyLimit)}
              </Text>
              <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
                Plafon Hari Ini (Maks. Sebulan: {formatRp(maxMonthly)})
              </Text>
            </VStack>
          );
        },
      },
      {
        key: 'status',
        header: 'Status Koperasi',
        width: pixel(140),
        renderCell: (e: CompanyEmployee) => (
          <Badge variant={e.isMember ? 'success' : 'neutral'} label={e.isMember ? 'Anggota Koperasi' : 'Bukan Anggota'} />
        ),
      },
      {
        key: 'contract',
        header: 'Masa Kontrak',
        width: pixel(140),
        renderCell: (e: CompanyEmployee) => {
          if (!e.contractEndDate) {
            return <Badge variant="neutral" label="Karyawan Tetap" />;
          }
          const today = new Date().toISOString().slice(0, 10);
          const endStr = String(e.contractEndDate).slice(0, 10);
          const isExpired = today > endStr;
          return (
            <VStack gap={0}>
              <Badge variant={isExpired ? 'error' : 'warning'} label={isExpired ? 'Kontrak Berakhir' : 'Kontrak Aktif'} />
              <Text type="supporting" color={isExpired ? undefined : 'secondary'} style={{ fontSize: 11, ...(isExpired ? { color: 'var(--color-text-error)' } : {}) }}>
                s/d {endStr}
              </Text>
            </VStack>
          );
        },
      },
      {
        key: 'bank',
        header: 'Rekening Payroll',
        width: proportional(1.5),
        renderCell: (e: CompanyEmployee) => (
          <Text type="supporting">
            {e.bankName ? `${e.bankName} - ${isDemoMode ? maskAccountNumber(e.id, e.bankAccountNumber) : e.bankAccountNumber}` : 'Belum diatur'}
          </Text>
        ),
      },
    ],
    [isDemoMode]
  );

  return (
    <Card>
      <VStack gap={4}>
        <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
          <VStack gap={0}>
            <Heading level={4}>Master Data Karyawan Perusahaan Induk</Heading>
            <Text type="supporting" color="secondary">
              Total: {empTotal} Karyawan terdaftar
            </Text>
          </VStack>
          <input
            type="text"
            placeholder="Cari nama / NIP / email..."
            value={empSearch}
            onChange={(e) => {
              setEmpSearch(e.target.value);
              setEmpPage(1);
            }}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--color-border-primary)',
              backgroundColor: 'var(--color-background-primary)',
              color: 'var(--color-text-primary)',
              width: 250,
            }}
          />
        </HStack>

        {empLoading ? (
          <Spinner size="md" />
        ) : employees.length > 0 ? (
          <VStack gap={3}>
            <Table data={employees} columns={employeeColumns} idKey="id" density="balanced" />
            <Pagination
              page={empPage}
              limit={empLimit}
              total={empTotal}
              onPageChange={setEmpPage}
            />
          </VStack>
        ) : (
          <Text type="supporting" color="secondary">
            Belum ada data karyawan. Gunakan tombol "Import Data Karyawan (CSV)" untuk menambahkan.
          </Text>
        )}
      </VStack>
    </Card>
  );
}
