import { describe, it, expect } from 'bun:test';
import { detectMimeTypeFromBuffer, validateFileBufferWithExtension } from './fileValidation';

describe('fileValidation (Magic Bytes)', () => {
  it('detects valid PDF magic bytes', () => {
    const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]);
    expect(detectMimeTypeFromBuffer(pdfBuffer)).toBe('application/pdf');

    const res = validateFileBufferWithExtension(pdfBuffer, '.pdf');
    expect(res.valid).toBe(true);
    expect(res.detectedMime).toBe('application/pdf');
  });

  it('detects valid PNG magic bytes', () => {
    const pngBuffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(detectMimeTypeFromBuffer(pngBuffer)).toBe('image/png');

    const res = validateFileBufferWithExtension(pngBuffer, '.png');
    expect(res.valid).toBe(true);
  });

  it('detects valid JPEG magic bytes', () => {
    const jpegBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(detectMimeTypeFromBuffer(jpegBuffer)).toBe('image/jpeg');

    const res = validateFileBufferWithExtension(jpegBuffer, '.jpg');
    expect(res.valid).toBe(true);

    const res2 = validateFileBufferWithExtension(jpegBuffer, '.jpeg');
    expect(res2.valid).toBe(true);
  });

  it('rejects fake files where extension does not match content', () => {
    // Text file disguised as .pdf
    const textAsPdf = new TextEncoder().encode('Hello, this is just plain text content');
    const res = validateFileBufferWithExtension(textAsPdf, '.pdf');
    expect(res.valid).toBe(false);
    expect(res.error).toBeDefined();

    // JPEG disguised as .pdf
    const jpegAsPdf = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const res2 = validateFileBufferWithExtension(jpegAsPdf, '.pdf');
    expect(res2.valid).toBe(false);
    expect(res2.detectedMime).toBe('image/jpeg');
  });

  it('rejects unsupported extensions', () => {
    const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    const res = validateFileBufferWithExtension(pdfBuffer, '.exe');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('tidak didukung');
  });
});
