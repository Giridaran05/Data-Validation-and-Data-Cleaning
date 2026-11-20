import React, { useMemo, useState } from 'react';
import {
  Database,
  Layers,
  CheckCircle2,
  AlertCircle,
  CopyCheck,
  FileWarning,
  Sparkles,
  ShieldAlert,
  Gauge,
  Info,
  ArrowRight,
  Play,
  FileSpreadsheet,
  Clock,
  Activity,
  FileText,
} from 'lucide-react';
import {
  ProcessingRunRecord,
  ReportHistoryRecord,
  AuditLogEntry,
  DatasetProfile,
} from '../types/idata';
import {
  CHART_COLORS,
  PieOrDonutChartCard,
  BarChartCard,
  LineTrendChartCard,
} from './ChartsSuite';

interface DashboardViewProps {
  runs: ProcessingRunRecord[];
  reports: ReportHistoryRecord[];
  audits: AuditLogEntry[];
  activeFileName: string;
  activeProfile: DatasetProfile | null;
  onNavigateStudio: () => void;
  onRunActivePipeline: () => void;
  isValidating: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  runs,
  reports,
  audits,
  activeFileName,
  activeProfile,
  onNavigateStudio,
  onRunActivePipeline,
  isValidating,
}) => {
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | '24h' | '7d' | '30d'>('all');
  const [datasetFilter, setDatasetFilter] = useState<string>('ALL');
  const [domainFilter, setDomainFilter] = useState<string>('ALL');

  const uniqueDatasets = useMemo(
    () => Array.from(new Set(runs.map((r) => r.datasetName))),
    [runs]
  );
  const uniqueDomains = useMemo(
    () => Array.from(new Set(runs.map((r) => r.domainTitle))),
    [runs]
  );

  const filteredRuns = useMemo(() => {
    const now = Date.now();
    return runs.filter((run) => {
      if (datasetFilter !== 'ALL' && run.datasetName !== datasetFilter) return false;
      if (domainFilter !== 'ALL' && run.domainTitle !== domainFilter) return false;
      if (dateRangeFilter !== 'all') {
        const ts = new Date(run.timestamp).getTime();
        const maxAgeMs =
          dateRangeFilter === '24h'
            ? 86400000
            : dateRangeFilter === '7d'
            ? 7 * 86400000
            : 30 * 86400000;
        if (now - ts > maxAgeMs) return false;
      }
      return true;
    });
  }, [runs, datasetFilter, domainFilter, dateRangeFilter]);

  const kpis = useMemo(() => {
    const datasetsCount = filteredRuns.length;
    const totalRecords = filteredRuns.reduce((s, r) => s + r.totalRecords, 0);
    const validRecords = filteredRuns.reduce((s, r) => s + r.validRecords, 0);
    const invalidRecords = filteredRuns.reduce((s, r) => s + r.invalidRecords, 0);
    const duplicateRecords = filteredRuns.reduce((s, r) => s + r.duplicateRecords, 0);
    const missingValues = filteredRuns.reduce((s, r) => s + r.missingValuesDetected, 0);
    const autoCleaned = filteredRuns.reduce((s, r) => s + r.autoCleanedRecords, 0);
    const quarantined = filteredRuns.reduce((s, r) => s + r.quarantinedRecords, 0);
    const avgQuality =
      datasetsCount > 0
        ? Math.round(
            (filteredRuns.reduce((s, r) => s + r.afterQualityScore, 0) / datasetsCount) * 10
          ) / 10
        : null;

    return {
      datasetsCount,
      totalRecords,
      validRecords,
      invalidRecords,
      duplicateRecords,
      missingValues,
      autoCleaned,
      quarantined,
      avgQuality,
    };
  }, [filteredRuns]);

  const kpiCards = [
    {
      label: 'Total Datasets Processed',
      value: kpis.datasetsCount.toLocaleString(),
      icon: Database,
      status: kpis.datasetsCount > 0 ? 'Active' : 'Awaiting Run',
      statusColor: kpis.datasetsCount > 0 ? 'text-[#10B981]' : 'text-[#64748B]',
      tooltip: 'Count of CSV/Excel cleaning & validation runs matching current filters.',
    },
    {
      label: 'Total Records Analyzed',
      value: kpis.totalRecords.toLocaleString(),
      icon: Layers,
      status: kpis.totalRecords > 0 ? 'Ingested' : 'No Data',
      statusColor: kpis.totalRecords > 0 ? 'text-[#3659B8]' : 'text-[#64748B]',
      tooltip: 'Cumulative input rows parsed and audited across processed datasets.',
    },
    {
      label: 'Valid Records',
      value: kpis.validRecords.toLocaleString(),
      icon: CheckCircle2,
      status:
        kpis.totalRecords > 0
          ? `${Math.round((kpis.validRecords / kpis.totalRecords) * 1000) / 10}% Pass`
          : '—',
      statusColor: 'text-[#10B981]',
      tooltip: 'Rows passing all enabled schema, type, format, and business math constraints.',
    },
    {
      label: 'Invalid Records',
      value: kpis.invalidRecords.toLocaleString(),
      icon: AlertCircle,
      status: kpis.invalidRecords > 0 ? 'Flagged' : 'Clean',
      statusColor: kpis.invalidRecords > 0 ? 'text-[#EF4444]' : 'text-[#10B981]',
      tooltip: 'Rows containing one or more validation violations detected by the engine.',
    },
    {
      label: 'Duplicate Records Detected',
      value: kpis.duplicateRecords.toLocaleString(),
      icon: CopyCheck,
      status: kpis.duplicateRecords > 0 ? 'Deduplicated' : 'Unique',
      statusColor: kpis.duplicateRecords > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]',
      tooltip: 'Exact duplicate rows and repeated primary identifier keys detected.',
    },
    {
      label: 'Missing Values Detected',
      value: kpis.missingValues.toLocaleString(),
      icon: FileWarning,
      status: kpis.missingValues > 0 ? 'Null Cells' : 'Complete',
      statusColor: kpis.missingValues > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]',
      tooltip: 'Empty, null, NaN, or N/A cells detected during profiling.',
    },
    {
      label: 'Records Automatically Cleaned',
      value: kpis.autoCleaned.toLocaleString(),
      icon: Sparkles,
      status: kpis.autoCleaned > 0 ? 'Standardized' : 'No Changes',
      statusColor: 'text-[#28B8D5]',
      tooltip: 'Valid records whose fields were sanitized in-place (casing, whitespace, ISO dates, currency).',
    },
    {
      label: 'Quarantined Records',
      value: kpis.quarantined.toLocaleString(),
      icon: ShieldAlert,
      status: kpis.quarantined > 0 ? 'Isolated' : 'Zero Quarantine',
      statusColor: kpis.quarantined > 0 ? 'text-[#EF4444]' : 'text-[#10B981]',
      tooltip: 'Records isolated to Exception Register; excluded from Clean Warehouse output.',
    },
    {
      label: 'Overall Data Quality Score',
      value: kpis.avgQuality !== null ? `${kpis.avgQuality}%` : '—',
      icon: Gauge,
      status:
        kpis.avgQuality === null
          ? 'No Runs'
          : kpis.avgQuality >= 90
          ? 'Optimal'
          : kpis.avgQuality >= 75
          ? 'Moderate'
          : 'Needs Review',
      statusColor:
        kpis.avgQuality === null
          ? 'text-[#64748B]'
          : kpis.avgQuality >= 90
          ? 'text-[#10B981]'
          : kpis.avgQuality >= 75
          ? 'text-[#F59E0B]'
          : 'text-[#EF4444]',
      tooltip: 'Mean post-cleaning quality score calculated across processed datasets.',
    },
  ];

  // Chart datasets derived strictly from real filteredRuns
  const validVsInvalidData = useMemo(() => {
    if (kpis.totalRecords === 0) return [];
    return [
      { name: 'Valid Records', value: kpis.validRecords, color: CHART_COLORS.successGreen },
      { name: 'Invalid Records', value: kpis.invalidRecords, color: CHART_COLORS.errorRed },
    ];
  }, [kpis]);

  const cleanVsQuarantinedData = useMemo(() => {
    if (kpis.totalRecords === 0) return [];
    return [
      { name: 'Clean Warehouse', value: kpis.validRecords, color: CHART_COLORS.corporateBlue },
      { name: 'Quarantined', value: kpis.quarantined, color: CHART_COLORS.warningAmber },
    ];
  }, [kpis]);

  const errorsByCategoryData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const run of filteredRuns) {
      for (const [cat, count] of Object.entries(run.errorsByCategory || {})) {
        map[cat] = (map[cat] || 0) + count;
      }
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([category, count]) => ({ category: category.replace(/_/g, ' '), count }));
  }, [filteredRuns]);

  const missingByColumnData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const run of filteredRuns) {
      for (const item of run.missingByColumn || []) {
        if (item.count > 0) {
          map[item.column] = (map[item.column] || 0) + item.count;
        }
      }
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([column, missing]) => ({ column, missing }));
  }, [filteredRuns]);

  const qualityTrendsData = useMemo(() => {
    return [...filteredRuns]
      .reverse()
      .map((run, idx) => ({
        run: `#${idx + 1} ${run.datasetName.slice(0, 12)}`,
        beforeScore: run.dataQualityScore,
        afterScore: run.afterQualityScore,
      }));
  }, [filteredRuns]);

  const domainDistributionData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const run of filteredRuns) {
      map[run.domainTitle] = (map[run.domainTitle] || 0) + run.totalRecords;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredRuns]);

  const cleaningActivityData = useMemo(() => {
    return [...filteredRuns]
      .reverse()
      .slice(-8)
      .map((run) => ({
        dataset: run.datasetName.replace(/\.[^.]+$/, '').slice(0, 14),
        autoCleaned: run.autoCleanedRecords,
        validUntouched: Math.max(0, run.validRecords - run.autoCleanedRecords),
        quarantined: run.quarantinedRecords,
      }));
  }, [filteredRuns]);

  const recentUploads = audits.filter((a) => a.action.includes('UPLOAD') || a.action.includes('PRESET')).slice(0, 5);
  const filteredReports = reports.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Executive Action & Filter Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-[#172554] tracking-tight">
            Enterprise Data Quality Overview
          </h1>
          <p className="text-xs text-[#64748B]">
            Real-time telemetry compiled strictly from executed CSV and Excel validation runs.
            {activeProfile && (
              <>
                {' '}Active workspace file: <span className="font-mono font-semibold text-[#172554]">{activeFileName}</span> ({activeProfile.total_rows} rows)
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onRunActivePipeline}
            disabled={isValidating || !activeProfile}
            className="px-4 py-2 bg-[#171653] hover:bg-[#211D6B] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current text-[#28B8D5]" />
            <span>{isValidating ? 'Processing...' : 'Validate Active Dataset'}</span>
          </button>

          <button
            type="button"
            onClick={onNavigateStudio}
            className="px-4 py-2 bg-[#F5F7FC] hover:bg-[#E2E8F0]/60 text-[#172554] border border-[#E2E8F0] text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <span>Open CSV Engine Studio</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#3659B8]" />
          </button>
        </div>
      </div>

      {/* Dashboard Filters */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="dash-date-filter" className="text-xs font-semibold text-[#64748B]">
              Date Range
            </label>
            <select
              id="dash-date-filter"
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value as any)}
              className="h-8 px-2.5 bg-[#F5F7FC] border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#172554] focus:outline-none focus:border-[#3659B8]"
            >
              <option value="all">All Time</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="dash-dataset-filter" className="text-xs font-semibold text-[#64748B]">
              Dataset
            </label>
            <select
              id="dash-dataset-filter"
              value={datasetFilter}
              onChange={(e) => setDatasetFilter(e.target.value)}
              className="h-8 px-2.5 bg-[#F5F7FC] border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#172554] focus:outline-none focus:border-[#3659B8]"
            >
              <option value="ALL">All Datasets ({uniqueDatasets.length})</option>
              {uniqueDatasets.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="dash-domain-filter" className="text-xs font-semibold text-[#64748B]">
              Domain
            </label>
            <select
              id="dash-domain-filter"
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="h-8 px-2.5 bg-[#F5F7FC] border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#172554] focus:outline-none focus:border-[#3659B8]"
            >
              <option value="ALL">All Domains ({uniqueDomains.length})</option>
              {uniqueDomains.map((dom) => (
                <option key={dom} value={dom}>{dom}</option>
              ))}
            </select>
          </div>
        </div>

        <span className="text-xs text-[#64748B] font-mono tabular-nums">
          Showing {filteredRuns.length} processed run(s)
        </span>
      </div>

      {/* 9 Enterprise KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-[#3659B8]/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#F5F7FC] border border-[#E2E8F0] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[#3659B8]" />
                  </div>
                  <span className="text-xs font-semibold text-[#64748B] truncate">{card.label}</span>
                </div>
                <span className="group relative shrink-0" title={card.tooltip}>
                  <Info className="w-3.5 h-3.5 text-[#64748B] cursor-help" />
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-2xl font-bold text-[#172554] tabular-nums">
                  {card.value}
                </span>
                <span className={`text-xs font-semibold whitespace-nowrap ${card.statusColor}`}>
                  {card.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State Banner when no historical runs exist yet */}
      {runs.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#F5F7FC] border border-[#E2E8F0] flex items-center justify-center mx-auto">
            <FileSpreadsheet className="w-6 h-6 text-[#3659B8]" />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h2 className="text-base font-bold text-[#172554]">No Processing History Recorded Yet</h2>
            <p className="text-xs text-[#64748B] leading-relaxed">
              iData Engine does not populate synthetic or hardcoded dashboard metrics. Run validation on the currently profiled dataset or upload a .csv, .xlsx, or .xls file in CSV Engine Studio to generate live analytics.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={onRunActivePipeline}
              disabled={isValidating || !activeProfile}
              className="px-5 py-2.5 bg-[#171653] hover:bg-[#211D6B] text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current text-[#28B8D5]" />
              <span>Run Pipeline on {activeFileName}</span>
            </button>
            <button
              type="button"
              onClick={onNavigateStudio}
              className="px-5 py-2.5 bg-[#F5F7FC] hover:bg-[#E2E8F0]/60 text-[#172554] border border-[#E2E8F0] text-xs font-bold rounded-lg transition-colors"
            >
              Upload Custom CSV / Excel
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 7 Required Dashboard Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PieOrDonutChartCard
              title="Valid vs Invalid Records"
              subtitle="Ratio of validated warehouse rows vs failed rows"
              data={validVsInvalidData}
              exportFilename="dashboard_valid_vs_invalid"
            />
            <PieOrDonutChartCard
              title="Clean vs Quarantined Records"
              subtitle="Clean output vs records isolated to Exception Register"
              data={cleanVsQuarantinedData}
              donut
              exportFilename="dashboard_clean_vs_quarantined"
            />
            <BarChartCard
              title="Errors by Category"
              subtitle="Frequency of detected violation codes"
              data={errorsByCategoryData}
              xKey="category"
              bars={[{ key: 'count', name: 'Exceptions', color: CHART_COLORS.errorRed }]}
              emptyMessage="Zero errors detected across the selected runs."
              exportFilename="dashboard_errors_by_category"
            />
            <BarChartCard
              title="Missing Values by Column"
              subtitle="Null or empty cell counts across columns"
              data={missingByColumnData}
              xKey="column"
              bars={[{ key: 'missing', name: 'Missing Cells', color: CHART_COLORS.warningAmber }]}
              horizontal
              emptyMessage="Zero missing values recorded across processed columns."
              exportFilename="dashboard_missing_by_column"
            />
            <LineTrendChartCard
              title="Data Quality Trends"
              subtitle="Initial vs Post-Cleaning quality scores across runs"
              data={qualityTrendsData}
              xKey="run"
              lines={[
                { key: 'beforeScore', name: 'Before Cleaning (%)', color: CHART_COLORS.warningAmber },
                { key: 'afterScore', name: 'After Cleaning (%)', color: CHART_COLORS.successGreen },
              ]}
              exportFilename="dashboard_quality_trends"
            />
            <PieOrDonutChartCard
              title="Dataset Domain Distribution"
              subtitle="Records analyzed grouped by inferred domain"
              data={domainDistributionData}
              exportFilename="dashboard_domain_distribution"
            />
          </div>

          <BarChartCard
            title="Cleaning Activity Overview"
            subtitle="Auto-cleaned, valid untouched, and quarantined records per run"
            data={cleaningActivityData}
            xKey="dataset"
            stacked
            bars={[
              { key: 'autoCleaned', name: 'Automatically Cleaned', color: CHART_COLORS.accentCyan },
              { key: 'validUntouched', name: 'Already Compliant', color: CHART_COLORS.successGreen },
              { key: 'quarantined', name: 'Quarantined', color: CHART_COLORS.errorRed },
            ]}
            exportFilename="dashboard_cleaning_activity"
          />

          {/* Dashboard Activity Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Processing History & Validation Results */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#172554] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#3659B8]" />
                  <span>Processing History &amp; Validation Status</span>
                </h3>
                <span className="text-xs text-[#64748B] font-mono">{filteredRuns.length} runs</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                      <th className="py-2 pr-3 font-semibold">Dataset</th>
                      <th className="py-2 pr-3 font-semibold">Domain</th>
                      <th className="py-2 pr-3 font-semibold text-right">Clean / Quar.</th>
                      <th className="py-2 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] tabular-nums">
                    {filteredRuns.slice(0, 6).map((run) => (
                      <tr key={run.id} className="hover:bg-[#F5F7FC]">
                        <td className="py-2 pr-3 font-mono font-semibold text-[#172554] truncate max-w-[140px]">
                          {run.datasetName}
                        </td>
                        <td className="py-2 pr-3 text-[#64748B] truncate max-w-[130px]">{run.domainTitle}</td>
                        <td className="py-2 pr-3 text-right font-mono">
                          <span className="text-[#10B981] font-semibold">{run.validRecords}</span>
                          {' / '}
                          <span className="text-[#EF4444] font-semibold">{run.quarantinedRecords}</span>
                        </td>
                        <td className="py-2 text-right font-semibold">
                          <span
                            className={
                              run.quarantinedRecords === 0 ? 'text-[#10B981]' : 'text-[#F59E0B]'
                            }
                          >
                            {run.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Uploads, Cleaning Operations & Report Generation */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#172554] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#3659B8]" />
                  <span>Recent Activity &amp; Report Generation</span>
                </h3>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                  Recent Dataset Uploads &amp; Operations
                </div>
                {recentUploads.length === 0 ? (
                  <p className="text-xs text-[#64748B]">No manual uploads recorded in this session yet.</p>
                ) : (
                  <ul className="divide-y divide-[#E2E8F0]">
                    {recentUploads.map((item) => (
                      <li key={item.id} className="py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-[#172554] truncate">{item.target}</div>
                          <div className="text-[#64748B] truncate">{item.details}</div>
                        </div>
                        <span className="text-[11px] font-mono text-[#64748B] shrink-0">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="pt-2 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                  Recent Generated Reports
                </div>
                {filteredReports.length === 0 ? (
                  <p className="text-xs text-[#64748B]">
                    No PDF or Excel quality reports generated yet. Generate one under Data Quality Reports.
                  </p>
                ) : (
                  <ul className="divide-y divide-[#E2E8F0]">
                    {filteredReports.map((rep) => (
                      <li key={rep.id} className="py-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-[#3659B8] shrink-0" />
                          <span className="font-mono font-semibold text-[#172554] truncate">
                            {rep.datasetName}
                          </span>
                          <span className="text-[#64748B]">· {rep.format}</span>
                        </div>
                        <span className="text-[11px] font-mono text-[#64748B] shrink-0">
                          {new Date(rep.timestamp).toLocaleTimeString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
