import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Database,
  BookOpen,
  BarChart3,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Activity,
  GitCompare,
  FileText,
  History,
  Settings as SettingsIcon,
  Users,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Bell,
  Download,
  ChevronDown,
  Upload,
  FileCheck,
  Play,
  RotateCw,
  Check,
  CheckSquare,
  Square,
  ArrowRight,
  Terminal,
  Search,
  Filter,
  Eye,
  Copy,
  GraduationCap,
  Package,
  ShoppingCart,
  HeartPulse,
  DollarSign,
  FileSpreadsheet,
} from 'lucide-react';
import { SAMPLE_PRESETS, SAMPLE_CSV_MAP } from './data/sampleDatasets';
import {
  parseCSVContent,
  profileDatasetClient,
  cleanDatasetClient,
} from './utils/clientEngine';
import {
  validateAndExtractTabularFile,
  validateCSVTextStructure,
} from './utils/fileValidator';
import {
  computeAutoCleanedCounts,
  computeBeforeAfterComparison,
  computeSixDimensions,
} from './utils/analytics';
import {
  downloadQualityReportExcel,
  downloadQualityReportPDF,
} from './utils/reportGenerator';
import {
  AppNotification,
  AuditLogEntry,
  BeforeAfterSnapshot,
  CleaningRecommendation,
  DatasetProfile,
  EngineSummary,
  ExceptionItem,
  NavPageId,
  ProcessingRunRecord,
  ReportHistoryRecord,
  SamplePreset,
  WorkspaceSettings,
} from './types/idata';
import { UnsupportedFileModal } from './components/UnsupportedFileModal';
import { SplashScreen } from './components/SplashScreen';
import { DashboardView } from './components/DashboardView';
import { QualityMonitoringView } from './components/QualityMonitoringView';
import { DatasetComparisonView } from './components/DatasetComparisonView';
import {
  DataCleaningView,
  DataProfilingView,
  DataValidationView,
  ExceptionManagementView,
  SchemaTaxonomyView,
} from './components/DataManagementViews';
import {
  AuditLogsView,
  ReportsView,
  SettingsView,
} from './components/ReportsAndSystemViews';

const STORAGE_KEYS = {
  runs: 'idata_v25_runs',
  reports: 'idata_v25_reports',
  audits: 'idata_v25_audits',
  settings: 'idata_v25_settings',
};

const DEFAULT_SETTINGS: WorkspaceSettings = {
  maxUploadMb: 10,
  quarantineStrictness: 'strict',
  scoringWeights: {
    completeness: 25,
    validity: 25,
    consistency: 15,
    uniqueness: 15,
    accuracy: 10,
    timeliness: 10,
  },
};

function safeLoadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export default function App() {
  // Startup Splash Screen State
  const [showSplash, setShowSplash] = useState<boolean>(true);

  // Navigation & Chrome State
  const [activePage, setActivePage] = useState<NavPageId>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);

  // Engine Operational Health
  const [engineHealthy, setEngineHealthy] = useState<boolean>(true);
  const [processingStatus, setProcessingStatus] = useState<'Idle' | 'Profiling' | 'Processing' | 'Validated'>('Idle');

  // Active Dataset & Preserved Original State
  const [inputMode, setInputMode] = useState<'sample' | 'upload' | 'paste'>('sample');
  const [selectedSampleId, setSelectedSampleId] = useState<string>('orders');
  const [samplePresets, setSamplePresets] = useState<SamplePreset[]>(SAMPLE_PRESETS);
  const [fileName, setFileName] = useState<string>('orders_raw.csv');
  const [activeFormat, setActiveFormat] = useState<'CSV' | 'XLSX' | 'XLS'>('CSV');
  const [csvContent, setCsvContent] = useState<string>('');
  const [originalRecords, setOriginalRecords] = useState<Record<string, string>[]>([]);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profiler & Cleaning Configuration State
  const [isProfiling, setIsProfiling] = useState<boolean>(false);
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [recommendations, setRecommendations] = useState<CleaningRecommendation[]>([]);
  const [enabledRuleMap, setEnabledRuleMap] = useState<Record<string, boolean>>({});

  // Validation Output State
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [summary, setSummary] = useState<EngineSummary | null>(null);
  const [cleanRecords, setCleanRecords] = useState<Record<string, string>[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [comparisonSnapshot, setComparisonSnapshot] = useState<BeforeAfterSnapshot | null>(null);
  const [engineLogs, setEngineLogs] = useState<string>('');
  const [showLogs, setShowLogs] = useState<boolean>(false);

  // Studio Output Filters & Detail Inspector
  const [outputView, setOutputView] = useState<'clean' | 'exceptions'>('clean');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [exceptionTypeFilter, setExceptionTypeFilter] = useState<string>('ALL');
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<any | null>(null);
  const [copiedDetail, setCopiedDetail] = useState<boolean>(false);

  // Unsupported File Modal State
  const [unsupportedModal, setUnsupportedModal] = useState<{
    isOpen: boolean;
    fileName?: string;
    reason?: string;
  }>({ isOpen: false });

  // Real Enterprise Telemetry & Governance State (Zero Fake Data)
  const [runs, setRuns] = useState<ProcessingRunRecord[]>(() => safeLoadStorage(STORAGE_KEYS.runs, []));
  const [reports, setReports] = useState<ReportHistoryRecord[]>(() => safeLoadStorage(STORAGE_KEYS.reports, []));
  const [audits, setAudits] = useState<AuditLogEntry[]>(() => safeLoadStorage(STORAGE_KEYS.audits, []));
  const [settings, setSettings] = useState<WorkspaceSettings>(() =>
    safeLoadStorage(STORAGE_KEYS.settings, DEFAULT_SETTINGS)
  );
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Safe JSON fetch helper (returns null if backend unavailable or returns HTML on static hosts)
  const fetchJsonSafe = async <T = any>(url: string, init?: RequestInit): Promise<T | null> => {
    try {
      const res = await fetch(url, init);
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  };

  // Persist history to localStorage + backend when available
  const persistTelemetry = async (
    nextRuns: ProcessingRunRecord[],
    nextReports: ReportHistoryRecord[],
    nextAudits: AuditLogEntry[]
  ) => {
    try {
      localStorage.setItem(STORAGE_KEYS.runs, JSON.stringify(nextRuns));
      localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(nextReports));
      localStorage.setItem(STORAGE_KEYS.audits, JSON.stringify(nextAudits));
    } catch {
      // Ignore quota issues
    }
    await fetchJsonSafe('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runs: nextRuns, reports: nextReports, audits: nextAudits }),
    });
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const addNotification = (
    title: string,
    message: string,
    type: AppNotification['type'] = 'info'
  ) => {
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        title,
        message,
        type,
        read: false,
      },
      ...prev.slice(0, 19),
    ]);
  };

  const appendAudit = (
    action: string,
    target: string,
    status: AuditLogEntry['status'],
    details: string,
    currentRuns = runs,
    currentReports = reports
  ) => {
    const entry: AuditLogEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      actor: 'System Operator',
      action,
      target,
      status,
      details,
    };
    const nextAudits = [entry, ...audits].slice(0, 200);
    setAudits(nextAudits);
    persistTelemetry(currentRuns, currentReports, nextAudits);
    return nextAudits;
  };

  // Initial Load: Health check, Backend History Sync, and Initial Sample Dataset Profile
  useEffect(() => {
    const init = async () => {
      const health = await fetchJsonSafe<{ status: string; maxUploadMb?: number }>('/api/health');
      setEngineHealthy(health ? health.status === 'healthy' : true);

      const historyData = await fetchJsonSafe<{
        runs: ProcessingRunRecord[];
        reports: ReportHistoryRecord[];
        audits: AuditLogEntry[];
      }>('/api/history');
      if (historyData && (historyData.runs.length > 0 || historyData.reports.length > 0 || historyData.audits.length > 0)) {
        if (historyData.runs.length > runs.length) setRuns(historyData.runs);
        if (historyData.reports.length > reports.length) setReports(historyData.reports);
        if (historyData.audits.length > audits.length) setAudits(historyData.audits);
      }

      const presets = await fetchJsonSafe<SamplePreset[]>('/api/sample-datasets');
      if (Array.isArray(presets) && presets.length > 0) {
        setSamplePresets(presets);
      } else {
        setSamplePresets(SAMPLE_PRESETS);
      }

      await loadSamplePreset('orders', false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSamplePreset = async (presetId: string, recordAudit = true) => {
    setSelectedSampleId(presetId);
    setInputMode('sample');
    setActiveFormat('CSV');
    setSummary(null);
    setCleanRecords([]);
    setExceptions([]);
    setComparisonSnapshot(null);

    const apiData = await fetchJsonSafe<{ content: string; records?: Record<string, string>[] }>(
      `/api/sample-datasets/${presetId}`
    );

    const presetMeta = SAMPLE_PRESETS.find((p) => p.id === presetId) || SAMPLE_PRESETS[0];
    const resolvedContent = apiData?.content || SAMPLE_CSV_MAP[presetId] || SAMPLE_CSV_MAP.orders;
    const parsedRecords = apiData?.records || parseCSVContent(resolvedContent).records;

    setFileName(presetMeta.filename);
    setCsvContent(resolvedContent);
    setOriginalRecords(parsedRecords);

    if (recordAudit) {
      appendAudit(
        'PRESET_SELECTED',
        presetMeta.filename,
        'SUCCESS',
        `Loaded benchmark dataset (${parsedRecords.length} records)`
      );
    }

    await analyzeDataset(resolvedContent);
  };

  const analyzeDataset = async (content: string) => {
    if (!content.trim()) return;
    setIsProfiling(true);
    setProcessingStatus('Profiling');
    try {
      const apiData = await fetchJsonSafe<{
        profile: DatasetProfile;
        recommendations: CleaningRecommendation[];
      }>('/api/profile-dataset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: content }),
      });

      const resolved =
        apiData && apiData.profile ? apiData : profileDatasetClient(content);

      setProfile(resolved.profile);
      setRecommendations(resolved.recommendations || []);
      const ruleMap: Record<string, boolean> = {};
      (resolved.recommendations || []).forEach((r) => {
        ruleMap[r.id] = r.enabled;
      });
      setEnabledRuleMap(ruleMap);
      setProcessingStatus('Idle');
    } catch (e) {
      console.error('Profiling error:', e);
      setProcessingStatus('Idle');
    } finally {
      setIsProfiling(false);
    }
  };

  // Strict Upload Processing (.csv, .xlsx, .xls ONLY; client + backend signature verification)
  const processUploadedFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();

      // 1. Client-side immediate validation (extension, magic bytes, size, corruption)
      const clientCheck = validateAndExtractTabularFile(file.name, buffer, settings.maxUploadMb);
      if (!clientCheck.ok || !clientCheck.csvContent) {
        setUnsupportedModal({
          isOpen: true,
          fileName: file.name,
          reason: clientCheck.reason,
        });
        appendAudit(
          'UPLOAD_BLOCKED',
          file.name,
          'BLOCKED',
          clientCheck.reason || 'Unsupported file format rejected.'
        );
        addNotification(
          'Unsupported File Format',
          `Blocked "${file.name}". Only .csv, .xlsx, and .xls files are accepted.`,
          'error'
        );
        return;
      }

      // 2. Backend signature validation when Express server is available
      try {
        const res = await fetch('/api/upload-validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            base64Data: arrayBufferToBase64(buffer),
            maxUploadMb: settings.maxUploadMb,
          }),
        });
        const ct = res.headers.get('content-type') || '';
        if (ct.toLowerCase().includes('application/json')) {
          const backendResult = await res.json();
          if (!res.ok || !backendResult.ok) {
            setUnsupportedModal({
              isOpen: true,
              fileName: file.name,
              reason: backendResult.reason || 'Rejected by backend file signature verifier.',
            });
            appendAudit(
              'UPLOAD_BLOCKED_SERVER',
              file.name,
              'BLOCKED',
              backendResult.reason || 'Backend rejected upload.'
            );
            return;
          }
        }
      } catch {
        // Static deployment mode (Netlify): clientCheck already validated signature & content
      }

      const parsed = parseCSVContent(clientCheck.csvContent);
      setFileName(file.name);
      setActiveFormat(clientCheck.format || 'CSV');
      setInputMode('upload');
      setCsvContent(clientCheck.csvContent);
      setOriginalRecords(parsed.records);
      setSummary(null);
      setCleanRecords([]);
      setExceptions([]);
      setComparisonSnapshot(null);

      appendAudit(
        'UPLOAD_ACCEPTED',
        file.name,
        'SUCCESS',
        `Validated ${clientCheck.format} (${parsed.records.length} rows, ${(file.size / 1024).toFixed(1)} KB)`
      );
      addNotification(
        'Dataset Loaded',
        `${file.name} (${parsed.records.length} rows) passed format & signature checks.`,
        'info'
      );

      await analyzeDataset(clientCheck.csvContent);
    } catch (err: any) {
      setUnsupportedModal({
        isOpen: true,
        fileName: file.name,
        reason: err?.message || 'Unable to parse uploaded file.',
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processUploadedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handlePasteContentChange = (text: string) => {
    setCsvContent(text);
    const check = validateCSVTextStructure(text);
    if (check.ok) {
      setFileName('pasted_dataset.csv');
      setActiveFormat('CSV');
      setOriginalRecords(parseCSVContent(text).records);
      setSummary(null);
      setCleanRecords([]);
      setExceptions([]);
      setComparisonSnapshot(null);
      analyzeDataset(text);
    }
  };

  const toggleRecommendation = (id: string) => {
    setEnabledRuleMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Compute Six Dimensions dynamically from actual dataset & exceptions
  const sixDimensions = useMemo(() => {
    if (!profile) return [];
    return computeSixDimensions(
      profile.headers,
      originalRecords,
      cleanRecords,
      exceptions,
      profile,
      settings.scoringWeights
    );
  }, [profile, originalRecords, cleanRecords, exceptions, settings.scoringWeights]);

  // Execute Cleaning & Validation Pipeline (Records actual telemetry to Dashboard & Comparison)
  const handleExecutePipeline = async () => {
    const contentToSend = csvContent.trim();
    if (!contentToSend) return;

    setIsValidating(true);
    setProcessingStatus('Processing');
    const startTime = performance.now();

    try {
      const apiData = await fetchJsonSafe<{
        summary: EngineSummary;
        profile: DatasetProfile;
        cleanedRecords: Record<string, string>[];
        exceptionRecords: ExceptionItem[];
      }>('/api/universal-clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent: contentToSend,
          enabledRules: enabledRuleMap,
        }),
      });

      const usedBackend = Boolean(apiData && apiData.summary);
      const data = usedBackend
        ? apiData!
        : cleanDatasetClient(contentToSend, enabledRuleMap);

      const resolvedProfile = data.profile || profile;
      const parsedOriginal = parseCSVContent(contentToSend).records;
      const cleanOut = data.cleanedRecords || [];
      const excOut = data.exceptionRecords || [];

      setOriginalRecords(parsedOriginal);
      if (resolvedProfile) setProfile(resolvedProfile);
      setCleanRecords(cleanOut);
      setExceptions(excOut);

      let snapshot: BeforeAfterSnapshot | null = null;
      let autoCounts = { autoCleanedRecords: 0, autoCleanedCells: 0 };

      if (resolvedProfile) {
        snapshot = computeBeforeAfterComparison(
          resolvedProfile.headers,
          parsedOriginal,
          cleanOut,
          excOut,
          resolvedProfile,
          recommendations,
          enabledRuleMap
        );
        setComparisonSnapshot(snapshot);
        autoCounts = computeAutoCleanedCounts(
          resolvedProfile.headers,
          parsedOriginal,
          cleanOut,
          resolvedProfile
        );
      }

      const elapsed = Math.round((performance.now() - startTime) * 100) / 100;
      const enrichedSummary: EngineSummary = {
        ...data.summary,
        execution_time_ms: data.summary?.execution_time_ms || elapsed,
        auto_cleaned_records: autoCounts.autoCleanedRecords,
        auto_cleaned_cells: autoCounts.autoCleanedCells,
      };
      setSummary(enrichedSummary);

      setEngineLogs(
        `[UNIVERSAL ENGINE] Processing completed in ${enrichedSummary.execution_time_ms}ms\n` +
          `[DOMAIN DETECTED] ${enrichedSummary.domain_detected || 'General Tabular'}\n` +
          `[DATASET PROFILE] ${resolvedProfile?.total_rows || 0} rows, ${resolvedProfile?.total_columns || 0} columns analyzed\n` +
          `[PARTITIONING] ${cleanOut.length} Clean Warehouse Records (Pass Rate: ${enrichedSummary.pass_rate_pct}%)\n` +
          `[QUARANTINE] ${enrichedSummary.quarantined_records} Records isolated to Exception Register (${excOut.length} exception entries)\n` +
          `[AUTO-CLEANED] ${autoCounts.autoCleanedRecords} records (${autoCounts.autoCleanedCells} cells standardized)\n` +
          `[RUNTIME] ${usedBackend ? 'Python 3 Validation Engine' : 'Static Client Engine Fallback'}`
      );

      // Record real historical run
      if (resolvedProfile) {
        const errorsByCat: Record<string, number> = {};
        for (const ex of excOut) {
          errorsByCat[ex.violation_type] = (errorsByCat[ex.violation_type] || 0) + 1;
        }
        const dims = computeSixDimensions(
          resolvedProfile.headers,
          parsedOriginal,
          cleanOut,
          excOut,
          resolvedProfile,
          settings.scoringWeights
        );
        const dimMap: Record<string, number | null> = {};
        dims.forEach((d) => {
          dimMap[d.key] = d.percentage;
        });

        const newRun: ProcessingRunRecord = {
          id: `run-${Date.now()}`,
          timestamp: new Date().toISOString(),
          datasetName: fileName,
          fileFormat: activeFormat,
          domainKey: resolvedProfile.domain_key,
          domainTitle: resolvedProfile.domain_title,
          totalRecords: enrichedSummary.total_records,
          validRecords: enrichedSummary.valid_records,
          invalidRecords: enrichedSummary.quarantined_records,
          quarantinedRecords: enrichedSummary.quarantined_records,
          duplicateRecords: enrichedSummary.duplicate_records,
          missingValuesDetected: resolvedProfile.total_missing_cells,
          autoCleanedRecords: autoCounts.autoCleanedRecords,
          dataQualityScore: snapshot ? snapshot.before.qualityScore : resolvedProfile.data_quality_score,
          afterQualityScore: snapshot ? snapshot.after.qualityScore : resolvedProfile.data_quality_score,
          executionTimeMs: enrichedSummary.execution_time_ms,
          status:
            enrichedSummary.quarantined_records === 0
              ? 'Completed'
              : 'Completed with Exceptions',
          errorsByCategory: errorsByCat,
          missingByColumn: resolvedProfile.columns.map((c) => ({
            column: c.column_name,
            count: c.missing_count,
          })),
          operationsCount: recommendations.filter((r) => enabledRuleMap[r.id] ?? r.enabled).length,
          dimensionsSummary: dimMap,
        };

        const nextRuns = [newRun, ...runs].slice(0, 100);
        setRuns(nextRuns);

        const auditEntry: AuditLogEntry = {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: 'System Operator',
          action: 'VALIDATION_EXECUTED',
          target: fileName,
          status: enrichedSummary.quarantined_records === 0 ? 'SUCCESS' : 'WARNING',
          details: `${enrichedSummary.valid_records} clean · ${enrichedSummary.quarantined_records} quarantined · ${autoCounts.autoCleanedRecords} auto-cleaned`,
        };
        const nextAudits = [auditEntry, ...audits].slice(0, 200);
        setAudits(nextAudits);
        persistTelemetry(nextRuns, reports, nextAudits);
      }

      setProcessingStatus('Validated');
      setOutputView('clean');
      addNotification(
        'Validation Completed',
        `${fileName}: ${cleanOut.length} clean records, ${enrichedSummary.quarantined_records} quarantined.`,
        enrichedSummary.quarantined_records > 0 ? 'warning' : 'success'
      );
    } catch (e) {
      console.error('Validation error:', e);
      setProcessingStatus('Idle');
    } finally {
      setIsValidating(false);
    }
  };

  const handleGenerateQualityComparison = () => {
    if (!summary || !profile) {
      handleExecutePipeline();
      return;
    }
    const snapshot = computeBeforeAfterComparison(
      profile.headers,
      originalRecords,
      cleanRecords,
      exceptions,
      profile,
      recommendations,
      enabledRuleMap
    );
    setComparisonSnapshot(snapshot);
    addNotification('Quality Comparison Refreshed', `Updated Before & After matrix for ${fileName}.`, 'info');
  };

  const recordReportExport = (format: ReportHistoryRecord['format']) => {
    const newRep: ReportHistoryRecord = {
      id: `rep-${Date.now()}`,
      timestamp: new Date().toISOString(),
      datasetName: fileName,
      format,
      recordCount: cleanRecords.length,
      quarantinedCount: summary?.quarantined_records ?? exceptions.length,
      qualityScoreAfter: comparisonSnapshot?.after.qualityScore ?? profile?.data_quality_score ?? 0,
    };
    const nextReports = [newRep, ...reports].slice(0, 100);
    setReports(nextReports);
    appendAudit('REPORT_EXPORTED', fileName, 'SUCCESS', `Exported ${format} report`, runs, nextReports);
  };

  const handleDownloadPDFReport = () => {
    if (!profile || !comparisonSnapshot) return;
    downloadQualityReportPDF({
      datasetName: fileName,
      fileFormat: activeFormat,
      profile,
      comparison: comparisonSnapshot,
      dimensions: sixDimensions,
      cleanedRecords: cleanRecords,
      exceptionRecords: exceptions,
      passRatePct: summary?.pass_rate_pct ?? 0,
    });
    recordReportExport('PDF');
    addNotification('PDF Report Downloaded', `Generated PDF Quality Report for ${fileName}.`, 'success');
  };

  const handleDownloadExcelReport = () => {
    if (!profile || !comparisonSnapshot) return;
    downloadQualityReportExcel({
      datasetName: fileName,
      fileFormat: activeFormat,
      profile,
      comparison: comparisonSnapshot,
      dimensions: sixDimensions,
      cleanedRecords: cleanRecords,
      exceptionRecords: exceptions,
      passRatePct: summary?.pass_rate_pct ?? 0,
    });
    recordReportExport('EXCEL');
    addNotification('Excel Report Downloaded', `Generated multi-sheet Excel Quality Report for ${fileName}.`, 'success');
  };

  const downloadCSV = (content: any[], downloadName: string, kind: 'CSV_CLEAN' | 'CSV_EXCEPTIONS') => {
    if (!content || content.length === 0) return;
    const headers = Object.keys(content[0]);
    const csvRows = [
      headers.join(','),
      ...content.map((row) =>
        headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', downloadName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    recordReportExport(kind);
  };

  const handleClearHistory = () => {
    setRuns([]);
    setReports([]);
    setAudits([]);
    persistTelemetry([], [], []);
    addNotification('History Cleared', 'Stored telemetry runs, reports, and audit logs have been reset.', 'info');
  };

  const filteredExceptions = exceptions.filter((item) => {
    const matchesFilter = exceptionTypeFilter === 'ALL' || item.violation_type === exceptionTypeFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      q === '' ||
      item.record_id?.toLowerCase().includes(q) ||
      item.field_name?.toLowerCase().includes(q) ||
      item.error_message?.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const filteredClean = cleanRecords.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(item).some((val) => String(val).toLowerCase().includes(q));
  });

  const getDomainIcon = (domainKey: string = '') => {
    switch (domainKey) {
      case 'COLLEGE_STUDENT':
      case 'STUDENTS':
        return <GraduationCap className="w-4 h-4 text-[#3659B8]" />;
      case 'EMPLOYEE_HR':
      case 'EMPLOYEES':
        return <Users className="w-4 h-4 text-[#3659B8]" />;
      case 'PRODUCT_INVENTORY':
      case 'PRODUCTS':
        return <Package className="w-4 h-4 text-[#3659B8]" />;
      case 'ECOMMERCE_ORDER':
      case 'ORDERS':
        return <ShoppingCart className="w-4 h-4 text-[#3659B8]" />;
      case 'HEALTHCARE_PATIENT':
      case 'HEALTHCARE':
        return <HeartPulse className="w-4 h-4 text-[#3659B8]" />;
      case 'BANKING_FINANCE':
        return <DollarSign className="w-4 h-4 text-[#3659B8]" />;
      default:
        return <Activity className="w-4 h-4 text-[#3659B8]" />;
    }
  };

  // Exact Required Sidebar Structure
  const sidebarGroups: Array<{
    group: string;
    items: Array<{ id: NavPageId; label: string; icon: React.ComponentType<{ className?: string }> }>;
  }> = [
    {
      group: 'OVERVIEW',
      items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }],
    },
    {
      group: 'DATA MANAGEMENT',
      items: [
        { id: 'studio', label: 'CSV Engine Studio', icon: Database },
        { id: 'taxonomy', label: 'Schema Taxonomy', icon: BookOpen },
        { id: 'profiling', label: 'Data Profiling', icon: BarChart3 },
        { id: 'cleaning', label: 'Data Cleaning', icon: Sparkles },
        { id: 'validation', label: 'Data Validation', icon: ShieldCheck },
        { id: 'exceptions', label: 'Exception Management', icon: AlertTriangle },
      ],
    },
    {
      group: 'DATA QUALITY',
      items: [
        { id: 'monitoring', label: 'Quality Monitoring', icon: Activity },
        { id: 'comparison', label: 'Dataset Comparison', icon: GitCompare },
        { id: 'quality-reports', label: 'Data Quality Reports', icon: FileText },
      ],
    },
    {
      group: 'REPORTS & AUDIT',
      items: [
        { id: 'audit-logs', label: 'Audit Logs', icon: History },
      ],
    },
    {
      group: 'SYSTEM',
      items: [
        { id: 'settings', label: 'Settings', icon: SettingsIcon },
      ],
    },
  ];

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#172554] flex flex-col font-sans">
      {showSplash && (
        <SplashScreen
          engineHealthy={engineHealthy}
          onComplete={() => setShowSplash(false)}
        />
      )}
      <div className="flex-1 flex flex-row min-h-screen relative">
        {/* Mobile Sidebar Backdrop */}
        {isMobileSidebarOpen && (
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-[#171653]/60 z-40 lg:hidden"
          />
        )}

        {/* Collapsible Enterprise Sidebar */}
        <aside
          className={`fixed lg:sticky top-0 left-0 h-screen bg-[#171653] text-white z-50 flex flex-col justify-between border-r border-[#211D6B] transition-all duration-200 ${
            isSidebarCollapsed ? 'w-20' : 'w-64'
          } ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        >
          {/* Brand Lockup using Official Logo without distortion */}
          <div className="flex flex-col min-h-0 flex-1">
            <div className="h-16 px-4 border-b border-[#211D6B] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src="/assets/aistudio/logofi_0606f38f.png"
                  alt="iData Engine Official Logo"
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 object-contain rounded-lg bg-[#211D6B] p-0.5 shrink-0"
                />
                {!isSidebarCollapsed && (
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white tracking-tight truncate">
                      iData Engine
                    </div>
                    <div className="text-[11px] text-[#28B8D5] font-medium truncate">
                      Enterprise Data Quality
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="hidden lg:inline-flex p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#211D6B] transition-colors shrink-0"
                aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="lg:hidden p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#211D6B]"
                aria-label="Close sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Organized 5-Section Sidebar Navigation */}
            <nav className="p-3 space-y-5 overflow-y-auto flex-1">
              {sidebarGroups.map((sec) => (
                <div key={sec.group} className="space-y-1">
                  {!isSidebarCollapsed && (
                    <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#28B8D5]/80 mb-1.5">
                      {sec.group}
                    </div>
                  )}
                  {sec.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activePage === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActivePage(item.id);
                          setIsMobileSidebarOpen(false);
                        }}
                        title={isSidebarCollapsed ? item.label : undefined}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                          isActive
                            ? 'bg-[#3659B8] text-white'
                            : 'text-slate-300 hover:text-white hover:bg-[#211D6B]'
                        } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#28B8D5]'}`} />
                        {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
          </div>

          {/* Simple Green Status Indicator (Hides Internal Test Details) */}
          <div className="p-3 border-t border-[#211D6B] shrink-0">
            <div
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#211D6B]/70 ${
                isSidebarCollapsed ? 'justify-center' : ''
              }`}
              title="Validation Engine Operational"
            >
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  engineHealthy ? 'bg-[#10B981]' : 'bg-[#F59E0B]'
                }`}
              />
              {!isSidebarCollapsed && (
                <span className="text-xs font-semibold text-white truncate">
                  Validation Engine Operational
                </span>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Canvas */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Enterprise Header */}
          <header className="sticky top-0 z-30 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            {/* Left: Mobile Trigger + Active Dataset, Domain & Processing Status */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg text-[#172554] hover:bg-[#F5F7FC]"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[#64748B] font-medium hidden sm:inline">Active Dataset:</span>
                  <span className="font-mono font-bold text-[#172554] truncate max-w-[180px]">
                    {fileName}
                  </span>
                </div>

                {profile && (
                  <>
                    <span className="text-[#E2E8F0] hidden md:inline">|</span>
                    <div className="hidden md:flex items-center gap-1.5 text-[#64748B]">
                      <span>Domain:</span>
                      <span className="font-semibold text-[#3659B8]">{profile.domain_title}</span>
                    </div>
                  </>
                )}

                <span className="text-[#E2E8F0] hidden xl:inline">|</span>
                <div className="hidden xl:flex items-center gap-2">
                  <span className="text-[#64748B]">Status:</span>
                  <span className="font-semibold text-[#172554]">{processingStatus}</span>
                  <span className="text-[#E2E8F0]">·</span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#10B981]">
                    <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                    Validation Engine Operational
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Notifications, User Profile & Export Options */}
            <div className="flex items-center gap-2 shrink-0 relative">
              {/* Notifications Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowNotificationsMenu(!showNotificationsMenu);
                    setShowExportMenu(false);
                    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                  }}
                  className="p-2 rounded-lg border border-[#E2E8F0] text-[#172554] hover:bg-[#F5F7FC] transition-colors relative"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotificationsMenu && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E2E8F0] rounded-xl shadow-xl p-3 space-y-2 z-40">
                    <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                      <span className="text-xs font-bold text-[#172554]">Activity Notifications</span>
                      <button
                        type="button"
                        onClick={() => setNotifications([])}
                        className="text-[11px] text-[#3659B8] font-semibold hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                    {notifications.length === 0 ? (
                      <p className="text-xs text-[#64748B] py-4 text-center">
                        No recent notifications.
                      </p>
                    ) : (
                      <div className="max-h-64 overflow-y-auto divide-y divide-[#E2E8F0]">
                        {notifications.map((n) => (
                          <div key={n.id} className="py-2 text-xs space-y-0.5">
                            <div className="font-semibold text-[#172554]">{n.title}</div>
                            <div className="text-[#64748B]">{n.message}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Export Options Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(!showExportMenu);
                    setShowNotificationsMenu(false);
                  }}
                  className="h-9 px-3.5 bg-[#171653] hover:bg-[#211D6B] text-white text-xs font-bold rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-[#28B8D5]" />
                  <span className="hidden sm:inline">Export Options</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-[#E2E8F0] rounded-xl shadow-xl p-2 space-y-1 z-40 text-xs">
                    <button
                      type="button"
                      disabled={cleanRecords.length === 0}
                      onClick={() => {
                        downloadCSV(cleanRecords, 'cleaned_dataset.csv', 'CSV_CLEAN');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F5F7FC] font-semibold text-[#172554] disabled:opacity-40"
                    >
                      Export Clean Dataset (.csv)
                    </button>
                    <button
                      type="button"
                      disabled={exceptions.length === 0}
                      onClick={() => {
                        downloadCSV(exceptions, 'exception_register.csv', 'CSV_EXCEPTIONS');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F5F7FC] font-semibold text-[#EF4444] disabled:opacity-40"
                    >
                      Export Exception Register (.csv)
                    </button>
                    <div className="border-t border-[#E2E8F0] my-1" />
                    <button
                      type="button"
                      disabled={!comparisonSnapshot}
                      onClick={() => {
                        handleDownloadPDFReport();
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F5F7FC] font-semibold text-[#172554] disabled:opacity-40"
                    >
                      Download Quality Report (.pdf)
                    </button>
                    <button
                      type="button"
                      disabled={!comparisonSnapshot}
                      onClick={() => {
                        handleDownloadExcelReport();
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F5F7FC] font-semibold text-[#10B981] disabled:opacity-40"
                    >
                      Download Quality Report (.xlsx)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main Workspace Router */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            {activePage === 'dashboard' && (
              <DashboardView
                runs={runs}
                reports={reports}
                audits={audits}
                activeFileName={fileName}
                activeProfile={profile}
                onNavigateStudio={() => setActivePage('studio')}
                onRunActivePipeline={handleExecutePipeline}
                isValidating={isValidating}
              />
            )}

            {activePage === 'studio' && (
              <div className="space-y-6">
                {/* Studio Hero Header */}
                <div className="bg-[#171653] rounded-xl p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2 max-w-2xl">
                    <h1 className="text-2xl font-bold tracking-tight text-white">
                      CSV &amp; Excel Data Cleaning &amp; Validation Studio
                    </h1>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Zero fixed column constraints. Automatically infers schemas, preserves leading zeros, enforces domain invariants, quarantines anomalies separately, and prepares audited Before &amp; After Quality Reports.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#10B981] shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                    <span>Validation Engine Operational</span>
                  </div>
                </div>

                {/* Step 1: Strict CSV / Excel Upload or Benchmark Dataset */}
                <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E2E8F0]">
                    <div>
                      <h2 className="text-base font-bold text-[#172554]">
                        1. Ingest CSV / Excel File or Select Benchmark Dataset
                      </h2>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        Accepted formats: <span className="font-mono font-semibold text-[#172554]">.csv, .xlsx, .xls</span> · Max size: {settings.maxUploadMb} MB
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3.5 py-2 rounded-lg text-xs font-bold bg-[#171653] hover:bg-[#211D6B] text-white flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#28B8D5]" />
                        <span>Upload CSV / Excel</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setInputMode(inputMode === 'paste' ? 'sample' : 'paste')}
                        className="px-3.5 py-2 rounded-lg text-xs font-bold bg-[#F5F7FC] hover:bg-[#E2E8F0]/60 text-[#172554] border border-[#E2E8F0] flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#3659B8]" />
                        <span>{inputMode === 'paste' ? 'Use Dropzone' : 'Paste CSV'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Benchmark Domain Presets */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-[#172554] block">
                      Domain Benchmark Datasets:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      {samplePresets.map((preset) => {
                        const isSelected = inputMode === 'sample' && selectedSampleId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => loadSamplePreset(preset.id)}
                            className={`p-3.5 rounded-xl border text-left transition-colors flex flex-col justify-between ${
                              isSelected
                                ? 'bg-[#F5F7FC] border-[#3659B8]'
                                : 'bg-white hover:bg-[#F5F7FC] border-[#E2E8F0]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 w-full mb-1">
                              <span className="text-xs font-bold text-[#172554] truncate">
                                {preset.name}
                              </span>
                              {getDomainIcon(preset.id.toUpperCase())}
                            </div>
                            <span className="text-[11px] text-[#64748B] truncate block">
                              {preset.domain}
                            </span>
                            <div className="mt-2 text-[11px] font-mono font-semibold text-[#3659B8] tabular-nums">
                              {preset.recordCount} records
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Strict File Picker Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInputChange}
                    accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                  />

                  {inputMode !== 'paste' ? (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`p-6 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${
                        isDragOver
                          ? 'border-[#3659B8] bg-[#F5F7FC]'
                          : 'border-[#E2E8F0] hover:border-[#3659B8] bg-[#F5F7FC]/60'
                      }`}
                    >
                      <div className="w-11 h-11 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-center mx-auto mb-2.5">
                        <FileSpreadsheet className="w-5 h-5 text-[#3659B8]" />
                      </div>
                      <div className="text-sm font-bold text-[#172554]">
                        {inputMode === 'upload' ? (
                          <span className="inline-flex items-center gap-2">
                            <FileCheck className="w-4 h-4 text-[#10B981]" />
                            Loaded: {fileName} ({activeFormat})
                          </span>
                        ) : (
                          <span>Drag &amp; drop a .csv, .xlsx, or .xls file here, or click to browse</span>
                        )}
                      </div>
                      <p className="text-xs text-[#64748B] mt-1">
                        Strict magic-byte validation active · Selected:{' '}
                        <span className="font-mono font-semibold text-[#172554]">{fileName}</span>
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        value={csvContent}
                        onChange={(e) => handlePasteContentChange(e.target.value)}
                        rows={6}
                        placeholder="reg_no,student_name,email,department,year,phone_number&#10;00101,  arun kumar  ,arun@university.edu,Computer Science,3,+91-9876543210"
                        className="w-full bg-[#F5F7FC] border border-[#E2E8F0] rounded-xl p-3 font-mono text-xs text-[#172554] focus:outline-none focus:border-[#3659B8]"
                        spellCheck={false}
                      />
                    </div>
                  )}
                </section>

                {/* Step 2: Intelligent Profiling */}
                {profile && (
                  <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
                      <div>
                        <h2 className="text-base font-bold text-[#172554]">
                          2. Intelligent Profiling &amp; Domain Detection
                        </h2>
                        <p className="text-xs text-[#64748B]">
                          {profile.domain_title} · {profile.domain_confidence_pct}% Match ·{' '}
                          {isProfiling ? 'Analyzing...' : 'Schema Ready'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActivePage('profiling')}
                        className="px-3.5 py-1.5 bg-[#F5F7FC] hover:bg-[#E2E8F0]/60 border border-[#E2E8F0] rounded-lg text-xs font-bold text-[#3659B8]"
                      >
                        Open Deep Statistical Charts →
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs tabular-nums">
                      <div className="p-3.5 bg-[#F5F7FC] border border-[#E2E8F0] rounded-xl">
                        <div className="text-[#64748B] font-semibold">Dimensions</div>
                        <div className="font-mono text-lg font-bold text-[#172554] mt-1">
                          {profile.total_rows} × {profile.total_columns}
                        </div>
                      </div>
                      <div className="p-3.5 bg-[#F5F7FC] border border-[#E2E8F0] rounded-xl">
                        <div className="text-[#64748B] font-semibold">Primary Identifier</div>
                        <div className="font-mono text-base font-bold text-[#172554] mt-1 truncate">
                          {profile.primary_identifier || 'None Detected'}
                        </div>
                      </div>
                      <div className="p-3.5 bg-[#F5F7FC] border border-[#E2E8F0] rounded-xl">
                        <div className="text-[#64748B] font-semibold">Missing Cells</div>
                        <div className="font-mono text-lg font-bold text-[#F59E0B] mt-1">
                          {profile.total_missing_cells} ({profile.missing_cells_percentage}%)
                        </div>
                      </div>
                      <div className="p-3.5 bg-[#F5F7FC] border border-[#E2E8F0] rounded-xl">
                        <div className="text-[#64748B] font-semibold">Initial Quality Score</div>
                        <div className="font-mono text-lg font-bold text-[#3659B8] mt-1">
                          {profile.data_quality_score}%
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-[#F5F7FC] text-[#172554] font-mono text-[11px] border-b border-[#E2E8F0]">
                          <tr>
                            <th className="py-2.5 px-3 font-bold">Column</th>
                            <th className="py-2.5 px-3 font-bold">Physical Type</th>
                            <th className="py-2.5 px-3 font-bold">Semantic Role</th>
                            <th className="py-2.5 px-3 font-bold">Key Status</th>
                            <th className="py-2.5 px-3 font-bold text-right">Missing</th>
                            <th className="py-2.5 px-3 font-bold text-right">Unique %</th>
                            <th className="py-2.5 px-3 font-bold">Sample Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0] font-mono text-[11px] tabular-nums">
                          {profile.columns.map((c) => (
                            <tr key={c.column_name} className="hover:bg-[#F5F7FC]">
                              <td className="py-2 px-3 font-bold text-[#172554]">{c.column_name}</td>
                              <td className="py-2 px-3 text-[#64748B]">{c.physical_type}</td>
                              <td className="py-2 px-3 text-[#3659B8] font-bold">{c.semantic_type}</td>
                              <td className="py-2 px-3">
                                {c.is_potential_identifier ? (
                                  <span className="text-[#10B981] font-bold">Primary ID</span>
                                ) : (
                                  <span className="text-[#64748B]">—</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right">
                                {c.missing_count > 0 ? (
                                  <span className="text-[#F59E0B] font-bold">
                                    {c.missing_count} ({c.missing_percentage}%)
                                  </span>
                                ) : (
                                  <span className="text-[#10B981]">0%</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right">{c.unique_percentage}%</td>
                              <td className="py-2 px-3 text-[#64748B] max-w-[150px] truncate">
                                {c.sample_values[0] || 'NULL'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {/* Step 3: Dynamic Recommendations */}
                {recommendations.length > 0 && (
                  <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
                      <div>
                        <h2 className="text-base font-bold text-[#172554]">
                          3. Dynamic Cleaning &amp; Validation Rules
                        </h2>
                        <p className="text-xs text-[#64748B]">
                          Toggle rules prior to running the cleaning &amp; quarantine pipeline
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const allTrue: Record<string, boolean> = {};
                          recommendations.forEach((r) => (allTrue[r.id] = true));
                          setEnabledRuleMap(allTrue);
                        }}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#F5F7FC] hover:bg-[#E2E8F0]/60 text-[#172554] border border-[#E2E8F0]"
                      >
                        Enable All
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                      {recommendations.map((rec) => {
                        const isEnabled = enabledRuleMap[rec.id] ?? rec.enabled;
                        return (
                          <div
                            key={rec.id}
                            onClick={() => toggleRecommendation(rec.id)}
                            className={`p-4 rounded-xl border cursor-pointer transition-colors flex flex-col justify-between space-y-2.5 ${
                              isEnabled
                                ? 'bg-[#F5F7FC] border-[#3659B8]'
                                : 'bg-white border-[#E2E8F0] opacity-60'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                {isEnabled ? (
                                  <CheckSquare className="w-4 h-4 text-[#171653] shrink-0" />
                                ) : (
                                  <Square className="w-4 h-4 text-[#64748B] shrink-0" />
                                )}
                                <span className="font-bold text-[#172554] text-xs">{rec.name}</span>
                              </div>
                              <span
                                className={`text-[11px] font-mono font-bold ${
                                  rec.severity === 'CRITICAL' ? 'text-[#EF4444]' : 'text-[#3659B8]'
                                }`}
                              >
                                {rec.category}
                              </span>
                            </div>

                            <p className="text-[11px] text-[#64748B] leading-snug">{rec.description}</p>

                            <div className="bg-white p-2.5 rounded-lg border border-[#E2E8F0] font-mono text-[11px] flex items-center justify-between text-[#64748B]">
                              <span className="text-[#EF4444] truncate">{rec.preview.before}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-[#3659B8] shrink-0 mx-2" />
                              <span className="text-[#10B981] font-bold truncate">{rec.preview.after}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-4 border-t border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => setShowLogs(!showLogs)}
                        className="h-9 inline-flex items-center gap-1.5 px-3.5 rounded-lg bg-[#F5F7FC] hover:bg-[#E2E8F0]/60 border border-[#E2E8F0] text-xs text-[#172554] font-mono font-semibold"
                      >
                        <Terminal className="w-3.5 h-3.5 text-[#3659B8]" />
                        <span>{showLogs ? 'Hide Engine Terminal' : 'Show Engine Terminal'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleExecutePipeline}
                        disabled={isValidating}
                        className="h-10 px-6 bg-[#171653] hover:bg-[#211D6B] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isValidating ? (
                          <RotateCw className="w-4 h-4 animate-spin text-[#28B8D5]" />
                        ) : (
                          <Play className="w-4 h-4 fill-current text-[#28B8D5]" />
                        )}
                        <span>{isValidating ? 'Executing Pipeline...' : 'Run Dynamic Cleaning & Validation'}</span>
                      </button>
                    </div>

                    {showLogs && (
                      <div className="p-4 bg-[#171653] text-[#10B981] rounded-xl font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                        {engineLogs || 'Ready to execute dynamic cleaning rules...'}
                      </div>
                    )}
                  </section>
                )}

                {/* Step 4: Results Scorecard, Before/After Trigger & Clean / Exception Tables */}
                {summary && (
                  <section className="space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
                      <div className="p-5 bg-white border border-[#E2E8F0] rounded-xl">
                        <span className="text-xs font-semibold text-[#64748B]">Total Ingested Records</span>
                        <div className="font-mono text-2xl font-bold text-[#172554] mt-2">
                          {summary.total_records}
                        </div>
                        <div className="text-[11px] text-[#3659B8] font-mono mt-1 truncate">
                          {summary.domain_detected}
                        </div>
                      </div>

                      <div className="p-5 bg-white border border-[#E2E8F0] rounded-xl">
                        <span className="text-xs font-semibold text-[#64748B]">Clean Warehouse Ready</span>
                        <div className="font-mono text-2xl font-bold text-[#10B981] mt-2">
                          {summary.valid_records}{' '}
                          <span className="text-xs font-semibold">({summary.pass_rate_pct}%)</span>
                        </div>
                        <div className="text-[11px] text-[#64748B] font-mono mt-1">
                          {summary.auto_cleaned_records ?? 0} auto-cleaned in-place
                        </div>
                      </div>

                      <div className="p-5 bg-white border border-[#E2E8F0] rounded-xl">
                        <span className="text-xs font-semibold text-[#64748B]">Quarantined Anomalies</span>
                        <div className="font-mono text-2xl font-bold text-[#EF4444] mt-2">
                          {summary.quarantined_records}{' '}
                          <span className="text-xs font-semibold">({summary.quarantine_rate_pct}%)</span>
                        </div>
                        <div className="text-[11px] text-[#64748B] font-mono mt-1">
                          Isolated in Exception Register
                        </div>
                      </div>

                      <div className="p-5 bg-white border border-[#E2E8F0] rounded-xl flex flex-col justify-between">
                        <div>
                          <span className="text-xs font-semibold text-[#64748B]">Before &amp; After Quality Report</span>
                          <div className="font-mono text-lg font-bold text-[#172554] mt-1">
                            {comparisonSnapshot ? `${comparisonSnapshot.before.qualityScore}% → ${comparisonSnapshot.after.qualityScore}%` : 'Ready'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActivePage('comparison')}
                          className="mt-2 text-xs font-bold text-[#3659B8] hover:underline text-left"
                        >
                          Generate Before &amp; After Report →
                        </button>
                      </div>
                    </div>

                    {/* Dual Output Table */}
                    <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                      <div className="p-4 border-b border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#F5F7FC]">
                        <div className="flex items-center gap-1 p-1 bg-white border border-[#E2E8F0] rounded-lg text-xs">
                          <button
                            type="button"
                            onClick={() => setOutputView('clean')}
                            className={`px-3.5 py-1.5 rounded-md font-bold flex items-center gap-2 ${
                              outputView === 'clean'
                                ? 'bg-[#171653] text-white'
                                : 'text-[#64748B] hover:text-[#172554]'
                            }`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Clean Validated ({cleanRecords.length})</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setOutputView('exceptions')}
                            className={`px-3.5 py-1.5 rounded-md font-bold flex items-center gap-2 ${
                              outputView === 'exceptions'
                                ? 'bg-[#EF4444] text-white'
                                : 'text-[#64748B] hover:text-[#172554]'
                            }`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Exception Register ({exceptions.length})</span>
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-2.5" />
                            <input
                              type="text"
                              placeholder={outputView === 'clean' ? 'Search clean records...' : 'Search anomalies...'}
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="h-8 bg-white border border-[#E2E8F0] rounded-lg pl-8 pr-3 text-xs text-[#172554] w-48 focus:outline-none focus:border-[#3659B8]"
                            />
                          </div>

                          {outputView === 'exceptions' && (
                            <div className="flex items-center gap-1.5">
                              <Filter className="w-3.5 h-3.5 text-[#64748B]" />
                              <select
                                value={exceptionTypeFilter}
                                onChange={(e) => setExceptionTypeFilter(e.target.value)}
                                className="h-8 bg-white border border-[#E2E8F0] text-[#172554] text-xs rounded-lg px-2 font-mono font-semibold"
                              >
                                <option value="ALL">All Violation Codes ({exceptions.length})</option>
                                {Array.from(new Set(exceptions.map((e) => e.violation_type))).map((vt) => (
                                  <option key={vt} value={vt}>{vt}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {outputView === 'clean' ? (
                            <button
                              type="button"
                              onClick={() => downloadCSV(cleanRecords, 'cleaned_dataset.csv', 'CSV_CLEAN')}
                              className="h-8 px-3 bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs rounded-lg flex items-center gap-1.5"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download Clean CSV</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => downloadCSV(exceptions, 'exception_register.csv', 'CSV_EXCEPTIONS')}
                              className="h-8 px-3 bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold text-xs rounded-lg flex items-center gap-1.5"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download Exceptions CSV</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {outputView === 'clean' ? (
                        <div className="overflow-x-auto max-h-[460px] overflow-y-auto text-xs">
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-[#F5F7FC] text-[#172554] sticky top-0 font-bold border-b border-[#E2E8F0] font-mono text-[11px]">
                              <tr>
                                {profile?.headers.map((h) => (
                                  <th key={h} className="py-2.5 px-4 whitespace-nowrap">{h}</th>
                                ))}
                                <th className="py-2.5 px-4 text-center w-20">Inspect</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E2E8F0] font-mono text-[11px] tabular-nums">
                              {filteredClean.map((r, idx) => (
                                <tr key={idx} className="hover:bg-[#F5F7FC] text-[#172554]">
                                  {profile?.headers.map((h) => (
                                    <td key={h} className="py-2 px-4 whitespace-nowrap">
                                      {r[h] || <span className="text-[#64748B]">—</span>}
                                    </td>
                                  ))}
                                  <td className="py-2 px-4 text-center">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedRecordForDetail(r)}
                                      className="text-[#64748B] hover:text-[#172554] p-1"
                                      title="Inspect record JSON"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="overflow-x-auto max-h-[460px] overflow-y-auto text-xs">
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-[#FEF2F2] text-[#991B1B] sticky top-0 font-bold border-b border-[#FECACA]">
                              <tr>
                                <th className="py-2.5 px-4">Row #</th>
                                <th className="py-2.5 px-4">Record ID</th>
                                <th className="py-2.5 px-4">Offending Field</th>
                                <th className="py-2.5 px-4">Violation Code</th>
                                <th className="py-2.5 px-4">Severity</th>
                                <th className="py-2.5 px-4">Offending Value</th>
                                <th className="py-2.5 px-4">Root Cause Diagnosis &amp; Suggestion</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E2E8F0] font-mono text-[11px] tabular-nums">
                              {filteredExceptions.map((ex, idx) => (
                                <tr key={idx} className="hover:bg-[#FEF2F2]/40">
                                  <td className="py-2 px-4 text-[#64748B]">#{ex.row_number}</td>
                                  <td className="py-2 px-4 font-bold text-[#172554]">{ex.record_id}</td>
                                  <td className="py-2 px-4 text-[#EF4444] font-bold">{ex.field_name}</td>
                                  <td className="py-2 px-4 font-semibold text-[#172554]">{ex.violation_type}</td>
                                  <td className="py-2 px-4 font-bold text-[#EF4444]">{ex.severity}</td>
                                  <td className="py-2 px-4 text-[#EF4444] max-w-[150px] truncate">
                                    {ex.raw_value || 'EMPTY_NULL'}
                                  </td>
                                  <td className="py-2 px-4 font-sans text-xs">
                                    <div className="text-[#172554] font-medium">{ex.error_message}</div>
                                    {ex.suggested_correction && (
                                      <div className="text-[#10B981] text-[11px] font-mono mt-0.5">
                                        Fix: {ex.suggested_correction}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>
            )}

            {activePage === 'taxonomy' && <SchemaTaxonomyView profile={profile} />}

            {activePage === 'profiling' && (
              <DataProfilingView
                fileName={fileName}
                profile={profile}
                originalRecords={originalRecords}
                summary={summary}
                onNavigateStudio={() => setActivePage('studio')}
              />
            )}

            {activePage === 'cleaning' && (
              <DataCleaningView
                fileName={fileName}
                recommendations={recommendations}
                enabledRuleMap={enabledRuleMap}
                onToggleRule={toggleRecommendation}
                onEnableAll={() => {
                  const allTrue: Record<string, boolean> = {};
                  recommendations.forEach((r) => (allTrue[r.id] = true));
                  setEnabledRuleMap(allTrue);
                }}
                onExecutePipeline={handleExecutePipeline}
                isValidating={isValidating}
                engineLogs={engineLogs}
              />
            )}

            {activePage === 'validation' && (
              <DataValidationView
                fileName={fileName}
                profile={profile}
                summary={summary}
                comparison={comparisonSnapshot}
                cleanRecords={cleanRecords}
                exceptions={exceptions}
                onExecutePipeline={handleExecutePipeline}
                isValidating={isValidating}
                onInspectRecord={setSelectedRecordForDetail}
                onDownloadClean={() => downloadCSV(cleanRecords, 'cleaned_dataset.csv', 'CSV_CLEAN')}
              />
            )}

            {activePage === 'exceptions' && (
              <ExceptionManagementView
                fileName={fileName}
                exceptions={exceptions}
                onDownloadExceptions={() =>
                  downloadCSV(exceptions, 'exception_register.csv', 'CSV_EXCEPTIONS')
                }
                onExecutePipeline={handleExecutePipeline}
                hasProcessedRun={summary !== null}
              />
            )}

            {activePage === 'monitoring' && (
              <QualityMonitoringView
                datasetName={fileName}
                dimensions={sixDimensions}
                weights={settings.scoringWeights}
                onUpdateWeights={(nextWeights) =>
                  setSettings((prev) => ({ ...prev, scoringWeights: nextWeights }))
                }
                runs={runs}
                onNavigateStudio={() => setActivePage('studio')}
              />
            )}

            {activePage === 'comparison' && (
              <DatasetComparisonView
                datasetName={fileName}
                comparison={comparisonSnapshot}
                hasProcessedRun={summary !== null}
                runs={runs}
                onGenerateComparison={handleGenerateQualityComparison}
                onDownloadPDF={handleDownloadPDFReport}
                onDownloadExcel={handleDownloadExcelReport}
                onNavigateStudio={() => setActivePage('studio')}
              />
            )}

            {activePage === 'quality-reports' && (
              <ReportsView
                datasetName={fileName}
                comparison={comparisonSnapshot}
                runs={runs}
                reports={reports}
                onDownloadPDF={handleDownloadPDFReport}
                onDownloadExcel={handleDownloadExcelReport}
                onExportCleanCSV={() => downloadCSV(cleanRecords, 'cleaned_dataset.csv', 'CSV_CLEAN')}
                onExportExceptionsCSV={() =>
                  downloadCSV(exceptions, 'exception_register.csv', 'CSV_EXCEPTIONS')
                }
                hasCleanData={cleanRecords.length > 0}
                hasExceptions={exceptions.length > 0}
              />
            )}

            {activePage === 'audit-logs' && <AuditLogsView audits={audits} />}

            {activePage === 'settings' && (
              <SettingsView
                settings={settings}
                onUpdateSettings={setSettings}
                onClearHistory={handleClearHistory}
                engineHealthy={engineHealthy}
              />
            )}
          </main>

          {/* Quiet Enterprise Footer */}
          <footer className="mt-auto border-t border-[#E2E8F0] bg-white px-6 py-4 text-xs text-[#64748B]">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <img
                  src="/assets/aistudio/logofi_0606f38f.png"
                  alt="iData Engine"
                  referrerPolicy="no-referrer"
                  className="h-6 w-6 object-contain rounded bg-[#171653] p-0.5"
                />
                <span className="font-semibold text-[#172554]">
                  iData Engine v2.5 · Enterprise Data Cleaning &amp; Validation Platform
                </span>
              </div>
              <div className="flex items-center gap-2 font-semibold text-[#10B981]">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                <span>Validation Engine Operational</span>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Strict Unsupported File Modal */}
      <UnsupportedFileModal
        isOpen={unsupportedModal.isOpen}
        fileName={unsupportedModal.fileName}
        diagnosticReason={unsupportedModal.reason}
        onClose={() => setUnsupportedModal({ isOpen: false })}
      />

      {/* Record JSON Detail Inspector */}
      {selectedRecordForDetail && (
        <div className="fixed inset-0 z-50 bg-[#171653]/70 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <h3 className="font-bold text-[#172554] text-sm">Record Entity Inspector</h3>
              <button
                type="button"
                onClick={() => setSelectedRecordForDetail(null)}
                className="text-[#64748B] hover:text-[#172554]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="p-4 bg-[#171653] rounded-xl font-mono text-xs text-[#10B981] overflow-x-auto max-h-72 leading-relaxed">
              {JSON.stringify(selectedRecordForDetail, null, 2)}
            </pre>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedRecordForDetail, null, 2));
                  setCopiedDetail(true);
                  setTimeout(() => setCopiedDetail(false), 2000);
                }}
                className="text-xs text-[#172554] hover:text-[#3659B8] flex items-center gap-1.5 font-bold"
              >
                {copiedDetail ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedDetail ? 'Copied' : 'Copy JSON'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRecordForDetail(null)}
                className="px-4 py-2 bg-[#171653] hover:bg-[#211D6B] text-white text-xs font-bold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
