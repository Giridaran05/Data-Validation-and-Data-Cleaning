import {
  BeforeAfterSnapshot,
  CleaningRecommendation,
  DatasetProfile,
  ExceptionItem,
  QualityWeightsConfig,
  SixDimensionItem,
} from '../types/idata';
import { parseAndNormalizeDate } from './clientEngine';

const NULL_TOKENS = new Set(['', 'null', 'none', 'nan', 'n/a', 'na', 'nil', '#n/a', 'undefined', '-']);
const EMAIL_RE = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseNumericSafe(raw: string | undefined | null): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s || NULL_TOKENS.has(s.toLowerCase())) return null;
  let cleaned = s.replace(/^[$€£¥₹]/, '').trim();
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, '');
  }
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

export interface NumericColumnInfo {
  column: string;
  values: number[];
}

export function extractNumericColumns(
  headers: string[],
  records: Record<string, string>[]
): NumericColumnInfo[] {
  if (!records || records.length === 0) return [];
  const cols: NumericColumnInfo[] = [];
  for (const h of headers) {
    const vals: number[] = [];
    for (const r of records) {
      const n = parseNumericSafe(r[h]);
      if (n !== null) vals.push(n);
    }
    // Consider numeric if >= 60% of non-empty values parse cleanly and at least 3 numbers exist
    const nonEmptyCount = records.filter((r) => !NULL_TOKENS.has(String(r[h] ?? '').trim().toLowerCase())).length;
    if (vals.length >= 3 && nonEmptyCount > 0 && vals.length / nonEmptyCount >= 0.6) {
      cols.push({ column: h, values: vals });
    }
  }
  return cols;
}

export interface HistogramBin {
  range: string;
  min: number;
  max: number;
  count: number;
}

export function computeHistogram(values: number[], binCount?: number): HistogramBin[] {
  if (values.length === 0) return [];
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  if (minVal === maxVal) {
    return [{ range: `${minVal.toFixed(2)}`, min: minVal, max: maxVal, count: values.length }];
  }
  const k = binCount || Math.min(12, Math.max(5, Math.ceil(Math.log2(values.length) + 1)));
  const width = (maxVal - minVal) / k;
  const bins: HistogramBin[] = Array.from({ length: k }, (_, i) => {
    const bMin = minVal + i * width;
    const bMax = i === k - 1 ? maxVal : minVal + (i + 1) * width;
    return {
      range: `${bMin >= 1000 ? Math.round(bMin) : bMin.toFixed(1)}–${bMax >= 1000 ? Math.round(bMax) : bMax.toFixed(1)}`,
      min: bMin,
      max: bMax,
      count: 0,
    };
  });

  for (const v of values) {
    const idx = Math.min(k - 1, Math.floor((v - minVal) / width));
    bins[idx].count += 1;
  }
  return bins;
}

export interface BoxPlotSummary {
  column: string;
  count: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  lowerWhisker: number;
  upperWhisker: number;
  iqr: number;
  outliers: number[];
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function computeBoxPlot(column: string, values: number[]): BoxPlotSummary | null {
  if (values.length < 3) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lowFence = q1 - 1.5 * iqr;
  const highFence = q3 + 1.5 * iqr;

  const inliers = sorted.filter((v) => v >= lowFence && v <= highFence);
  const outliers = sorted.filter((v) => v < lowFence || v > highFence);

  return {
    column,
    count: sorted.length,
    min: sorted[0],
    q1,
    median,
    q3,
    max: sorted[sorted.length - 1],
    lowerWhisker: inliers.length > 0 ? inliers[0] : sorted[0],
    upperWhisker: inliers.length > 0 ? inliers[inliers.length - 1] : sorted[sorted.length - 1],
    iqr,
    outliers,
  };
}

export function computePearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (den === 0) return null;
  return Math.round((num / den) * 1000) / 1000;
}

export function computeScatterAndPearson(
  records: Record<string, string>[],
  colX: string,
  colY: string
): { points: Array<{ x: number; y: number; rowIndex: number }>; pearson: number | null } {
  const points: Array<{ x: number; y: number; rowIndex: number }> = [];
  const xs: number[] = [];
  const ys: number[] = [];

  records.forEach((r, i) => {
    const nx = parseNumericSafe(r[colX]);
    const ny = parseNumericSafe(r[colY]);
    if (nx !== null && ny !== null) {
      points.push({ x: nx, y: ny, rowIndex: i + 1 });
      xs.push(nx);
      ys.push(ny);
    }
  });

  return {
    points,
    pearson: computePearsonCorrelation(xs, ys),
  };
}

export interface CorrelationMatrixData {
  columns: string[];
  matrix: Array<Array<number | null>>;
}

export function computeCorrelationMatrix(
  headers: string[],
  records: Record<string, string>[]
): CorrelationMatrixData {
  const numericCols = extractNumericColumns(headers, records).slice(0, 8);
  const cols = numericCols.map((c) => c.column);
  const matrix: Array<Array<number | null>> = cols.map(() => cols.map(() => null));

  for (let i = 0; i < cols.length; i++) {
    for (let j = 0; j < cols.length; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else if (j < i) {
        matrix[i][j] = matrix[j][i];
      } else {
        const { pearson } = computeScatterAndPearson(records, cols[i], cols[j]);
        matrix[i][j] = pearson;
      }
    }
  }
  return { columns: cols, matrix };
}

function countDatasetStatistics(
  headers: string[],
  records: Record<string, string>[],
  profile: DatasetProfile
) {
  const totalRecords = records.length;
  let missingValues = 0;
  let formatViolations = 0;
  let typeInconsistencies = 0;

  const colMetaMap = new Map(profile.columns.map((c) => [c.column_name, c]));

  for (const r of records) {
    for (const h of headers) {
      const raw = String(r[h] ?? '');
      const trimmed = raw.trim();
      const meta = colMetaMap.get(h);
      const norm = meta?.normalized_name || h.toLowerCase();
      const semType = meta?.semantic_type || 'text';
      const physType = meta?.physical_type || 'string';

      if (NULL_TOKENS.has(trimmed.toLowerCase())) {
        missingValues++;
        continue;
      }

      // Check format violations on raw representation
      if (raw !== trimmed || /\s{2,}/.test(trimmed)) {
        formatViolations++;
      } else if (semType === 'email' || norm.includes('email')) {
        if (!EMAIL_RE.test(trimmed.toLowerCase()) || trimmed !== trimmed.toLowerCase()) {
          formatViolations++;
        }
      } else if (semType === 'date' || ['date', 'dob', 'doj', 'admission', 'discharge'].some((k) => norm.includes(k))) {
        const { normalized } = parseAndNormalizeDate(trimmed);
        if (!normalized || !ISO_DATE_RE.test(trimmed)) {
          formatViolations++;
        }
        if (!normalized) {
          typeInconsistencies++;
        }
      } else if (
        semType === 'currency' ||
        ['price', 'cost', 'salary', 'amount', 'total', 'balance', 'fee'].some((k) => norm.includes(k))
      ) {
        if (/[$€£¥₹,]/.test(trimmed)) {
          formatViolations++;
        }
        if (parseNumericSafe(trimmed) === null) {
          typeInconsistencies++;
        }
      } else if (physType === 'integer' || physType === 'float') {
        if (parseNumericSafe(trimmed) === null) {
          typeInconsistencies++;
        }
      }
    }
  }

  // Exact duplicate rows
  const seenRows = new Set<string>();
  let duplicateRows = 0;
  for (const r of records) {
    const hash = headers.map((h) => String(r[h] ?? '').trim().toLowerCase()).join('|');
    if (seenRows.has(hash)) duplicateRows++;
    else seenRows.add(hash);
  }

  // Duplicate primary identifiers
  let duplicatePks = 0;
  if (profile.primary_identifier) {
    const seenPks = new Set<string>();
    for (const r of records) {
      const pk = String(r[profile.primary_identifier] ?? '').trim();
      if (pk && !NULL_TOKENS.has(pk.toLowerCase())) {
        if (seenPks.has(pk)) duplicatePks++;
        else seenPks.add(pk);
      }
    }
  }

  // Outliers via IQR across numeric columns
  const numericCols = extractNumericColumns(headers, records);
  let detectedOutliers = 0;
  for (const nc of numericCols) {
    const box = computeBoxPlot(nc.column, nc.values);
    if (box) detectedOutliers += box.outliers.length;
  }

  return {
    totalRecords,
    missingValues,
    duplicateRecords: Math.max(duplicateRows, duplicatePks),
    typeInconsistencies,
    formatViolations,
    detectedOutliers,
  };
}

export function computeAutoCleanedCounts(
  headers: string[],
  originalRecords: Record<string, string>[],
  cleanedRecords: Record<string, string>[],
  profile: DatasetProfile
): { autoCleanedRecords: number; autoCleanedCells: number } {
  const pkCol = profile.primary_identifier;
  if (!pkCol || originalRecords.length === 0 || cleanedRecords.length === 0) {
    return { autoCleanedRecords: 0, autoCleanedCells: 0 };
  }

  // Match first occurrence of each PK in originalRecords with cleanedRecords
  const rawByPk = new Map<string, Record<string, string>>();
  for (const r of originalRecords) {
    const pk = String(r[pkCol] ?? '').trim();
    if (pk && !rawByPk.has(pk)) {
      rawByPk.set(pk, r);
    }
  }

  let autoCleanedRecords = 0;
  let autoCleanedCells = 0;
  for (const cr of cleanedRecords) {
    const pk = String(cr[pkCol] ?? '').trim();
    const rawRow = rawByPk.get(pk);
    if (!rawRow) continue;
    let rowModified = false;
    for (const h of headers) {
      const beforeVal = String(rawRow[h] ?? '');
      const afterVal = String(cr[h] ?? '');
      if (beforeVal !== afterVal) {
        rowModified = true;
        autoCleanedCells++;
      }
    }
    if (rowModified) autoCleanedRecords++;
  }

  return { autoCleanedRecords, autoCleanedCells };
}

export function computeBeforeAfterComparison(
  headers: string[],
  originalRecords: Record<string, string>[],
  cleanedRecords: Record<string, string>[],
  exceptionRecords: ExceptionItem[],
  beforeProfile: DatasetProfile,
  recommendations: CleaningRecommendation[],
  enabledRules: Record<string, boolean>
): BeforeAfterSnapshot {
  const beforeStats = countDatasetStatistics(headers, originalRecords, beforeProfile);
  const afterStats = countDatasetStatistics(headers, cleanedRecords, beforeProfile);

  const quarantinedRowSet = new Set(exceptionRecords.map((e) => e.row_number));
  const quarantinedRecords = Math.max(
    quarantinedRowSet.size,
    Math.max(0, originalRecords.length - cleanedRecords.length)
  );
  const invalidBefore = quarantinedRecords;

  const totalCellsBefore = Math.max(1, originalRecords.length * Math.max(1, headers.length));
  const totalCellsAfter = Math.max(1, cleanedRecords.length * Math.max(1, headers.length));

  const beforePenalty =
    Math.min(40, (beforeStats.missingValues / totalCellsBefore) * 100 * 1.5) +
    Math.min(30, (beforeStats.duplicateRecords / Math.max(1, beforeStats.totalRecords)) * 100 * 1.2) +
    Math.min(20, (invalidBefore / Math.max(1, beforeStats.totalRecords)) * 100 * 0.5) +
    Math.min(10, (beforeStats.formatViolations / totalCellsBefore) * 100 * 0.8);
  const initialScore = Math.max(10, Math.round((100 - beforePenalty) * 10) / 10);

  // Remaining invalid records in cleaned dataset = 0 (since invalid rows are quarantined, reported separately!)
  const remainingInvalid = 0;
  const afterPenalty =
    cleanedRecords.length === 0
      ? 0
      : Math.min(40, (afterStats.missingValues / totalCellsAfter) * 100 * 1.5) +
        Math.min(30, (afterStats.duplicateRecords / Math.max(1, cleanedRecords.length)) * 100 * 1.2) +
        Math.min(10, (afterStats.formatViolations / totalCellsAfter) * 100 * 0.8);
  const finalScore =
    cleanedRecords.length === 0 ? 0 : Math.max(10, Math.round((100 - afterPenalty) * 10) / 10);

  const { autoCleanedRecords, autoCleanedCells } = computeAutoCleanedCounts(
    headers,
    originalRecords,
    cleanedRecords,
    beforeProfile
  );

  const operationsPerformed = recommendations
    .filter((r) => enabledRules[r.id] ?? r.enabled)
    .map((r) => `${r.name} (${r.affected_column})`);

  const pctDelta = (beforeVal: number, afterVal: number, lowerIsBetter = true): string => {
    if (beforeVal === 0 && afterVal === 0) return '0% (No change)';
    if (beforeVal === 0) return `${afterVal > 0 ? '+' : ''}${afterVal}`;
    const diff = afterVal - beforeVal;
    const pct = Math.round((Math.abs(diff) / beforeVal) * 1000) / 10;
    if (diff === 0) return '0% (No change)';
    if (lowerIsBetter) {
      return diff < 0 ? `-${pct}% (${beforeVal} → ${afterVal})` : `+${pct}%`;
    }
    return diff > 0 ? `+${pct}% (${beforeVal} → ${afterVal})` : `-${pct}%`;
  };

  const scoreDiff = Math.round((finalScore - initialScore) * 10) / 10;

  const comparisonRows: BeforeAfterSnapshot['comparisonRows'] = [
    {
      metric: 'Total Records',
      before: beforeStats.totalRecords,
      after: afterStats.totalRecords,
      improvement: `${quarantinedRecords} quarantined separately`,
      note: 'Quarantined rows are isolated rather than counted as repaired',
    },
    {
      metric: 'Missing Values',
      before: beforeStats.missingValues,
      after: afterStats.missingValues,
      improvement: pctDelta(beforeStats.missingValues, afterStats.missingValues, true),
    },
    {
      metric: 'Duplicate Records',
      before: beforeStats.duplicateRecords,
      after: afterStats.duplicateRecords,
      improvement: pctDelta(beforeStats.duplicateRecords, afterStats.duplicateRecords, true),
    },
    {
      metric: 'Invalid Records',
      before: invalidBefore,
      after: remainingInvalid,
      improvement:
        invalidBefore > 0
          ? `100% isolated (${invalidBefore} → Quarantine)`
          : '0% (All valid)',
    },
    {
      metric: 'Format Errors',
      before: beforeStats.formatViolations,
      after: afterStats.formatViolations,
      improvement: pctDelta(beforeStats.formatViolations, afterStats.formatViolations, true),
    },
    {
      metric: 'Outliers',
      before: beforeStats.detectedOutliers,
      after: afterStats.detectedOutliers,
      improvement: pctDelta(beforeStats.detectedOutliers, afterStats.detectedOutliers, true),
    },
    {
      metric: 'Data Quality Score',
      before: `${initialScore}%`,
      after: `${finalScore}%`,
      improvement: `${scoreDiff >= 0 ? '+' : ''}${scoreDiff} pts`,
    },
  ];

  return {
    before: {
      totalRecords: beforeStats.totalRecords,
      missingValues: beforeStats.missingValues,
      duplicateRecords: beforeStats.duplicateRecords,
      invalidRecords: invalidBefore,
      typeInconsistencies: beforeStats.typeInconsistencies,
      formatViolations: beforeStats.formatViolations,
      detectedOutliers: beforeStats.detectedOutliers,
      qualityScore: initialScore,
    },
    after: {
      finalCleanRecords: afterStats.totalRecords,
      remainingMissingValues: afterStats.missingValues,
      remainingDuplicates: afterStats.duplicateRecords,
      remainingInvalidRecords: remainingInvalid,
      remainingFormatViolations: afterStats.formatViolations,
      remainingOutliers: afterStats.detectedOutliers,
      quarantinedRecords,
      qualityScore: finalScore,
    },
    autoCleanedRecords,
    autoCleanedCells,
    operationsPerformed,
    comparisonRows,
    generatedAt: new Date().toISOString(),
  };
}

export function computeSixDimensions(
  headers: string[],
  originalRecords: Record<string, string>[],
  cleanedRecords: Record<string, string>[],
  exceptionRecords: ExceptionItem[],
  profile: DatasetProfile | null,
  weights: QualityWeightsConfig
): SixDimensionItem[] {
  if (!profile || originalRecords.length === 0) {
    return [];
  }

  const totalRows = originalRecords.length;
  const totalCols = Math.max(1, headers.length);
  const totalCells = totalRows * totalCols;

  // 1. Completeness (non-null cells in active original dataset)
  const nonMissingCells = Math.max(0, totalCells - profile.total_missing_cells);
  const completenessPct = Math.round((nonMissingCells / totalCells) * 1000) / 10;
  const missingColProblems = profile.columns
    .filter((c) => c.missing_count > 0)
    .map((c) => `${c.column_name}: ${c.missing_count} missing (${c.missing_percentage}%)`);

  // 2. Accuracy — ONLY claimed when verifiable math equation or positive-range ground truth applies
  const hasMathFormula =
    headers.includes('quantity') && headers.includes('unit_price') && headers.includes('total_amount');
  const mathExceptions = exceptionRecords.filter((e) => e.violation_type === 'MATHEMATICAL_DISCREPANCY');
  const rangeExceptions = exceptionRecords.filter(
    (e) => e.violation_type === 'NEGATIVE_VALUE_ERROR' || e.violation_type === 'NEGATIVE_STOCK'
  );
  const accuracyVerifiable = hasMathFormula || rangeExceptions.length > 0;
  let accuracyPct: number | null = null;
  const accuracyProblems: string[] = [];
  if (accuracyVerifiable) {
    const accuracyFailures = new Set([...mathExceptions, ...rangeExceptions].map((e) => e.row_number)).size;
    accuracyPct = Math.round(((totalRows - accuracyFailures) / totalRows) * 1000) / 10;
    if (mathExceptions.length > 0) {
      accuracyProblems.push(`${mathExceptions.length} cross-field total_amount formula discrepancies`);
    }
    if (rangeExceptions.length > 0) {
      accuracyProblems.push(`${rangeExceptions.length} negative price/stock/age domain violations`);
    }
  } else {
    accuracyProblems.push('No external ground-truth reference dataset or cross-field formula configured.');
  }

  // 3. Consistency — uniformity of formats (dates, casing, whitespace, currency) across rows
  const stats = countDatasetStatistics(headers, originalRecords, profile);
  const inconsistentRate = Math.min(1, stats.formatViolations / totalCells);
  const consistencyPct = Math.round((1 - inconsistentRate) * 1000) / 10;
  const consistencyProblems: string[] = [];
  if (stats.formatViolations > 0) {
    consistencyProblems.push(`${stats.formatViolations} cells with unstandardized casing, spacing, currency, or non-ISO dates`);
  }

  // 4. Validity — rows without format/type/validation exceptions
  const formatTypeExceptions = exceptionRecords.filter((e) =>
    ['INVALID_EMAIL_FORMAT', 'INVALID_DATE_FORMAT', 'INVALID_PHONE_NUMBER', 'TYPE_CAST_FAILURE'].includes(
      e.violation_type
    )
  );
  const invalidFormatRowCount = new Set(formatTypeExceptions.map((e) => e.row_number)).size;
  const validityPct = Math.round(((totalRows - invalidFormatRowCount) / totalRows) * 1000) / 10;
  const validityProblems = Array.from(
    new Set(formatTypeExceptions.map((e) => `${e.field_name}: ${e.violation_type}`))
  );

  // 5. Uniqueness — unique rows & primary identifiers
  const dupPkCount = exceptionRecords.filter((e) => e.violation_type === 'DUPLICATE_IDENTIFIER').length;
  const dupRowCount = profile.duplicate_rows_count;
  const totalDups = Math.min(totalRows, Math.max(dupRowCount, dupPkCount));
  const uniquenessPct = Math.round(((totalRows - totalDups) / totalRows) * 1000) / 10;
  const uniquenessProblems: string[] = [];
  if (dupRowCount > 0) uniquenessProblems.push(`${dupRowCount} exact duplicate rows detected`);
  if (dupPkCount > 0) uniquenessProblems.push(`${dupPkCount} duplicate primary key values detected`);

  // 6. Timeliness — ONLY scored if dataset contains valid date/timestamp columns
  const dateCols = profile.columns.filter(
    (c) =>
      c.semantic_type === 'date' ||
      ['date', 'dob', 'doj', 'admission', 'discharge', 'timestamp'].some((k) =>
        c.normalized_name.includes(k)
      )
  );
  let timelinessVerifiable = dateCols.length > 0;
  let timelinessPct: number | null = null;
  const timelinessProblems: string[] = [];
  if (timelinessVerifiable) {
    const today = new Date();
    let totalDateVals = 0;
    let timelyDateVals = 0;
    let futureDates = 0;
    let invalidDates = 0;
    for (const dc of dateCols) {
      for (const r of originalRecords) {
        const raw = String(r[dc.column_name] ?? '').trim();
        if (NULL_TOKENS.has(raw.toLowerCase())) continue;
        totalDateVals++;
        const { normalized } = parseAndNormalizeDate(raw);
        if (!normalized) {
          invalidDates++;
        } else {
          const parsed = new Date(`${normalized}T00:00:00Z`);
          if (parsed > today) {
            futureDates++;
          } else {
            timelyDateVals++;
          }
        }
      }
    }
    if (totalDateVals === 0) {
      timelinessVerifiable = false;
      timelinessProblems.push('Date columns contain no parseable timestamp values.');
    } else {
      timelinessPct = Math.round((timelyDateVals / totalDateVals) * 1000) / 10;
      if (futureDates > 0) timelinessProblems.push(`${futureDates} future-dated records beyond current date`);
      if (invalidDates > 0) timelinessProblems.push(`${invalidDates} unparseable date values`);
    }
  } else {
    timelinessProblems.push('No date or timestamp column present in schema.');
  }

  const getStatus = (
    pct: number | null,
    verifiable: boolean,
    naLabel: 'Not Verifiable' | 'Not Applicable'
  ): SixDimensionItem['status'] => {
    if (!verifiable || pct === null) return naLabel;
    if (pct >= 90) return 'Healthy';
    if (pct >= 75) return 'Warning';
    return 'Critical';
  };

  return [
    {
      key: 'completeness',
      label: 'Completeness',
      percentage: completenessPct,
      verifiable: true,
      status: getStatus(completenessPct, true, 'Not Applicable'),
      identifiedProblems: missingColProblems.length ? missingColProblems : ['No missing cells detected.'],
      methodology: '(Total Non-Null Cells ÷ Total Expected Cells) × 100',
      formulaNote: `${nonMissingCells} / ${totalCells} populated cells across ${cleanedRecords.length + Math.max(0, totalRows - cleanedRecords.length)} records`,
      weight: weights.completeness,
    },
    {
      key: 'accuracy',
      label: 'Accuracy',
      percentage: accuracyPct,
      verifiable: accuracyVerifiable,
      status: getStatus(accuracyPct, accuracyVerifiable, 'Not Verifiable'),
      identifiedProblems: accuracyProblems,
      methodology: accuracyVerifiable
        ? 'Verified against cross-field mathematical equations and non-negative domain invariants'
        : 'Requires external reference dataset or verifiable business calculation formula',
      formulaNote: accuracyVerifiable
        ? 'Rows passing invoice math & range invariants ÷ Total rows'
        : 'Unverifiable without reference data',
      weight: weights.accuracy,
    },
    {
      key: 'consistency',
      label: 'Consistency',
      percentage: consistencyPct,
      verifiable: true,
      status: getStatus(consistencyPct, true, 'Not Applicable'),
      identifiedProblems: consistencyProblems.length ? consistencyProblems : ['All cells follow uniform formatting.'],
      methodology: '100 − (Format/Casing/Delimiter Variance Cells ÷ Total Cells) × 100',
      formulaNote: `${stats.formatViolations} raw format inconsistencies detected before normalization`,
      weight: weights.consistency,
    },
    {
      key: 'validity',
      label: 'Validity',
      percentage: validityPct,
      verifiable: true,
      status: getStatus(validityPct, true, 'Not Applicable'),
      identifiedProblems: validityProblems.length ? validityProblems : ['All fields satisfy syntactic & type constraints.'],
      methodology: '(Records Passing Type, Email, Date & Phone Validators ÷ Total Records) × 100',
      formulaNote: `${invalidFormatRowCount} rows flagged with syntax or type failures`,
      weight: weights.validity,
    },
    {
      key: 'uniqueness',
      label: 'Uniqueness',
      percentage: uniquenessPct,
      verifiable: true,
      status: getStatus(uniquenessPct, true, 'Not Applicable'),
      identifiedProblems: uniquenessProblems.length ? uniquenessProblems : ['All entity keys and rows are unique.'],
      methodology: '((Total Records − Duplicate Rows/Keys) ÷ Total Records) × 100',
      formulaNote: `${totalDups} duplicate rows or primary keys detected`,
      weight: weights.uniqueness,
    },
    {
      key: 'timeliness',
      label: 'Timeliness',
      percentage: timelinessPct,
      verifiable: timelinessVerifiable,
      status: getStatus(timelinessPct, timelinessVerifiable, 'Not Applicable'),
      identifiedProblems: timelinessProblems.length ? timelinessProblems : ['All parsed dates fall within valid historical bounds.'],
      methodology: timelinessVerifiable
        ? '(Valid Historical Dates ≤ Reference Date ÷ Total Date Values) × 100'
        : 'Requires a valid date or timestamp column in the dataset',
      formulaNote: timelinessVerifiable
        ? `Evaluated across column(s): ${dateCols.map((d) => d.column_name).join(', ')}`
        : 'No timestamp column detected',
      weight: weights.timeliness,
    },
  ];
}
