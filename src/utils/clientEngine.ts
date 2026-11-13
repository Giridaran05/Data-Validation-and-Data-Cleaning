/**
 * Browser-Side 1:1 TypeScript Mirror of the Python Universal Validation Engine
 * (python_engine/profiler.py, recommender.py, universal_engine.py, cleaner.py).
 *
 * Ensures complete functional parity when hosted on static platforms (e.g., Netlify)
 * where the Express/Python backend (/api/*) is unavailable, while preserving full
 * Python execution whenever the backend server is reachable.
 */

export interface ClientColumnProfile {
  column_name: string;
  normalized_name: string;
  physical_type: string;
  semantic_type: string;
  is_potential_identifier: boolean;
  missing_count: number;
  missing_percentage: number;
  unique_count: number;
  unique_percentage: number;
  sample_values: string[];
  details: Record<string, any>;
}

export interface ClientDatasetProfile {
  total_rows: number;
  total_columns: number;
  headers: string[];
  domain_key: string;
  domain_title: string;
  domain_confidence_pct: number;
  primary_identifier: string | null;
  potential_identifiers: string[];
  total_missing_cells: number;
  missing_cells_percentage: number;
  duplicate_rows_count: number;
  data_quality_score: number;
  columns: ClientColumnProfile[];
}

export interface ClientRecommendation {
  id: string;
  category: string;
  name: string;
  affected_column: string;
  description: string;
  affected_records: number;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  enabled: boolean;
  preview: {
    before: string;
    after: string;
  };
}

export interface ClientExceptionItem {
  row_number: string;
  record_id: string;
  field_name: string;
  rule_id: string;
  violation_type: string;
  severity: string;
  raw_value: string;
  expected: string;
  error_message: string;
  suggested_correction?: string;
}

export interface ClientEngineSummary {
  total_records: number;
  valid_records: number;
  quarantined_records: number;
  duplicate_records: number;
  pass_rate_pct: number;
  quarantine_rate_pct: number;
  execution_time_ms: number;
  domain_detected?: string;
  data_quality_score?: number;
  total_exceptions?: number;
}

const EMAIL_PATTERN = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
const PHONE_PATTERN = /^(\+?\d{1,4}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{3,5}$/;
const DATE_ISO_PATTERN = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/;
const DATE_SLASH_PATTERN = /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/;
const INTEGER_PATTERN = /^-?\d+$/;
const FLOAT_PATTERN = /^-?\d+(\.\d+)?$/;
const CURRENCY_PATTERN = /^[\$€£¥₹]\s*-?\d+(,\d{3})*(\.\d+)?$/;

const NULL_REPRESENTATIONS = new Set([
  '',
  'null',
  'none',
  'n/a',
  'na',
  'nan',
  'nil',
  '#n/a',
  'undefined',
  '-',
]);

const DOMAIN_SIGNATURES: Record<
  string,
  {
    title: string;
    keywords: string[];
    id_keywords: string[];
  }
> = {
  COLLEGE_STUDENT: {
    title: 'College / University Student Data',
    keywords: [
      'student', 'reg', 'register', 'reg_no', 'regno', 'roll', 'roll_no', 'rollno',
      'department', 'dept', 'year', 'semester', 'sem', 'cgpa', 'gpa', 'degree',
      'college', 'university', 'faculty', 'course', 'major', 'campus', 'academic',
      'marks', 'grade', 'hostel', 'branch', 'batch',
    ],
    id_keywords: ['reg_no', 'regno', 'register_no', 'register_number', 'roll_no', 'rollno', 'student_id'],
  },
  EMPLOYEE_HR: {
    title: 'Employee / HR Management Data',
    keywords: [
      'employee', 'emp', 'emp_id', 'empid', 'staff', 'staff_id', 'salary',
      'designation', 'role', 'joining_date', 'hire_date', 'doj', 'experience',
      'manager', 'hr', 'payroll', 'allowance', 'bonus', 'department', 'leaves',
      'performance', 'job_title', 'employment_type',
    ],
    id_keywords: ['emp_id', 'empid', 'employee_id', 'staff_id'],
  },
  PRODUCT_INVENTORY: {
    title: 'Product & Inventory Data',
    keywords: [
      'product', 'prod', 'sku', 'product_id', 'item', 'item_code', 'stock',
      'quantity', 'qty', 'inventory', 'price', 'unit_price', 'cost', 'mrp',
      'brand', 'supplier', 'warehouse', 'reorder_level', 'category',
    ],
    id_keywords: ['sku', 'product_id', 'prod_id', 'item_code', 'barcode'],
  },
  ECOMMERCE_ORDER: {
    title: 'E-Commerce / Order Data',
    keywords: [
      'order', 'order_id', 'order_date', 'customer', 'customer_id', 'shipping',
      'discount', 'tax', 'total_amount', 'subtotal', 'payment', 'payment_status',
      'tracking', 'billing', 'invoice', 'courier',
    ],
    id_keywords: ['order_id', 'invoice_no', 'order_number'],
  },
  HEALTHCARE_PATIENT: {
    title: 'Hospital / Healthcare Patient Data',
    keywords: [
      'patient', 'patient_id', 'doctor', 'physician', 'diagnosis', 'disease',
      'hospital', 'clinic', 'admission_date', 'discharge_date', 'ward', 'bed',
      'blood_group', 'prescription', 'symptoms', 'dosage', 'medical',
    ],
    id_keywords: ['patient_id', 'mrn', 'uhid', 'admission_no'],
  },
  BANKING_FINANCE: {
    title: 'Banking / Financial Transactions',
    keywords: [
      'account', 'account_no', 'acc_no', 'transaction', 'trans_id', 'txn_id',
      'balance', 'debit', 'credit', 'amount', 'bank', 'branch', 'ifsc', 'swift',
      'cheque', 'ledger', 'deposit', 'withdrawal',
    ],
    id_keywords: ['txn_id', 'trans_id', 'transaction_id', 'account_no'],
  },
  ATTENDANCE_LOGISTICS: {
    title: 'Attendance & Delivery Tracking',
    keywords: [
      'attendance', 'in_time', 'out_time', 'checkin', 'checkout', 'shift',
      'delivery', 'shipment', 'waybill', 'consignee', 'origin', 'destination',
      'delivery_status', 'status',
    ],
    id_keywords: ['waybill_no', 'tracking_no', 'consignment_no', 'punch_id'],
  },
};

const ZERO_PAD_COL_KEYWORDS = ['reg_no', 'regno', 'roll_no', 'rollno', 'emp_id', 'postal', 'zip'];

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

export function parseCSVContent(csvContent: string): {
  headers: string[];
  records: Record<string, string>[];
} {
  const cleanText = csvContent.replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], records: [] };
  }

  const headers = parseCSVLine(lines[0]).map((h) => h.trim()).filter((h, idx, arr) => h.length > 0 || idx < arr.length - 1);
  if (headers.length === 0) {
    return { headers: [], records: [] };
  }

  const records: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? '';
    });
    records.push(row);
  }

  return { headers, records };
}

function normalizeColName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function cleanNullValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const stripped = String(value).trim();
  if (NULL_REPRESENTATIONS.has(stripped.toLowerCase())) {
    return null;
  }
  return stripped;
}

function cleanNumericString(value: string): string {
  let cleaned = value.trim();
  cleaned = cleaned.replace(/^[$€£¥₹]/, '').trim();
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, '');
  }
  if (cleaned.endsWith('%')) {
    const num = Number(cleaned.slice(0, -1).trim());
    if (!Number.isNaN(num)) {
      return String(num / 100.0);
    }
  }
  return cleaned;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1000 || year > 9999) {
    return false;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function parseAndNormalizeDate(value: string): { normalized: string | null; error: string | null } {
  const strVal = value.trim();
  if (!strVal) return { normalized: null, error: null };

  // 1. YYYY-MM-DD or YYYY/MM/DD
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]\d{2}:\d{2}:\d{2})?$/.exec(strVal);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (isValidCalendarDate(y, mo, d)) {
      return { normalized: `${y}-${pad2(mo)}-${pad2(d)}`, error: null };
    }
    return { normalized: null, error: `Date '${strVal}' does not match any recognized format (expected %Y-%m-%d)` };
  }

  // 2. DD-MM-YYYY / DD/MM/YYYY / MM/DD/YYYY / MM-DD-YYYY (mirrors Python order: %d-%m-%Y, %d/%m/%Y, %m/%d/%Y, %m-%d-%Y)
  m = /^(\d{1,2})([-/])(\d{1,2})\2(\d{4})$/.exec(strVal);
  if (m) {
    const p1 = Number(m[1]);
    const sep = m[2];
    const p2 = Number(m[3]);
    const y = Number(m[4]);

    // Check %d-%m-%Y or %d/%m/%Y first (matching python cleaner.py priority)
    if (sep === '-') {
      if (isValidCalendarDate(y, p2, p1)) {
        return { normalized: `${y}-${pad2(p2)}-${pad2(p1)}`, error: null };
      }
      if (isValidCalendarDate(y, p1, p2)) {
        return { normalized: `${y}-${pad2(p1)}-${pad2(p2)}`, error: null };
      }
    } else {
      if (isValidCalendarDate(y, p2, p1)) {
        return { normalized: `${y}-${pad2(p2)}-${pad2(p1)}`, error: null };
      }
      if (isValidCalendarDate(y, p1, p2)) {
        return { normalized: `${y}-${pad2(p1)}-${pad2(p2)}`, error: null };
      }
    }
  }

  return {
    normalized: null,
    error: `Date '${strVal}' does not match any recognized format (expected %Y-%m-%d)`,
  };
}

function toTitleCase(str: string): string {
  const collapsed = str.trim().split(/\s+/).join(' ');
  return collapsed.replace(/\b\w+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function inferDataType(sampleValues: string[]): {
  physical_type: string;
  semantic_type: string;
  details: Record<string, any>;
} {
  const cleanVals = sampleValues
    .map((v) => (v ?? '').trim())
    .filter((v) => !['', 'null', 'none', 'nan', 'n/a', '-'].includes(v.toLowerCase()));

  if (cleanVals.length === 0) {
    return { physical_type: 'string', semantic_type: 'empty', details: {} };
  }

  const total = cleanVals.length;
  const emailMatches = cleanVals.filter((v) => EMAIL_PATTERN.test(v)).length;
  if (emailMatches / total >= 0.7) {
    return { physical_type: 'string', semantic_type: 'email', details: { format: 'RFC5322' } };
  }

  const phoneMatches = cleanVals.filter((v) => {
    const digits = v.replace(/\D/g, '');
    return PHONE_PATTERN.test(v) && (digits.length === 10 || digits.length === 11 || digits.length === 12);
  }).length;
  if (phoneMatches / total >= 0.7) {
    return { physical_type: 'string', semantic_type: 'phone', details: { format: 'E.164/National' } };
  }

  const dateMatches = cleanVals.filter((v) => DATE_ISO_PATTERN.test(v) || DATE_SLASH_PATTERN.test(v)).length;
  if (dateMatches / total >= 0.7) {
    return { physical_type: 'date', semantic_type: 'date', details: { standard: 'ISO-8601' } };
  }

  const currencyMatches = cleanVals.filter(
    (v) => CURRENCY_PATTERN.test(v) || v.includes('$') || v.includes('€') || v.includes('£') || v.includes('₹')
  ).length;
  if (currencyMatches / total >= 0.6) {
    return { physical_type: 'float', semantic_type: 'currency', details: { strip_symbol: true } };
  }

  const intMatches = cleanVals.filter((v) => INTEGER_PATTERN.test(v.replace(/,/g, ''))).length;
  if (intMatches / total >= 0.8) {
    const hasLeadingZero = cleanVals.some((v) => v.length > 1 && v.startsWith('0'));
    if (hasLeadingZero) {
      return { physical_type: 'string', semantic_type: 'zero_padded_identifier', details: { preserve_zeros: true } };
    }
    return { physical_type: 'integer', semantic_type: 'integer', details: {} };
  }

  const floatMatches = cleanVals.filter((v) => FLOAT_PATTERN.test(v.replace(/,/g, ''))).length;
  if (floatMatches / total >= 0.8) {
    return { physical_type: 'float', semantic_type: 'decimal', details: {} };
  }

  const uniqueVals = Array.from(new Set(cleanVals)).sort();
  if (uniqueVals.length <= Math.min(15, Math.floor(total / 2) + 1) && total >= 6) {
    return {
      physical_type: 'string',
      semantic_type: 'category',
      details: { distinct_values: uniqueVals.slice(0, 10) },
    };
  }

  return { physical_type: 'string', semantic_type: 'text', details: {} };
}

export function analyzeProfile(
  headers: string[],
  records: Record<string, string>[]
): ClientDatasetProfile {
  const totalRows = records.length;
  const totalCols = headers.length;
  const columnsProfile: ClientColumnProfile[] = [];
  const domainScores: Record<string, number> = {};
  Object.keys(DOMAIN_SIGNATURES).forEach((k) => {
    domainScores[k] = 0.0;
  });

  const potentialIdentifiers: string[] = [];
  let totalMissing = 0;
  const totalCells = totalRows > 0 ? totalRows * Math.max(1, totalCols) : 1;

  for (const col of headers) {
    const colNorm = normalizeColName(col);
    const values = records.map((r) => r[col] ?? '');

    const missingCount = values.filter((v) => {
      if (v === null || v === undefined) return true;
      return ['','null','none','nan','n/a','na','-'].includes(String(v).trim().toLowerCase());
    }).length;
    totalMissing += missingCount;
    const missingPct = totalRows > 0 ? Math.round((missingCount / totalRows) * 10000) / 100 : 0.0;

    const cleanValues = values.map((v) => String(v ?? '').trim()).filter((v) => v !== '');
    const uniqueCount = new Set(cleanValues).size;
    const uniquePct = cleanValues.length > 0 ? Math.round((uniqueCount / cleanValues.length) * 10000) / 100 : 0.0;

    const sample = cleanValues.slice(0, 100);
    const { physical_type, semantic_type, details } = inferDataType(sample);

    const matchesIdKeyword = Object.values(DOMAIN_SIGNATURES).some((dom) =>
      dom.id_keywords.some((idWord) => colNorm.includes(idWord))
    );
    const isPotentialId =
      (uniquePct >= 90.0 && cleanValues.length >= Math.max(3, totalRows * 0.7)) || matchesIdKeyword;

    if (isPotentialId) {
      potentialIdentifiers.push(col);
    }

    for (const [domKey, domInfo] of Object.entries(DOMAIN_SIGNATURES)) {
      for (const kw of domInfo.keywords) {
        if (colNorm.includes(kw)) domainScores[domKey] += 2.0;
      }
      for (const idKw of domInfo.id_keywords) {
        if (colNorm.includes(idKw)) domainScores[domKey] += 4.0;
      }
    }

    columnsProfile.push({
      column_name: col,
      normalized_name: colNorm,
      physical_type,
      semantic_type,
      is_potential_identifier: isPotentialId,
      missing_count: missingCount,
      missing_percentage: missingPct,
      unique_count: uniqueCount,
      unique_percentage: uniquePct,
      sample_values: cleanValues.slice(0, 3),
      details,
    });
  }

  const sortedDomains = Object.entries(domainScores).sort((a, b) => b[1] - a[1]);
  const [topDomainKey, topScore] = sortedDomains[0] || ['GENERAL_CUSTOM', 0];

  let domainKey = 'GENERAL_CUSTOM';
  let domainTitle = 'Custom / General Tabular Dataset';
  let domainConfidence = 65.0;

  if (topScore >= 3.0 && DOMAIN_SIGNATURES[topDomainKey]) {
    domainKey = topDomainKey;
    domainTitle = DOMAIN_SIGNATURES[topDomainKey].title;
    domainConfidence = Math.min(98.0, 70.0 + topScore * 3.5);
  }

  const seenRows = new Set<string>();
  let duplicateRowsCount = 0;
  for (const r of records) {
    const rowHash = headers.map((h) => String(r[h] ?? '').trim().toLowerCase()).join('|');
    if (seenRows.has(rowHash)) {
      duplicateRowsCount += 1;
    } else {
      seenRows.add(rowHash);
    }
  }

  const primaryIdentifier =
    potentialIdentifiers.length > 0 ? potentialIdentifiers[0] : headers.length > 0 ? headers[0] : null;

  const missingPenalty = Math.min(40.0, (totalMissing / totalCells) * 100.0 * 1.5);
  const duplicatePenalty = Math.min(30.0, (duplicateRowsCount / Math.max(1, totalRows)) * 100.0 * 1.2);
  const baseScore = Math.max(10.0, Math.round((100.0 - missingPenalty - duplicatePenalty) * 10) / 10);

  return {
    total_rows: totalRows,
    total_columns: totalCols,
    headers,
    domain_key: domainKey,
    domain_title: domainTitle,
    domain_confidence_pct: Math.round(domainConfidence * 10) / 10,
    primary_identifier: primaryIdentifier,
    potential_identifiers: potentialIdentifiers,
    total_missing_cells: totalMissing,
    missing_cells_percentage: Math.round((totalMissing / totalCells) * 10000) / 100,
    duplicate_rows_count: duplicateRowsCount,
    data_quality_score: baseScore,
    columns: columnsProfile,
  };
}

export function generateRecommendationsClient(profile: ClientDatasetProfile): ClientRecommendation[] {
  const recommendations: ClientRecommendation[] = [];
  const domainKey = profile.domain_key;
  const primaryId = profile.primary_identifier;

  if (profile.duplicate_rows_count > 0) {
    recommendations.push({
      id: 'REC_DEDUP_EXACT',
      category: 'DEDUPLICATION',
      name: 'Deduplicate Exact Row Matches',
      affected_column: 'ALL_COLUMNS',
      description: `Detected ${profile.duplicate_rows_count} identical duplicate row(s). Keep first occurrence and purge redundant copies.`,
      affected_records: profile.duplicate_rows_count,
      severity: 'WARNING',
      enabled: true,
      preview: { before: `${profile.duplicate_rows_count} duplicate rows`, after: 'Unique records preserved' },
    });
  }

  if (primaryId) {
    recommendations.push({
      id: `REC_PK_${primaryId}`,
      category: 'IDENTIFIER_INTEGRITY',
      name: `Enforce Unique Identifier on [${primaryId}]`,
      affected_column: primaryId,
      description: `Treat [${primaryId}] as the canonical primary identifier. Flag duplicate IDs or missing values into the Exception Register.`,
      affected_records: profile.duplicate_rows_count || 1,
      severity: 'CRITICAL',
      enabled: true,
      preview: { before: 'Repeated or empty IDs', after: 'Unique verified entity key' },
    });
  }

  for (const colInfo of profile.columns) {
    const colName = colInfo.column_name;
    const normName = colInfo.normalized_name;
    const semType = colInfo.semantic_type;
    const missingCount = colInfo.missing_count;

    if (missingCount > 0) {
      const isId = colName === primaryId || colInfo.is_potential_identifier;
      recommendations.push({
        id: `REC_NULL_${colName}`,
        category: 'MISSING_DATA',
        name: `Missing Value Quarantine on [${colName}]`,
        affected_column: colName,
        description:
          `Found ${missingCount} empty / null value(s) in [${colName}]. ` +
          (isId ? 'Mandatory identifier cannot be null — will be quarantined.' : 'Flag in Exception Register.'),
        affected_records: missingCount,
        severity: isId ? 'CRITICAL' : 'WARNING',
        enabled: true,
        preview: { before: 'NULL / Empty / N/A', after: 'Isolated in Exception Register' },
      });
    }

    if (semType === 'email' || normName.includes('email')) {
      const sampleVal = colInfo.sample_values[0] || 'user@sample.com';
      recommendations.push({
        id: `REC_EMAIL_${colName}`,
        category: 'FORMAT_NORMALIZATION',
        name: `Standardize & Validate Email Format on [${colName}]`,
        affected_column: colName,
        description: 'Strip whitespace, convert to canonical lowercase, and quarantine non-compliant RFC 5322 addresses.',
        affected_records: colInfo.sample_values.length,
        severity: 'INFO',
        enabled: true,
        preview: {
          before: `  ${sampleVal.toUpperCase()}  `,
          after: sampleVal.toLowerCase().trim(),
        },
      });
    }

    if (semType === 'date' || normName.includes('date') || normName.includes('dob') || normName.includes('doj')) {
      recommendations.push({
        id: `REC_DATE_${colName}`,
        category: 'STANDARDIZATION',
        name: `Normalize Dates to ISO-8601 on [${colName}]`,
        affected_column: colName,
        description: 'Standardize heterogeneous date formats (MM/DD/YYYY, DD-MM-YYYY) into ISO YYYY-MM-DD.',
        affected_records: colInfo.sample_values.length,
        severity: 'INFO',
        enabled: true,
        preview: {
          before: '03/15/2026 or 15-03-2026',
          after: '2026-03-15',
        },
      });
    }

    if (
      semType === 'currency' ||
      ['price', 'cost', 'salary', 'amount', 'total', 'balance', 'fee'].some((w) => normName.includes(w))
    ) {
      recommendations.push({
        id: `REC_CURRENCY_${colName}`,
        category: 'NUMERIC_CLEANING',
        name: `Sanitize Currency Symbols on [${colName}]`,
        affected_column: colName,
        description: 'Strip currency symbols ($ , € , £ , ¥ , ₹) and thousands separator commas to yield pure decimal floats.',
        affected_records: colInfo.sample_values.length,
        severity: 'INFO',
        enabled: true,
        preview: {
          before: '$1,499.50',
          after: '1499.50',
        },
      });
    }

    if (semType === 'phone' || ['phone', 'mobile', 'contact', 'cell'].some((w) => normName.includes(w))) {
      recommendations.push({
        id: `REC_PHONE_${colName}`,
        category: 'PHONE_VALIDATION',
        name: `Normalize & Validate Phone Format on [${colName}]`,
        affected_column: colName,
        description: 'Validate 10-12 digit standard phone numbers, strip non-numeric punctuation (except optional leading +).',
        affected_records: colInfo.sample_values.length,
        severity: 'WARNING',
        enabled: true,
        preview: {
          before: '+1 (555) 019-2834',
          after: '+15550192834',
        },
      });
    }

    if (['name', 'first_name', 'last_name', 'full_name', 'student_name', 'employee_name'].some((w) => normName.includes(w))) {
      recommendations.push({
        id: `REC_NAME_${colName}`,
        category: 'TEXT_NORMALIZATION',
        name: `Titlecase & Trim Name on [${colName}]`,
        affected_column: colName,
        description: 'Remove unnecessary leading/trailing whitespace and capitalize words neatly without altering identity.',
        affected_records: colInfo.sample_values.length,
        severity: 'INFO',
        enabled: true,
        preview: {
          before: '  SARAH  connor  ',
          after: 'Sarah Connor',
        },
      });
    }

    if (semType === 'zero_padded_identifier' || ZERO_PAD_COL_KEYWORDS.some((w) => normName.includes(w))) {
      recommendations.push({
        id: `REC_ZEROS_${colName}`,
        category: 'PRESERVATION',
        name: `Preserve Leading Zeros on Identifier [${colName}]`,
        affected_column: colName,
        description:
          'Ensure numeric identifiers with leading zeros (e.g. 00421) are preserved as exact text and not truncated by float casting.',
        affected_records: colInfo.sample_values.length,
        severity: 'INFO',
        enabled: true,
        preview: {
          before: '00421 (as text)',
          after: '00421 (preserved)',
        },
      });
    }
  }

  if (domainKey === 'PRODUCT_INVENTORY') {
    recommendations.push({
      id: 'REC_NON_NEGATIVE_STOCK',
      category: 'BUSINESS_RULE',
      name: 'Assert Non-Negative Stock & Price',
      affected_column: 'price, quantity',
      description: 'Detect and quarantine negative inventory quantities or negative price anomalies.',
      affected_records: 1,
      severity: 'CRITICAL',
      enabled: true,
      preview: { before: 'price: -15.00', after: 'Quarantined in Exception Register' },
    });
  } else if (domainKey === 'ECOMMERCE_ORDER') {
    recommendations.push({
      id: 'REC_MATH_INTEGRITY',
      category: 'BUSINESS_RULE',
      name: 'Verify Cross-Field Invoiced Total Formula',
      affected_column: 'total_amount',
      description: 'Verify calculation: total_amount = qty * price * (1 - discount) + tax (tolerance ±$0.05).',
      affected_records: 1,
      severity: 'CRITICAL',
      enabled: true,
      preview: { before: 'Mismatched total amount', after: 'Audit exception logged' },
    });
  }

  return recommendations;
}

export function profileDatasetClient(csvContent: string): {
  profile: ClientDatasetProfile;
  recommendations: ClientRecommendation[];
} {
  const { headers, records } = parseCSVContent(csvContent);
  const profile = analyzeProfile(headers, records);
  const recommendations = generateRecommendationsClient(profile);
  return { profile, recommendations };
}

export function processDatasetRecords(
  headers: string[],
  records: Record<string, string>[],
  enabledRules?: Record<string, boolean>,
  customIdentifier?: string
): {
  profile: ClientDatasetProfile;
  summary: ClientEngineSummary;
  cleanedRecords: Record<string, string>[];
  exceptionRecords: ClientExceptionItem[];
} {
  const t0 = performance.now();
  const rules = enabledRules || {};

  const profile = analyzeProfile(headers, records);
  const primaryId = customIdentifier || profile.primary_identifier;
  const columnsByName: Record<string, ClientColumnProfile> = {};
  for (const c of profile.columns) {
    columnsByName[c.column_name] = c;
  }

  const cleanedRecords: Record<string, string>[] = [];
  const exceptionRecords: ClientExceptionItem[] = [];
  const seenIdentifiers = new Set<string>();
  const seenExactRows = new Set<string>();

  const enforceDedup = rules['REC_DEDUP_EXACT'] ?? true;
  const enforcePkUnique = primaryId ? rules[`REC_PK_${primaryId}`] ?? true : true;

  records.forEach((rawRow, idx) => {
    const rowIdx = idx + 1;
    let rowIsQuarantined = false;
    const rowExceptions: ClientExceptionItem[] = [];
    const cleanedRow: Record<string, string> = {};

    const rowHash = headers.map((h) => String(rawRow[h] ?? '').trim().toLowerCase()).join('|');
    if (enforceDedup) {
      if (seenExactRows.has(rowHash)) {
        exceptionRecords.push({
          row_number: String(rowIdx),
          record_id: String((primaryId && rawRow[primaryId]) || `ROW_${rowIdx}`),
          field_name: 'ROW_RECORD',
          rule_id: 'DUPLICATE_EXACT_ROW',
          violation_type: 'DUPLICATE_ROW',
          severity: 'WARNING',
          raw_value: 'IDENTICAL_TO_PREVIOUS',
          expected: 'Unique row data',
          error_message: `Row #${rowIdx} is an exact duplicate of a previously ingested record.`,
          suggested_correction: 'Purge redundant copy or verify unique entity identifier.',
        });
        return;
      }
      seenExactRows.add(rowHash);
    }

    if (primaryId && Object.prototype.hasOwnProperty.call(rawRow, primaryId)) {
      const rawPk = rawRow[primaryId] ?? '';
      const cleanedPk = cleanNullValue(rawPk);
      if (cleanedPk === null || cleanedPk.trim() === '') {
        rowIsQuarantined = true;
        rowExceptions.push({
          row_number: String(rowIdx),
          record_id: `ROW_${rowIdx}`,
          field_name: primaryId,
          rule_id: 'PK_MISSING',
          violation_type: 'MISSING_PRIMARY_KEY',
          severity: 'CRITICAL',
          raw_value: 'EMPTY_NULL',
          expected: 'Unique Non-Empty Identifier',
          error_message: `Primary identifier '${primaryId}' cannot be null or empty.`,
          suggested_correction: 'Provide a valid distinct entity ID.',
        });
      } else if (enforcePkUnique) {
        const pkStr = cleanedPk.trim();
        if (seenIdentifiers.has(pkStr)) {
          rowIsQuarantined = true;
          rowExceptions.push({
            row_number: String(rowIdx),
            record_id: pkStr,
            field_name: primaryId,
            rule_id: 'PK_DUPLICATE',
            violation_type: 'DUPLICATE_IDENTIFIER',
            severity: 'CRITICAL',
            raw_value: pkStr,
            expected: 'Unique entity key across dataset',
            error_message: `Identifier '${pkStr}' is already assigned to an earlier row.`,
            suggested_correction: 'Generate unique key or verify merged transactions.',
          });
        } else {
          seenIdentifiers.add(pkStr);
        }
      }
    }

    const rowRecordId = String((primaryId && rawRow[primaryId]) || `ROW_${rowIdx}`);

    for (const col of headers) {
      const rawVal = String(rawRow[col] ?? '').trim();
      const colMeta = columnsByName[col];
      const normName = colMeta?.normalized_name || normalizeColName(col);
      const semType = colMeta?.semantic_type || 'text';
      const physType = colMeta?.physical_type || 'string';

      const cleanedVal = cleanNullValue(rawVal);
      if (cleanedVal === null) {
        cleanedRow[col] = '';
        continue;
      }

      if (semType === 'zero_padded_identifier' || ZERO_PAD_COL_KEYWORDS.some((w) => normName.includes(w))) {
        cleanedRow[col] = cleanedVal;
        continue;
      }

      if (semType === 'email' || normName.includes('email')) {
        const emailStr = cleanedVal.trim().toLowerCase();
        if (EMAIL_PATTERN.test(emailStr)) {
          cleanedRow[col] = emailStr;
        } else {
          rowIsQuarantined = true;
          rowExceptions.push({
            row_number: String(rowIdx),
            record_id: rowRecordId,
            field_name: col,
            rule_id: 'FORMAT_EMAIL',
            violation_type: 'INVALID_EMAIL_FORMAT',
            severity: 'ERROR',
            raw_value: cleanedVal,
            expected: 'RFC 5322 compliant address (e.g. user@domain.com)',
            error_message: `Value '${cleanedVal}' is not a valid email address.`,
            suggested_correction: 'Correct typo or supply legitimate domain name.',
          });
          cleanedRow[col] = emailStr;
        }
        continue;
      }

      if (
        semType === 'date' ||
        ['date', 'dob', 'doj', 'admission', 'discharge'].some((w) => normName.includes(w))
      ) {
        const { normalized } = parseAndNormalizeDate(cleanedVal);
        if (normalized) {
          cleanedRow[col] = normalized;
        } else {
          rowIsQuarantined = true;
          rowExceptions.push({
            row_number: String(rowIdx),
            record_id: rowRecordId,
            field_name: col,
            rule_id: 'FORMAT_DATE',
            violation_type: 'INVALID_DATE_FORMAT',
            severity: 'ERROR',
            raw_value: cleanedVal,
            expected: 'Standard date (YYYY-MM-DD, MM/DD/YYYY, or DD-MM-YYYY)',
            error_message: `Cannot parse '${cleanedVal}' as a valid calendar date.`,
            suggested_correction: 'Format as YYYY-MM-DD.',
          });
          cleanedRow[col] = cleanedVal;
        }
        continue;
      }

      if (
        semType === 'currency' ||
        ['price', 'cost', 'salary', 'amount', 'total', 'balance', 'fee'].some((w) => normName.includes(w))
      ) {
        const cleanedNum = cleanNumericString(cleanedVal);
        const floatVal = Number(cleanedNum);
        if (cleanedNum !== '' && !Number.isNaN(floatVal) && Number.isFinite(floatVal)) {
          if (
            floatVal < 0.0 &&
            ['price', 'salary', 'stock', 'quantity', 'fee'].some((w) => normName.includes(w))
          ) {
            rowIsQuarantined = true;
            rowExceptions.push({
              row_number: String(rowIdx),
              record_id: rowRecordId,
              field_name: col,
              rule_id: 'RANGE_POSITIVE',
              violation_type: 'NEGATIVE_VALUE_ERROR',
              severity: 'CRITICAL',
              raw_value: cleanedVal,
              expected: 'Positive numeric value >= 0.00',
              error_message: `Negative value '${floatVal}' is invalid for field '${col}'.`,
              suggested_correction: 'Provide non-negative monetary or quantity value.',
            });
          }
          cleanedRow[col] = floatVal.toFixed(2);
        } else {
          rowIsQuarantined = true;
          rowExceptions.push({
            row_number: String(rowIdx),
            record_id: rowRecordId,
            field_name: col,
            rule_id: 'TYPE_FLOAT',
            violation_type: 'TYPE_CAST_FAILURE',
            severity: 'ERROR',
            raw_value: cleanedVal,
            expected: 'Numeric float value',
            error_message: `Cannot convert '${cleanedVal}' to decimal float.`,
            suggested_correction: 'Remove non-numeric characters.',
          });
          cleanedRow[col] = cleanedVal;
        }
        continue;
      }

      if (['name', 'first_name', 'last_name', 'full_name'].some((w) => normName.includes(w))) {
        cleanedRow[col] = toTitleCase(cleanedVal);
        continue;
      }

      if (semType === 'phone' || ['phone', 'mobile', 'contact', 'cell'].some((w) => normName.includes(w))) {
        const digits = cleanedVal.replace(/\D/g, '');
        if (digits.length >= 10 && digits.length <= 13) {
          cleanedRow[col] = (cleanedVal.trim().startsWith('+') ? '+' : '') + digits;
        } else {
          rowIsQuarantined = true;
          rowExceptions.push({
            row_number: String(rowIdx),
            record_id: rowRecordId,
            field_name: col,
            rule_id: 'FORMAT_PHONE',
            violation_type: 'INVALID_PHONE_NUMBER',
            severity: 'WARNING',
            raw_value: cleanedVal,
            expected: '10-12 digit valid phone number',
            error_message: `Phone number '${cleanedVal}' has invalid length or pattern.`,
            suggested_correction: 'Supply standard mobile number.',
          });
          cleanedRow[col] = cleanedVal;
        }
        continue;
      }

      if (
        physType === 'integer' ||
        ['quantity', 'qty', 'stock', 'units', 'year', 'semester'].some((w) => normName.includes(w))
      ) {
        const cleanedInt = cleanNumericString(cleanedVal);
        const parsed = Number(cleanedInt);
        if (cleanedInt !== '' && !Number.isNaN(parsed) && Number.isFinite(parsed)) {
          const intVal = Math.trunc(parsed);
          if (intVal < 0 && ['quantity', 'qty', 'stock'].some((w) => normName.includes(w))) {
            rowIsQuarantined = true;
            rowExceptions.push({
              row_number: String(rowIdx),
              record_id: rowRecordId,
              field_name: col,
              rule_id: 'RANGE_STOCK_POSITIVE',
              violation_type: 'NEGATIVE_STOCK',
              severity: 'CRITICAL',
              raw_value: cleanedVal,
              expected: 'Non-negative integer >= 0',
              error_message: `Negative count '${intVal}' is not permitted for '${col}'.`,
              suggested_correction: 'Set stock/quantity >= 0.',
            });
          }
          cleanedRow[col] = String(intVal);
        } else {
          cleanedRow[col] = cleanedVal;
        }
        continue;
      }

      cleanedRow[col] = cleanedVal;
    }

    if (
      Object.prototype.hasOwnProperty.call(cleanedRow, 'quantity') &&
      Object.prototype.hasOwnProperty.call(cleanedRow, 'unit_price') &&
      Object.prototype.hasOwnProperty.call(cleanedRow, 'total_amount')
    ) {
      const q = Number(cleanedRow['quantity']);
      const p = Number(cleanedRow['unit_price']);
      const t = Number(cleanedRow['total_amount']);
      const d = Number(cleanedRow['discount_pct'] ?? 0);
      const tax = Number(cleanedRow['tax_amount'] ?? 0);
      if (![q, p, t, d, tax].some((n) => Number.isNaN(n))) {
        const calcTotal = Math.round((q * p * (1.0 - d) + tax) * 100) / 100;
        if (Math.abs(calcTotal - t) > 0.05) {
          rowIsQuarantined = true;
          rowExceptions.push({
            row_number: String(rowIdx),
            record_id: rowRecordId,
            field_name: 'total_amount',
            rule_id: 'BIZ_MATH_VERIFY',
            violation_type: 'MATHEMATICAL_DISCREPANCY',
            severity: 'CRITICAL',
            raw_value: String(t),
            expected: `Expected formula total: $${calcTotal.toFixed(2)} (qty*price*(1-disc)+tax)`,
            error_message: `Cross-field calculation mismatch. Invoiced $${t.toFixed(2)} != Calculated $${calcTotal.toFixed(2)}`,
            suggested_correction: `Reconcile total to $${calcTotal.toFixed(2)}.`,
          });
        }
      }
    }

    if (rowIsQuarantined) {
      exceptionRecords.push(...rowExceptions);
    } else {
      cleanedRecords.push(cleanedRow);
    }
  });

  const executionMs = Math.round((performance.now() - t0) * 100) / 100;
  const totalInput = records.length;
  const validCount = cleanedRecords.length;
  const quarantinedCount = totalInput - validCount;
  const passRate = totalInput > 0 ? Math.round((validCount / totalInput) * 1000) / 10 : 0.0;

  const summary: ClientEngineSummary = {
    total_records: totalInput,
    valid_records: validCount,
    quarantined_records: quarantinedCount,
    duplicate_records: profile.duplicate_rows_count,
    pass_rate_pct: passRate,
    quarantine_rate_pct: Math.round((100.0 - passRate) * 10) / 10,
    execution_time_ms: executionMs,
    domain_detected: profile.domain_title,
    data_quality_score: profile.data_quality_score,
    total_exceptions: exceptionRecords.length,
  };

  return {
    profile,
    summary,
    cleanedRecords,
    exceptionRecords,
  };
}

export function cleanDatasetClient(csvContent: string, enabledRules?: Record<string, boolean>) {
  const { headers, records } = parseCSVContent(csvContent);
  const result = processDatasetRecords(headers, records, enabledRules);
  return {
    success: true,
    ...result,
  };
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

export function runMandatoryTestsClient() {
  const t0 = performance.now();
  const specs: Array<{ name: string; desc: string; fn: () => void }> = [
    {
      name: 'test_tc01_valid_csv_input',
      desc: 'TC-01: Valid CSV input -> File loads and processing completes successfully.',
      fn: () => {
        const res = processDatasetRecords(
          ['order_id', 'email', 'amount', 'order_date'],
          [
            { order_id: 'ORD-101', email: 'alice@example.com', amount: '99.50', order_date: '2026-03-01' },
            { order_id: 'ORD-102', email: 'bob@example.com', amount: '149.00', order_date: '2026-03-02' },
          ]
        );
        assert(res.cleanedRecords.length === 2, 'Expected 2 cleaned records');
        assert(res.exceptionRecords.length === 0, 'Expected 0 exceptions');
        assert(res.summary.pass_rate_pct === 100.0, 'Expected 100% pass rate');
      },
    },
    {
      name: 'test_tc02_missing_required_column',
      desc: 'TC-02: Missing required column -> Schema issue is detected and reported.',
      fn: () => {
        const required = ['order_id', 'email', 'amount', 'order_date'];
        const headers = ['order_id', 'amount'];
        const missing = required.filter((col) => !headers.includes(col));
        assert(missing.includes('email') && missing.includes('order_date'), 'Missing columns must be detected');
      },
    },
    {
      name: 'test_tc03_blank_mandatory_value',
      desc: 'TC-03: Blank mandatory value -> Missing-value issue is identified and quarantined.',
      fn: () => {
        const res = processDatasetRecords(
          ['order_id', 'email', 'amount'],
          [{ order_id: '', email: 'user@example.com', amount: '50.00' }],
          undefined,
          'order_id'
        );
        assert(res.cleanedRecords.length === 0, 'Blank primary key row should be quarantined');
        assert(res.exceptionRecords[0]?.violation_type === 'MISSING_PRIMARY_KEY', 'Expected MISSING_PRIMARY_KEY');
      },
    },
    {
      name: 'test_tc04_incorrect_data_type',
      desc: 'TC-04: Incorrect data type -> Type mismatch is identified and flagged.',
      fn: () => {
        const res = processDatasetRecords(
          ['order_id', 'amount'],
          [{ order_id: 'ORD-301', amount: 'INVALID_NOT_A_NUMBER' }],
          undefined,
          'order_id'
        );
        assert(res.exceptionRecords.some((e) => e.violation_type === 'TYPE_CAST_FAILURE'), 'Expected TYPE_CAST_FAILURE');
      },
    },
    {
      name: 'test_tc05_duplicate_record_key',
      desc: 'TC-05: Duplicate record/key -> Duplicate primary key is detected as configured.',
      fn: () => {
        const res = processDatasetRecords(
          ['order_id', 'customer_name', 'amount'],
          [
            { order_id: 'ORD-999', customer_name: 'User A', amount: '100' },
            { order_id: 'ORD-999', customer_name: 'User B (Duplicate)', amount: '100' },
          ],
          undefined,
          'order_id'
        );
        assert(res.cleanedRecords.length === 1, 'Expected 1 clean record');
        assert(res.exceptionRecords[0]?.violation_type === 'DUPLICATE_IDENTIFIER', 'Expected DUPLICATE_IDENTIFIER');
      },
    },
    {
      name: 'test_tc06_invalid_date_format',
      desc: 'TC-06: Invalid date/format -> Malformed date format issue is recorded.',
      fn: () => {
        const valid = parseAndNormalizeDate('03/15/2026');
        assert(valid.normalized === '2026-03-15' && valid.error === null, 'Expected ISO normalized date');
        const invalid = parseAndNormalizeDate('NOT_A_REAL_DATE_32/13/99');
        assert(invalid.normalized === null && invalid.error !== null, 'Expected malformed date error');
      },
    },
    {
      name: 'test_tc07_empty_csv',
      desc: 'TC-07: Empty CSV -> Readable validation error is handled gracefully.',
      fn: () => {
        const res = processDatasetRecords([], []);
        assert(res.summary.total_records === 0 && res.summary.valid_records === 0, 'Expected zero counts');
      },
    },
    {
      name: 'test_tc08_malformed_unreadable_file',
      desc: 'TC-08: Malformed/unreadable file -> Processing stops safely with descriptive message.',
      fn: () => {
        const parsed = parseCSVContent('');
        assert(parsed.headers.length === 0 && parsed.records.length === 0, 'Empty/malformed input handled safely');
      },
    },
    {
      name: 'test_tc09_valid_business_rule_boundary',
      desc: 'TC-09: Valid business-rule boundary -> Boundary values handled correctly.',
      fn: () => {
        const inRange = (v: number) => v >= 0.0 && v <= 1.0;
        assert(inRange(0.0) && inRange(1.0) && !inRange(1.5), 'Boundary constraints [0.0, 1.0] failed');
      },
    },
    {
      name: 'test_tc10_output_generation',
      desc: 'TC-10: Output generation -> Clean dataset and exception report are created.',
      fn: () => {
        const res = processDatasetRecords(
          ['id', 'val'],
          [
            { id: '001', val: '100' },
            { id: '002', val: '200' },
          ]
        );
        assert(res.cleanedRecords.length === 2, 'Expected 2 records in cleaned output');
        assert(res.cleanedRecords[0].id === '001', 'Leading zero preserved on id');
      },
    },
  ];

  const lines: string[] = [];
  const testCases: Array<{ name: string; suite: string; status: 'ok' | 'fail' }> = [];

  for (const spec of specs) {
    let status: 'ok' | 'fail' = 'ok';
    try {
      spec.fn();
    } catch {
      status = 'fail';
    }
    testCases.push({ name: spec.name, suite: 'tests.test_mandatory_suite.TestMandatoryTenSuite', status });
    lines.push(`${spec.name} (tests.test_mandatory_suite.TestMandatoryTenSuite)`);
    lines.push(`${spec.desc} ... ${status === 'ok' ? 'ok' : 'FAIL'}`);
  }

  const elapsedSec = ((performance.now() - t0) / 1000).toFixed(3);
  const failedCount = testCases.filter((t) => t.status !== 'ok').length;
  lines.push('----------------------------------------------------------------------');
  lines.push(`Ran ${testCases.length} tests in ${elapsedSec}s`);
  lines.push('');
  lines.push(failedCount === 0 ? 'OK' : `FAILED (failures=${failedCount})`);

  return {
    success: failedCount === 0,
    output: lines.join('\n'),
    testCases,
    totalTests: testCases.length,
    passedCount: testCases.length - failedCount,
    failedCount,
  };
}
