export type NavPageId =
  | 'dashboard'
  | 'studio'
  | 'taxonomy'
  | 'profiling'
  | 'cleaning'
  | 'validation'
  | 'exceptions'
  | 'monitoring'
  | 'comparison'
  | 'quality-reports'
  | 'audit-logs'
  | 'settings';

export interface ColumnProfile {
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

export interface DatasetProfile {
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
  columns: ColumnProfile[];
}

export interface CleaningRecommendation {
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

export interface EngineSummary {
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
  auto_cleaned_records?: number;
  auto_cleaned_cells?: number;
}

export interface ExceptionItem {
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

export interface SamplePreset {
  id: string;
  name: string;
  domain: string;
  filename: string;
  description: string;
  recordCount: number;
}

export interface BeforeAfterSnapshot {
  before: {
    totalRecords: number;
    missingValues: number;
    duplicateRecords: number;
    invalidRecords: number;
    typeInconsistencies: number;
    formatViolations: number;
    detectedOutliers: number;
    qualityScore: number;
  };
  after: {
    finalCleanRecords: number;
    remainingMissingValues: number;
    remainingDuplicates: number;
    remainingInvalidRecords: number;
    remainingFormatViolations: number;
    remainingOutliers: number;
    quarantinedRecords: number;
    qualityScore: number;
  };
  autoCleanedRecords: number;
  autoCleanedCells: number;
  operationsPerformed: string[];
  comparisonRows: Array<{
    metric: string;
    before: number | string;
    after: number | string;
    improvement: string;
    note?: string;
  }>;
  generatedAt: string;
}

export interface QualityWeightsConfig {
  completeness: number;
  validity: number;
  consistency: number;
  uniqueness: number;
  accuracy: number;
  timeliness: number;
}

export interface SixDimensionItem {
  key: 'completeness' | 'accuracy' | 'consistency' | 'validity' | 'uniqueness' | 'timeliness';
  label: string;
  percentage: number | null;
  verifiable: boolean;
  status: 'Healthy' | 'Warning' | 'Critical' | 'Not Verifiable' | 'Not Applicable';
  identifiedProblems: string[];
  methodology: string;
  formulaNote: string;
  weight: number;
}

export interface ProcessingRunRecord {
  id: string;
  timestamp: string;
  datasetName: string;
  fileFormat: 'CSV' | 'XLSX' | 'XLS';
  domainKey: string;
  domainTitle: string;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  quarantinedRecords: number;
  duplicateRecords: number;
  missingValuesDetected: number;
  autoCleanedRecords: number;
  dataQualityScore: number;
  afterQualityScore: number;
  executionTimeMs: number;
  status: 'Completed' | 'Completed with Exceptions';
  errorsByCategory: Record<string, number>;
  missingByColumn: Array<{ column: string; count: number }>;
  operationsCount: number;
  dimensionsSummary: Record<string, number | null>;
}

export interface ReportHistoryRecord {
  id: string;
  timestamp: string;
  datasetName: string;
  format: 'PDF' | 'EXCEL' | 'CSV_CLEAN' | 'CSV_EXCEPTIONS';
  recordCount: number;
  quarantinedCount: number;
  qualityScoreAfter: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  status: 'SUCCESS' | 'WARNING' | 'BLOCKED';
  details: string;
}

export interface AppNotification {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  read: boolean;
}

export interface WorkspaceSettings {
  maxUploadMb: number;
  quarantineStrictness: 'strict' | 'standard';
  scoringWeights: QualityWeightsConfig;
}
