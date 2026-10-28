import React, { useState } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { apiFetch } from '../../../config';

interface ImportEmployeesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

export function ImportEmployeesModal({
  isOpen,
  onClose,
  onSuccess,
}: ImportEmployeesModalProps) {
  const [importCsvText, setImportCsvText] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) setImportCsvText(text);
    };
    reader.readAsText(file);
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportLoading(true);
    setImportError('');
    setImportSuccess('');

    try {
      const cleanText = importCsvText.replace(/^\uFEFF/, '').trim();
      const lines = cleanText.split(/\r?\n/);
      if (lines.length < 2) {
        setImportError('Data CSV kosong atau tidak memiliki baris data');
        setImportLoading(false);
        return;
      }

      const headers = parseCSVLine(lines[0]).map((h) =>
        h.trim().toLowerCase().replace(/^"|"$/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '')
      );
      const items: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const vals = parseCSVLine(line);
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          obj[h] = (vals[idx] || '').trim().replace(/^"|"$/g, '');
        });

        const rawSalaryStr =
          obj['jumlah gaji'] || obj['gaji_pokok'] || obj['gaji'] || obj['basesalary'] || obj['salary'] || '0';
        const rawLoanStr =
          obj['jumlah potongan pinjaman (jika ada)'] ||
          obj['jumlah potongan pinjaman'] ||
          obj['potongan_pinjaman'] ||
          obj['potongan_gaji'] ||
          obj['potongan'] ||
          '0';

        const rawSalary = parseFloat(rawSalaryStr.replace(/[^\d.]/g, '')) || 0;
        const rawLoanDeduction = parseFloat(rawLoanStr.replace(/[^\d.]/g, '')) || 0;

        let netSalary = Math.max(0, rawSalary - rawLoanDeduction);

        const maxCapEnv = (import.meta as any).env?.VITE_EWA_MAX_BASE_SALARY;
        if (maxCapEnv) {
          const cap = parseFloat(maxCapEnv);
          if (!isNaN(cap) && cap > 0) {
            netSalary = Math.min(netSalary, cap);
          }
        }

        const rawContractEnd =
          obj['tanggal berakhir kontrak'] ||
          obj['tanggal_berakhir_kontrak'] ||
          obj['contract_end_date'] ||
          obj['tgl_kontrak_berakhir'] ||
          obj['berakhir_kontrak'] ||
          '';
        const contractEndDate = rawContractEnd ? rawContractEnd.trim().slice(0, 10) : null;

        const nip = obj['emp. id'] || obj['nip'] || obj['no_karyawan'] || obj['employee_id'] || '';
        const name = obj['nama lengkap karyawan'] || obj['nama'] || obj['name'] || '';
        const email = obj['email'] || '';

        if (!nip || !name || !email) {
          continue;
        }

        items.push({
          nip,
          nik: obj['no. ktp'] || obj['nik'] || obj['ktp'] || null,
          name,
          email,
          phone: obj['no. hp'] || obj['telepon'] || obj['phone'] || obj['no_hp'] || null,
          department: obj['departemen'] || obj['department'] || obj['divisi'] || null,
          position: obj['posisi/jabatan'] || obj['jabatan'] || obj['position'] || null,
          baseSalary: netSalary,
          bankName: obj['bank payroll'] || obj['bank'] || obj['nama_bank'] || null,
          bankAccountNumber: obj['no. rekening'] || obj['rekening'] || obj['no_rekening'] || null,
          bankAccountName:
            obj['nama di rekening'] ||
            obj['nama_rekening'] ||
            obj['atas_nama'] ||
            name,
          contractEndDate,
        });
      }

      if (items.length === 0) {
        setImportError('Tidak ada data karyawan yang valid untuk diimpor. Pastikan kolom NIP, Nama, dan Email terisi.');
        setImportLoading(false);
        return;
      }

      const res = await apiFetch('/api/v1/ewa/employees/batch-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();

      if (data.success) {
        setImportSuccess(`Berhasil memproses ${data.data?.processedCount ?? items.length} karyawan!`);
        setTimeout(() => {
          setImportCsvText('');
          setImportSuccess('');
          onClose();
          onSuccess();
        }, 1500);
      } else {
        const errorMsg =
          data.message ||
          data.error ||
          (data.errors ? 'Validasi data gagal: periksa format email dan data baris' : 'Gagal mengimpor data karyawan');
        setImportError(errorMsg);
      }
    } catch (err: any) {
      console.error('Import CSV error:', err);
      setImportError(err?.message || 'Format CSV tidak valid atau terjadi kegagalan jaringan');
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import Data Karyawan (CSV)"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <Card style={{ width: 550, padding: 24, maxWidth: '90%' }}>
        <form onSubmit={handleImportCsv}>
          <VStack gap={4}>
            <Heading level={4}>Import Data Karyawan (CSV)</Heading>
            <Text type="supporting" color="secondary">
              Mendukung format ekspor HRIS / Wagely (<code>Nama Lengkap Karyawan, No. KTP, Emp. ID, Jumlah Gaji, dll.</code>) maupun format standar.
            </Text>

            {importError && (
              <Text type="supporting" style={{ color: 'var(--color-text-error)' }}>
                ⚠️ {importError}
              </Text>
            )}
            {importSuccess && (
              <Text type="supporting" style={{ color: 'var(--color-text-success)' }}>
                ✅ {importSuccess}
              </Text>
            )}

            <VStack gap={2}>
              <HStack gap={2} vAlign="center">
                <Text type="supporting" style={{ fontWeight: 500 }}>Pilih File CSV:</Text>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  style={{ fontSize: 13 }}
                />
              </HStack>
              <Text type="supporting" color="secondary">atau tempel isi teks CSV di bawah ini:</Text>
            </VStack>

            <textarea
              rows={8}
              required
              placeholder={`Nama Lengkap Karyawan,No. KTP,Emp. ID,Email,No. HP,Bank Payroll,No. Rekening,Nama di rekening,Posisi/Jabatan,Jumlah Gaji\nBudi Santoso,1271111310970003,0202169,budi@nusa.id,6282370071235,Bank Mandiri,1060015016754,Budi Santoso,Engineer,"3,219,069"`}
              value={importCsvText}
              onChange={(e) => setImportCsvText(e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                fontFamily: 'monospace',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid var(--color-border-primary)',
                backgroundColor: 'var(--color-background-primary)',
                color: 'var(--color-text-primary)',
                boxSizing: 'border-box',
              }}
            />

            <HStack justify="end" gap={2}>
              <Button
                label="Batal"
                variant="ghost"
                type="button"
                onClick={onClose}
              />
              <Button
                label={importLoading ? 'Mengimpor...' : 'Proses Import'}
                variant="primary"
                type="submit"
                isDisabled={importLoading}
              />
            </HStack>
          </VStack>
        </form>
      </Card>
    </div>
  );
}
