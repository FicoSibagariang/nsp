'use client';

import { useState, useCallback, useMemo } from 'react';
import { DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, VStack, HStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { DateInput } from '@astryxdesign/core/DateInput';
import { useToast } from '@astryxdesign/core/Toast';
import { useApiQuery } from '../hooks/useApiQuery';
import { api, ApiError } from '../services/api';
import type { LoanRow, LoanAttachmentItem } from '@shared/types';
import { useAuth } from '../hooks/useAuth';
import { LoanInfoSection } from './loan/LoanInfoSection';
import { LoanScheduleTable } from './loan/LoanScheduleTable';
import { LoanPaymentSection } from './loan/LoanPaymentSection';
import { CopyableAccountNumber } from './CopyableAccountNumber';
import { useDemoMode } from '../contexts/DemoModeContextDef';
import { maskName } from '../utils/privacyMask';
import { getAuthenticatedFileUrl } from '../utils/fileUrl';

interface Payment extends Record<string, unknown> {
  id: string;
  loanId: string;
  amount: number;
  paymentDate: string;
  method: string;
}

interface ScheduleRow {
  id: string;
  installmentNo: number;
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
  paidAmount: number;
  status: string;
}

function todayIsoDate(): string {
  return new Date().toISOString().split('T')[0];
}

function toIsoDateInput(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return todayIsoDate();
  return d.toISOString().split('T')[0];
}

function errMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.message) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function LoanDetailDialogContent({
  loan,
  onClose,
  onUpdate,
}: {
  loan: LoanRow;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const { isDemoMode } = useDemoMode();

  const displayName = isDemoMode ? maskName(loan.memberId || loan.id, loan.name) : loan.name;

  const [disbursementDate, setDisbursementDate] = useState(() =>
    toIsoDateInput(loan.approvedAt || loan.createdAt || todayIsoDate())
  );
  const [isEditingDisbursement, setIsEditingDisbursement] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isApproved =
    loan.status === 'Disetujui' || loan.status === 'Lunas' || loan.status === 'Macet';
  const canEditDisbursement = hasPermission('approve:loans') && isApproved;
  const canEditSchedule = hasPermission('approve:loans') && isApproved;
  const canManagePayments = hasPermission('create:payments');

  const { data: payments, isLoading: isLoadingPayments, refetch: refetchPayments } =
    useApiQuery<Payment[]>(`/api/loans/${loan.id}/payments`);

  const { data: schedule, isLoading: scheduleLoading, refetch: refetchSchedule } =
    useApiQuery<ScheduleRow[]>(`/api/loans/${loan.id}/schedule`);

  const { data: attachmentsData, refetch: refetchAttachments } =
    useApiQuery<LoanAttachmentItem[]>(`/api/loans/${loan.id}/attachments`);

  const attachmentsList: LoanAttachmentItem[] = useMemo(() => {
    if (attachmentsData && attachmentsData.length > 0) return attachmentsData;
    if (loan.attachmentUrl) {
      return [
        {
          id: `legacy-${loan.id}`,
          loanId: loan.id,
          fileName: loan.attachmentName || 'Dokumen Lampiran Pinjaman',
          fileUrl: loan.attachmentUrl,
          fileSize: null,
          isSupplemental: false,
          uploadedBy: loan.memberId,
          createdAt: loan.createdAt || new Date().toISOString(),
        },
      ];
    }
    return [];
  }, [attachmentsData, loan]);

  const initialDocs = useMemo(
    () => attachmentsList.filter((a) => !a.isSupplemental),
    [attachmentsList]
  );
  const supplementalDocs = useMemo(
    () => attachmentsList.filter((a) => a.isSupplemental),
    [attachmentsList]
  );

  const refreshAll = useCallback(() => {
    refetchPayments();
    refetchSchedule();
    refetchAttachments();
    onUpdate();
  }, [refetchPayments, refetchSchedule, refetchAttachments, onUpdate]);

  const handleSaveDisbursementDate = async () => {
    if (!disbursementDate) return;
    setIsSubmitting(true);
    try {
      await api.put(`/api/loans/${loan.id}/disbursement-date`, { disbursementDate });
      toast({ body: 'Tanggal pencairan diperbarui', type: 'info' });
      setIsEditingDisbursement(false);
      refreshAll();
    } catch (err) {
      toast({ body: errMessage(err, 'Gagal mengubah tanggal pencairan'), type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Derived financial figures
  const tenorBulan = Number(loan.tenor) || 1;
  const pokok = Number(loan.amount);
  const biayaAdmin = Number(loan.interestAmount || 0);
  const totalHutang = Number(loan.totalAmount || pokok + biayaAdmin);
  const angsuranPerBulan = Math.ceil(totalHutang / tenorBulan);
  const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
  const remainingDebt = totalHutang - totalPaid;
  const displayDisbursementDate = loan.approvedAt || loan.createdAt;

  return (
    <Layout
      header={
        <DialogHeader
          title={`Detail Pinjaman: ${displayName}`}
          subtitle={`Tenor: ${loan.tenor} Bulan`}
          onOpenChange={() => onClose()}
        />
      }
      content={
        <LayoutContent padding={4}>
          <VStack gap={6}>
            {/* Rejection notice */}
            {loan.status === 'Ditolak' && (loan.rejectionReason || (loan as any).rejection_reason) && (
              <VStack
                gap={1}
                style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--color-critical-200)',
                  backgroundColor: 'var(--color-critical-50)',
                }}
              >
                <Text type="body" weight="semibold" style={{ color: 'var(--color-text-error)' }}>
                  Pengajuan Pinjaman Ditolak
                </Text>
                <Text type="supporting" style={{ color: 'var(--color-text-error)' }}>
                  Alasan: {loan.rejectionReason || (loan as any).rejection_reason}
                </Text>
              </VStack>
            )}

            {/* Summary cards */}
            <LoanInfoSection
              pokok={pokok}
              biayaAdmin={biayaAdmin}
              totalHutang={totalHutang}
              remainingDebt={remainingDebt}
            />

            {/* Destination Bank Account */}
            {(loan.destinationBank || loan.destinationAccount) && (
              <VStack
                gap={1}
                style={{
                  padding: 'var(--spacing-3) var(--spacing-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-primary)',
                  backgroundColor: 'var(--color-background-secondary)',
                }}
              >
                <Text type="supporting" color="secondary" size="sm">
                  Rekening Tujuan Transfer:
                </Text>
                <CopyableAccountNumber
                  bankName={loan.destinationBank}
                  accountNumber={loan.destinationAccount}
                  accountHolder={loan.destinationName || loan.name}
                />
              </VStack>
            )}

            {/* Attachment section */}
            {attachmentsList.length > 0 && (
              <VStack
                gap={3}
                style={{
                  padding: 'var(--spacing-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-primary)',
                  backgroundColor: 'var(--color-background-secondary)',
                }}
              >
                <HStack hAlign="between" vAlign="center" style={{ width: '100%' }}>
                  <VStack gap={0}>
                    <Text type="body" weight="bold">
                      Dokumen Lampiran Pengajuan ({attachmentsList.length})
                    </Text>
                    <Text type="supporting" color="secondary" size="sm">
                      Berkas persyaratan dan dokumen pendukung yang diunggah anggota
                    </Text>
                  </VStack>
                </HStack>

                {/* Dokumen Utama / Awal */}
                {initialDocs.length > 0 && (
                  <VStack gap={2}>
                    <Text weight="bold" size="sm" color="secondary">
                      Dokumen Utama / Awal ({initialDocs.length})
                    </Text>
                    {initialDocs.map((doc) => (
                      <HStack
                        key={doc.id}
                        hAlign="between"
                        vAlign="center"
                        wrap="wrap"
                        gap={2}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--color-background-primary)',
                          border: '1px solid var(--color-border-primary)',
                          width: '100%',
                        }}
                      >
                        <HStack vAlign="center" gap={2}>
                          <span style={{ fontSize: '20px' }}>
                            {doc.fileName.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}
                          </span>
                          <VStack gap={0}>
                            <Text type="body" weight="semibold">{doc.fileName}</Text>
                            <Text type="supporting" size="sm" color="secondary">
                              {doc.fileSize ? `${(doc.fileSize / (1024 * 1024)).toFixed(2)} MB • ` : ''}
                              Dokumen Utama
                            </Text>
                          </VStack>
                        </HStack>
                        <Button
                          label="Buka / Unduh"
                          variant="secondary"
                          size="sm"
                          onClick={() => window.open(getAuthenticatedFileUrl(doc.fileUrl), '_blank')}
                        />
                      </HStack>
                    ))}
                  </VStack>
                )}

                {/* Dokumen Susulan / Tambahan */}
                {supplementalDocs.length > 0 && (
                  <VStack gap={2}>
                    <Text weight="bold" size="sm" color="secondary">
                      Dokumen Susulan / Tambahan ({supplementalDocs.length})
                    </Text>
                    {supplementalDocs.map((doc) => (
                      <HStack
                        key={doc.id}
                        hAlign="between"
                        vAlign="center"
                        wrap="wrap"
                        gap={2}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--color-background-primary)',
                          border: '1px solid var(--color-border-primary)',
                          width: '100%',
                        }}
                      >
                        <HStack vAlign="center" gap={2}>
                          <span style={{ fontSize: '20px' }}>
                            {doc.fileName.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}
                          </span>
                          <VStack gap={0}>
                            <Text type="body" weight="semibold">{doc.fileName}</Text>
                            <Text type="supporting" size="sm" color="secondary">
                              {doc.fileSize ? `${(doc.fileSize / (1024 * 1024)).toFixed(2)} MB • ` : ''}
                              Diunggah: {new Date(doc.createdAt).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>
                          </VStack>
                        </HStack>
                        <Button
                          label="Buka / Unduh"
                          variant="secondary"
                          size="sm"
                          onClick={() => window.open(getAuthenticatedFileUrl(doc.fileUrl), '_blank')}
                        />
                      </HStack>
                    ))}
                  </VStack>
                )}
              </VStack>
            )}

            {/* Disbursement date */}
            {isApproved && (
              <VStack
                gap={3}
                style={{
                  padding: 'var(--spacing-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-primary)',
                  backgroundColor: 'var(--color-background-secondary)',
                }}
              >
                <HStack hAlign="between" vAlign="center" style={{ width: '100%' }}>
                  <VStack gap={1}>
                    <Text type="body" weight="bold">Tanggal Pencairan</Text>
                    <Text type="supporting" color="secondary">
                      Dipakai di Arus Kas &amp; Transaksi Pinjaman (baris pencairan)
                    </Text>
                  </VStack>
                  {canEditDisbursement && !isEditingDisbursement && (
                    <Button
                      label="Ubah Tanggal"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setDisbursementDate(
                          toIsoDateInput(loan.approvedAt || loan.createdAt || todayIsoDate())
                        );
                        setIsEditingDisbursement(true);
                      }}
                    />
                  )}
                </HStack>

                {!isEditingDisbursement ? (
                  <Text type="body" weight="semibold">
                    {displayDisbursementDate
                      ? new Date(displayDisbursementDate).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })
                      : '—'}
                  </Text>
                ) : (
                  <VStack gap={3}>
                    <DateInput
                      label="Tanggal Pencairan"
                      description="Bisa diisi mundur untuk data historis"
                      value={disbursementDate as any}
                      onChange={(val) => setDisbursementDate((val ?? todayIsoDate()) as any)}
                      max={todayIsoDate() as any}
                      isRequired
                    />
                    <HStack gap={2} hAlign="end">
                      <Button
                        label="Batal"
                        variant="secondary"
                        onClick={() => setIsEditingDisbursement(false)}
                        isDisabled={isSubmitting}
                      />
                      <Button
                        label="Simpan Tanggal"
                        variant="primary"
                        onClick={handleSaveDisbursementDate}
                        isDisabled={isSubmitting || !disbursementDate}
                      />
                    </HStack>
                  </VStack>
                )}
              </VStack>
            )}

            {/* Schedule */}
            {isApproved && (
              <LoanScheduleTable
                loanId={loan.id}
                pokok={pokok}
                interestRate={loan.interestRate}
                schedule={schedule ?? undefined}
                scheduleLoading={scheduleLoading}
                canEditSchedule={canEditSchedule}
                isSubmitting={isSubmitting}
                onSaved={refreshAll}
              />
            )}

            {/* Payments */}
            <LoanPaymentSection
              loanId={loan.id}
              totalHutang={totalHutang}
              angsuranPerBulan={angsuranPerBulan}
              payments={payments ?? undefined}
              isLoadingPayments={isLoadingPayments}
              canManagePayments={canManagePayments}
              onSaved={refreshAll}
            />
          </VStack>
        </LayoutContent>
      }
    />
  );
}
