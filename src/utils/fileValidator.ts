import * as XLSX from 'xlsx';

export const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls'] as const;

export const BLOCKED_EXTENSION_EXAMPLES = new Set([
  'pdf', 'doc', 'docx', 'txt', 'rtf', 'ppt', 'pptx',
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico',
  'zip', 'rar', '7z', 'tar', 'gz',
  'xml', 'html', 'htm', 'json', 'yaml', 'yml',
  'mp3', 'mp4', 'wav', 'avi', 'mov', 'mkv',
  'exe', 'dll', 'bin', 'sh', 'bat', 'msi',
  'py', 'js', 'ts', 'tsx', 'jsx', 'java', 'cpp', 'c', 'php', 'sql',
]);

export interface FileValidationResult {
  ok: boolean;
  format?: 'CSV' | 'XLSX' | 'XLS';
  csvContent?: string;
  sheetName?: string;
  rowCount?: number;
  byteSize?: number;
  errorCode?: 'UNSUPPORTED_EXTENSION' | 'FILE_TOO_LARGE' | 'EMPTY_FILE' | 'SIGNATURE_MISMATCH' | 'CORRUPTED_FILE';
  reason?: string;
}

function getExtension(filename: string): string {
  const clean = filename.trim().toLowerCase();
  const dotIdx = clean.lastIndexOf('.');
  if (dotIdx === -1) return '';
  return clean.slice(dotIdx);
}

function startsWithBytes(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[i] !== prefix[i]) return false;
  }
  return true;
}

function containsAscii(bytes: Uint8Array, token: string): boolean {
  const len = token.length;
  for (let i = 0; i <= bytes.length - len; i++) {
    let match = true;
    for (let j = 0; j < len; j++) {
      if (bytes[i + j] !== token.charCodeAt(j)) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

function hasKnownBinarySignature(bytes: Uint8Array): string | null {
  // %PDF-
  if (startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'PDF document';
  // PNG
  if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'PNG image';
  // JPEG
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) return 'JPEG image';
  // GIF8
  if (startsWithBytes(bytes, [0x47, 0x49, 0x46, 0x38])) return 'GIF image';
  // ZIP / OOXML (PK\x03\x04)
  if (startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04])) return 'ZIP / Office Open XML archive';
  // OLE2 (DOC/XLS/PPT)
  if (startsWithBytes(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'OLE2 binary container';
  // RAR
  if (startsWithBytes(bytes, [0x52, 0x61, 0x72, 0x21])) return 'RAR archive';
  // 7z
  if (startsWithBytes(bytes, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return '7-Zip archive';
  // GZIP
  if (startsWithBytes(bytes, [0x1f, 0x8b])) return 'GZIP archive';
  // Windows PE / EXE (MZ)
  if (startsWithBytes(bytes, [0x4d, 0x5a])) return 'Executable binary';
  // ELF binary
  if (startsWithBytes(bytes, [0x7f, 0x45, 0x4c, 0x46])) return 'ELF binary';
  // MP3 ID3
  if (startsWithBytes(bytes, [0x49, 0x44, 0x33])) return 'MP3 audio';
  // Null byte check in first 4096 bytes
  const limit = Math.min(bytes.length, 4096);
  for (let i = 0; i < limit; i++) {
    if (bytes[i] === 0x00) return 'Binary null-byte stream';
  }
  return null;
}

export function validateCSVTextStructure(text: string): { ok: boolean; reason?: string } {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return { ok: false, reason: 'CSV content is empty.' };
  }

  const lowerStart = trimmed.slice(0, 512).toLowerCase();
  if (
    lowerStart.startsWith('<!doctype') ||
    lowerStart.startsWith('<html') ||
    lowerStart.startsWith('<?xml') ||
    lowerStart.startsWith('<svg')
  ) {
    return { ok: false, reason: 'HTML/XML markup is not a valid CSV file.' };
  }

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed);
      return { ok: false, reason: 'JSON payload is not a valid CSV file.' };
    } catch {
      // Not valid JSON; continue
    }
  }

  // Block obvious source code disguised as .csv
  if (/^(import\s+\w+|from\s+\w+\s+import|def\s+\w+\(|function\s+\w+\(|const\s+\w+\s*=|class\s+\w+)/.test(trimmed)) {
    return { ok: false, reason: 'Source script content is not a valid CSV file.' };
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { ok: false, reason: 'No tabular lines found.' };
  }

  // Header line must contain comma-separated columns (or at least 1 valid header token)
  const firstLine = lines[0];
  if (!firstLine.includes(',') && lines.length === 1) {
    return { ok: false, reason: 'Unstructured plain text without CSV delimiters.' };
  }

  return { ok: true };
}

export function validateAndExtractTabularFile(
  filename: string,
  buffer: ArrayBuffer | Uint8Array,
  maxUploadMb: number = 10
): FileValidationResult {
  const ext = getExtension(filename);
  const extBare = ext.startsWith('.') ? ext.slice(1) : ext;
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  if (!ext || (!ALLOWED_EXTENSIONS.includes(ext as any) && BLOCKED_EXTENSION_EXAMPLES.has(extBare))) {
    return {
      ok: false,
      errorCode: 'UNSUPPORTED_EXTENSION',
      reason: `Extension '${ext || 'none'}' is not allowed. Only .csv, .xlsx, and .xls files are permitted.`,
    };
  }

  if (!ALLOWED_EXTENSIONS.includes(ext as any)) {
    return {
      ok: false,
      errorCode: 'UNSUPPORTED_EXTENSION',
      reason: `Extension '${ext}' is not supported.`,
    };
  }

  if (bytes.byteLength === 0) {
    return {
      ok: false,
      errorCode: 'EMPTY_FILE',
      reason: 'Uploaded file is empty (0 bytes).',
    };
  }

  const maxBytes = maxUploadMb * 1024 * 1024;
  if (bytes.byteLength > maxBytes) {
    return {
      ok: false,
      errorCode: 'FILE_TOO_LARGE',
      reason: `File exceeds the configured ${maxUploadMb} MB limit.`,
    };
  }

  if (ext === '.csv') {
    const binaryMatch = hasKnownBinarySignature(bytes);
    if (binaryMatch) {
      return {
        ok: false,
        errorCode: 'SIGNATURE_MISMATCH',
        reason: `File claims to be .csv but contains a ${binaryMatch} signature.`,
      };
    }

    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const csvCheck = validateCSVTextStructure(text);
    if (!csvCheck.ok) {
      return {
        ok: false,
        errorCode: 'SIGNATURE_MISMATCH',
        reason: csvCheck.reason,
      };
    }

    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
    return {
      ok: true,
      format: 'CSV',
      csvContent: text.replace(/^\uFEFF/, ''),
      rowCount: Math.max(0, lines.length - 1),
      byteSize: bytes.byteLength,
    };
  }

  if (ext === '.xlsx') {
    // Must have PK\x03\x04 ZIP header
    if (!startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04])) {
      return {
        ok: false,
        errorCode: 'SIGNATURE_MISMATCH',
        reason: 'File does not match OOXML (.xlsx) ZIP container signature.',
      };
    }
    // Reject disguised .docx / .pptx / arbitrary .zip archives
    if (!containsAscii(bytes, 'xl/') || containsAscii(bytes, 'word/document.xml') || containsAscii(bytes, 'ppt/presentation.xml')) {
      return {
        ok: false,
        errorCode: 'SIGNATURE_MISMATCH',
        reason: 'Archive is not a valid Excel (.xlsx) workbook.',
      };
    }

    try {
      const wb = XLSX.read(bytes, { type: 'array', raw: false });
      if (!wb.SheetNames || wb.SheetNames.length === 0) {
        return {
          ok: false,
          errorCode: 'CORRUPTED_FILE',
          reason: 'Excel workbook contains no worksheets.',
        };
      }
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const csvContent = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length === 0) {
        return {
          ok: false,
          errorCode: 'CORRUPTED_FILE',
          reason: 'Active worksheet contains no tabular data.',
        };
      }
      return {
        ok: true,
        format: 'XLSX',
        csvContent,
        sheetName,
        rowCount: Math.max(0, lines.length - 1),
        byteSize: bytes.byteLength,
      };
    } catch {
      return {
        ok: false,
        errorCode: 'CORRUPTED_FILE',
        reason: 'Corrupted or unreadable .xlsx workbook.',
      };
    }
  }

  // .xls (Excel 97-2003 OLE2 Binary)
  if (!startsWithBytes(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return {
      ok: false,
      errorCode: 'SIGNATURE_MISMATCH',
      reason: 'File does not match Excel 97-2003 (.xls) OLE2 signature.',
    };
  }

  try {
    const wb = XLSX.read(bytes, { type: 'array', raw: false });
    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      return {
        ok: false,
        errorCode: 'CORRUPTED_FILE',
        reason: 'Legacy Excel (.xls) workbook contains no worksheets.',
      };
    }
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const csvContent = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      return {
        ok: false,
        errorCode: 'CORRUPTED_FILE',
        reason: 'Legacy Excel worksheet contains no tabular data.',
      };
    }
    return {
      ok: true,
      format: 'XLS',
      csvContent,
      sheetName,
      rowCount: Math.max(0, lines.length - 1),
      byteSize: bytes.byteLength,
    };
  } catch {
    return {
      ok: false,
      errorCode: 'CORRUPTED_FILE',
      reason: 'Corrupted or unreadable .xls workbook.',
    };
  }
}
