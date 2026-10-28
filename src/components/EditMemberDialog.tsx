'use client';

import {useState, useEffect} from 'react';
import {DialogHeader} from '@astryxdesign/core/Dialog';
import {
  Layout,
  LayoutContent,
  LayoutFooter,
  HStack,
  VStack,
} from '@astryxdesign/core/Layout';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Text} from '@astryxdesign/core/Text';
import type {MemberRow} from '@shared/types';
import {useDemoMode} from '../contexts/DemoModeContext';
import {maskName, maskNik, hashString} from '../utils/privacyMask';

export function EditMemberDialogContent({
  onClose,
  onEdit,
  initialData,
}: {
  onClose: () => void;
  onEdit: (m: MemberRow) => void;
  initialData: MemberRow;
}) {
  const { isDemoMode } = useDemoMode();

  const getInitialName = () => (isDemoMode ? maskName(initialData.id, initialData.name) : initialData.name);
  const getInitialNik = () => (isDemoMode ? maskNik(initialData.id, initialData.nik) : (initialData.nik || ''));
  const getInitialPhone = () => {
    if (!initialData.phone) return '';
    return isDemoMode ? `0812${String(10000000 + (hashString(initialData.id) % 90000000))}` : initialData.phone;
  };

  const [name, setName] = useState(getInitialName);
  const [nik, setNik] = useState(getInitialNik);
  const [phone, setPhone] = useState(getInitialPhone);
  const [role, setRole] = useState(initialData.role);
  const [status, setStatus] = useState(initialData.status);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setName(getInitialName());
    setNik(getInitialNik());
    setPhone(getInitialPhone());
    setRole(initialData.role);
    setStatus(initialData.status);
    setLocalError('');
  }, [initialData, isDemoMode]);

  const handleSave = () => {
    setLocalError('');
    const nikDigits = nik.replace(/\D/g, '');
    if (nikDigits && nikDigits.length !== 16) {
      setLocalError('NIK harus 16 digit angka (atau kosongkan).');
      return;
    }
    const phoneTrim = phone.trim();
    const phoneHasPlus = phoneTrim.startsWith('+');
    const phoneDigits = phoneTrim.replace(/\D/g, '');
    const phoneNorm = !phoneDigits ? '' : phoneHasPlus ? `+${phoneDigits}` : phoneDigits;
    if (phoneNorm) {
      const n = phoneNorm.replace(/\D/g, '').length;
      if (n < 8 || n > 15) {
        setLocalError('Nomor telepon harus 8–15 digit (atau kosongkan).');
        return;
      }
    }
    if (!name.trim()) {
      setLocalError('Nama wajib diisi.');
      return;
    }
    onEdit({
      ...initialData,
      name: name.trim(),
      nik: nikDigits || null,
      phone: phoneNorm || null,
      role,
      status,
      simpananPokok: initialData.simpananPokok,
      simpananWajib: initialData.simpananWajib,
      simpananSukarela: initialData.simpananSukarela,
    });
    onClose();
  };

  return (
    <Layout
      header={
        <DialogHeader
          title="Edit Anggota"
          subtitle={`Ubah data untuk ${getInitialName()}`}
          onOpenChange={() => onClose()}
        />
      }
      content={
        <LayoutContent padding={4}>
          <VStack gap={4}>
            <TextInput
              label="Nama Lengkap"
              value={name}
              onChange={setName}
              placeholder="Contoh: Budi Santoso"
            />
            <TextInput
              label="NIK"
              value={nik}
              onChange={(raw) => setNik(raw.replace(/\D/g, '').slice(0, 16))}
              placeholder="16 digit NIK (opsional)"
              description="Nomor Induk Kependudukan — unik per anggota"
              type="text"
            />
            <TextInput
              label="Nomor Telepon"
              value={phone}
              onChange={(raw) => {
                let s = raw.replace(/[^\d+]/g, '');
                if (s.includes('+')) {
                  s = '+' + s.replace(/\+/g, '').replace(/\D/g, '');
                } else {
                  s = s.replace(/\D/g, '');
                }
                setPhone(s.slice(0, 16));
              }}
              placeholder="Contoh: 081234567890"
              description="Opsional — 8–15 digit, boleh diawali +"
              type="text"
            />
            <VStack gap={1}>
              <Text type="supporting">Jabatan</Text>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md, 6px)',
                  border: '1px solid var(--color-border-primary)',
                  backgroundColor: 'var(--color-background-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              >
                <option value="Anggota">Anggota</option>
                <option value="Ketua">Ketua</option>
                <option value="Sekretaris">Sekretaris</option>
                <option value="Bendahara">Bendahara</option>
              </select>
            </VStack>
            <VStack gap={1}>
              <Text type="supporting">Status</Text>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md, 6px)',
                  border: '1px solid var(--color-border-primary)',
                  backgroundColor: 'var(--color-background-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              >
                <option value="Aktif">Aktif</option>
                <option value="Pasif">Pasif</option>
              </select>
            </VStack>
            {localError ? (
              <Text type="supporting" style={{ color: 'var(--color-text-error)' }}>
                {localError}
              </Text>
            ) : null}
          </VStack>
        </LayoutContent>
      }
      footer={
        <LayoutFooter>
          <HStack gap={2} hAlign="end">
            <Button label="Batal" variant="secondary" onClick={onClose} />
            <Button label="Simpan Perubahan" variant="primary" onClick={handleSave} isDisabled={!name} />
          </HStack>
        </LayoutFooter>
      }
    />
  );
}
