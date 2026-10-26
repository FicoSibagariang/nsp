/**
 * Deterministic Pseudonymization Utility for Demo / Privacy Mode
 * Resolves consistent fictive identities based on UUID / unique entity key.
 */

export const FIRST_NAMES = [
  'Aditya', 'Agus', 'Ahmad', 'Andi', 'Annisa', 'Arif', 'Bagus', 'Bambang', 'Bayu', 'Budi',
  'Cahyo', 'Citra', 'Dedi', 'Dewi', 'Dian', 'Dimas', 'Dwi', 'Eko', 'Fajar', 'Farhan',
  'Fitri', 'Gita', 'Gunawan', 'Hadi', 'Hendra', 'Indah', 'Indra', 'Joko', 'Kartika', 'Lestari',
  'Maya', 'Mega', 'Muhammad', 'Nadia', 'Nur', 'Putri', 'Raden', 'Rahmat', 'Ratna', 'Reza',
  'Rian', 'Rina', 'Rizky', 'Siti', 'Sri', 'Surya', 'Tri', 'Wahyu', 'Wawan', 'Yanto'
];

export const LAST_NAMES = [
  'Anggoro', 'Ansori', 'Arifin', 'Astuti', 'Basuki', 'Budiman', 'Cahyono', 'Darmawan', 'Gunawan', 'Hakim',
  'Haryanto', 'Hidayat', 'Irawan', 'Kusuma', 'Kurniawan', 'Lestari', 'Mahardika', 'Mahendra', 'Maulana', 'Nugroho',
  'Oktaviani', 'Pamungkas', 'Permana', 'Prabowo', 'Pratama', 'Prasetyo', 'Purnomo', 'Purwanto', 'Raharjo', 'Ramadhan',
  'Santoso', 'Saputra', 'Sari', 'Setiawan', 'Siregar', 'Subagyo', 'Sudrajat', 'Sukardi', 'Supriyanto', 'Suryono',
  'Susanto', 'Sutejo', 'Utomo', 'Wibowo', 'Wicaksono', 'Widodo', 'Wijaya', 'Wulandari', 'Yulianto', 'Zulkarnain'
];

export function hashString(str: string): number {
  if (!str) return 0;
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export interface MaskedIdentity {
  name: string;
  email: string;
  nip: string;
  nik: string;
  accountNumber: string;
}

export function getMaskedIdentity(idOrKey: string): MaskedIdentity {
  const seed = idOrKey || 'default-seed-identifier';
  const h = hashString(seed);

  const firstIdx = h % FIRST_NAMES.length;
  const lastIdx = Math.floor(h / FIRST_NAMES.length) % LAST_NAMES.length;

  const firstName = FIRST_NAMES[firstIdx];
  const lastName = LAST_NAMES[lastIdx];
  const name = `${firstName} ${lastName}`;

  const cleanFirst = firstName.toLowerCase();
  const cleanLast = lastName.toLowerCase();
  const email = `${cleanFirst}.${cleanLast}@demo.mail`;

  const nipNumber = 1000 + (h % 9000);
  const nip = `EMP-${nipNumber}`;

  const nikMiddle = String(100000 + (h % 900000));
  const nikEnd = String(1000 + (Math.floor(h / 7) % 9000));
  const nik = `320101${nikMiddle}${nikEnd}`;

  const accountSuffix = String(10000000 + (h % 90000000));
  const accountNumber = `10600${accountSuffix}`;

  return {
    name,
    email,
    nip,
    nik,
    accountNumber,
  };
}

export function maskName(idOrKey?: string | null, original?: string | null, isDemo: boolean = true): string {
  if (!isDemo) return original || '';
  if (!idOrKey && !original) return '';
  return getMaskedIdentity(String(idOrKey || original)).name;
}

export function maskEmail(idOrKey?: string | null, original?: string | null, isDemo: boolean = true): string {
  if (!isDemo) return original || '';
  if (!idOrKey && !original) return '';
  return getMaskedIdentity(String(idOrKey || original)).email;
}

export function maskNip(idOrKey?: string | null, original?: string | null, isDemo: boolean = true): string {
  if (!isDemo) return original || '';
  if (!idOrKey && !original) return '';
  return getMaskedIdentity(String(idOrKey || original)).nip;
}

export function maskNik(idOrKey?: string | null, original?: string | null, isDemo: boolean = true): string {
  if (!isDemo) return original || '';
  if (!idOrKey && !original) return '';
  return getMaskedIdentity(String(idOrKey || original)).nik;
}

export function maskAccountNumber(idOrKey?: string | null, original?: string | null, isDemo: boolean = true): string {
  if (!isDemo) return original || '';
  if (!idOrKey && !original) return '';
  return getMaskedIdentity(String(idOrKey || original)).accountNumber;
}
