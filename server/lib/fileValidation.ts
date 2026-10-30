/**
 * Magic Bytes & File Validation Utilities
 * Validates actual binary signatures against file extensions to prevent malicious upload masquerading.
 */

export interface MagicBytesCheckResult {
  valid: boolean;
  detectedMime: string | null;
  error?: string;
}

/**
 * Detects the MIME type of a binary buffer by inspecting its magic bytes (file signature).
 * Supports PDF, PNG, JPEG, WebP, and HEIC.
 */
export function detectMimeTypeFromBuffer(buffer: ArrayBuffer | Uint8Array): string | null {
  const bytes = new Uint8Array(buffer instanceof ArrayBuffer ? buffer : buffer.buffer);
  if (bytes.length < 4) return null;

  // PDF: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return 'application/pdf';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // WebP: 'RIFF'....'WEBP'
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  // HEIC: '....ftypheic' or '....ftypmif1'
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    return 'image/heic';
  }

  return null;
}

const EXT_TO_MIME: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.webp': ['image/webp'],
  '.heic': ['image/heic'],
};

/**
 * Validates that the file buffer matches the declared file extension via magic bytes verification.
 */
export function validateFileBufferWithExtension(
  buffer: ArrayBuffer | Uint8Array,
  extension: string
): MagicBytesCheckResult {
  const normalizedExt = extension.toLowerCase();
  const allowedMimes = EXT_TO_MIME[normalizedExt];

  if (!allowedMimes) {
    return {
      valid: false,
      detectedMime: null,
      error: `Ekstensi '${extension}' tidak didukung`,
    };
  }

  const detectedMime = detectMimeTypeFromBuffer(buffer);

  if (!detectedMime) {
    return {
      valid: false,
      detectedMime: null,
      error: 'Berkas tidak memiliki tanda tangan biner (magic bytes) yang valid',
    };
  }

  if (!allowedMimes.includes(detectedMime)) {
    return {
      valid: false,
      detectedMime,
      error: `Format biner dokumen (${detectedMime}) tidak cocok dengan ekstensi berkas (${normalizedExt})`,
    };
  }

  return {
    valid: true,
    detectedMime,
  };
}
