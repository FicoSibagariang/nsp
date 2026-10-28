import React, { useState } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { formatRp } from '../../../utils/format';
import { maskName } from '../../../utils/privacyMask';
import { apiFetch } from '../../../config';
import type { EWARequest } from '../types';

interface RejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: EWARequest | null;
  isDemoMode: boolean;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function RejectModal({
  isOpen,
  onClose,
  request,
  isDemoMode,
  onSuccess,
  onError,
}: RejectModalProps) {
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !request) return null;

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch(`/api/v1/ewa/requests/${request.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await res.json();

      if (data.success) {
        onSuccess('Permohonan EWA telah ditolak');
        setRejectReason('');
        onClose();
      } else {
        onError(data.message || 'Gagal menolak EWA');
      }
    } catch (err: any) {
      onError(err?.message || 'Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tolak Pengajuan Pencairan EWA"
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
      <Card style={{ width: 450, padding: 24, maxWidth: '90%' }}>
        <form onSubmit={handleReject}>
          <VStack gap={4}>
            <Heading level={4}>Tolak Permohonan EWA</Heading>
            <Text type="supporting">
              Karyawan: <b>{isDemoMode ? maskName(request.employeeId || request.id, request.employeeName) : request.employeeName}</b> (Nominal: {formatRp(request.disbursedAmount)})
            </Text>
            <VStack gap={2}>
              <Text type="supporting">Alasan Penolakan:</Text>
              <textarea
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Melebihi batas hari kerja / dalam masa pengunduran diri"
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 6,
                  border: '1px solid var(--color-border-primary)',
                  backgroundColor: 'var(--color-background-primary)',
                  color: 'var(--color-text-primary)',
                  boxSizing: 'border-box',
                }}
              />
            </VStack>
            <HStack justify="end" gap={2}>
              <Button
                label="Batal"
                variant="ghost"
                type="button"
                onClick={() => {
                  setRejectReason('');
                  onClose();
                }}
              />
              <Button
                label={loading ? 'Menolak...' : 'Konfirmasi Tolak'}
                variant="destructive"
                type="submit"
                isDisabled={loading}
              />
            </HStack>
          </VStack>
        </form>
      </Card>
    </div>
  );
}
