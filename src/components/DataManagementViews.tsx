import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  Square,
  ArrowRight,
  Play,
  RotateCw,
  Download,
  Search,
  Filter,
  AlertTriangle,
  ShieldCheck,
  Eye,
  BookOpen,
  Check,
  Terminal,
} from 'lucide-react';
import {
  BeforeAfterSnapshot,
  CleaningRecommendation,
  DatasetProfile,
  EngineSummary,
  ExceptionItem,
} from '../types/idata';
import {
  computeHistogram,
  extractNumericColumns,
} from '../utils/analytics';
import {
  CHART_COLORS,
  BarChartCard,
  HistogramChartCard,
  PieOrDonutChartCard,
} from './ChartsSuite';

/* -------------------------------------------------------------------------- */
/* Data Profiling View (Column Profiler + Histogram, Missing & Quality)       */
/* -------------------------------------------------------------------------- */
export const DataProfilingView: React.FC<{
  fileName: string;
  profile: DatasetProfile | null;
  originalRecords: Record<string, string>[];
  summary: EngineSummary | null;
  onNavigateStudio: () => void;
}> = ({ fileName, profile, originalRecords, summary, onNavigateStudio }) => {
  const numericCols = useMemo(
    () => (profile ? extractNumericColumns(profile.headers, originalRecords) : []),
    [profile, originalRecords]
  );

  const [histCol, setHistCol] = useState<string>('');

  useEffect(() => {
    if (numericCols.length > 0) {
      if (!numericCols.some((c) => c.column === histCol)) {
        setHistCol(numericCols[0].column);
      }
    } else {
      setHistCol('');
    }
  }, [numericCols, histCol]);

  const histogramBins = useMemo(() => {
    const found = numericCols.find((c) => c.column === histCol);
    return found ? computeHistogram(found.values) : [];
  }, [numericCols, histCol]);

  const missingBarData = useMemo(() => {
    if (!profile) return [];
    return profile.columns
      .filter((c) => c.missing_count > 0)
      .sort((a, b) => b.missing_count - a.missing_count)
      .map((c) => ({ column: c.column_name, missing: c.missing_count }));
  }, [profile]);

  const qualityDistData = useMemo(() => {
    if (!profile) return [];
    if (summary) {
      return [
        { name: 'Clean Compliant', value: summary.valid_records, color: CHART_COLORS.successGreen },
        { name: 'Quarantined', value: summary.quarantined_records, color: CHART_COLORS.errorRed },
      ];
    }
    const totalCells = Math.max(1, profile.total_rows * Math.max(1, profile.total_columns));
    return [
      {
        name: 'Populated Cells',
        value: Math.max(0, totalCells - profile.total_missing_cells),
        color: CHART_COLORS.corporateBlue,
      },
      {
        name: 'Missing Cells',
        value: profile.total_missing_cells,
        color: CHART_COLORS.warningAmber,
      },
    ];
  }, [profile, summary]);

  if (!profile) {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center space-y-4">
        <h2 className="text-lg font-bold text-[#172554]">Intelligent Data Profiling</h2>
        <p className="text-xs text-[#64748B]">Select or upload a CSV/Excel dataset in CSV Engine Studio to inspect statistical distributions.</p>
        <button
          type="button"
          onClick={onNavigateStudio}
          className="px-5 py-2.5 bg-[#171653] hover:bg-[#211D6B] text-white text-xs font-bold rounded-lg"
        >
          Open CSV Engine Studio
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#172554]">Data Profiling &amp; Statistical Analysis</h1>
          <p className="text-xs text-[#64748B] mt-1">
            Active Dataset: <span className="font-mono font-semibold text-[#172554]">{fileName}</span> · Domain: {profile.domain_title} ({profile.domain_confidence_pct}% match)
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
          <span>{profile.total_rows} rows</span>
          <span className="text-[#CBD5E1]">·</span>
          <span>{profile.total_columns} cols</span>
          <span className="text-[#CBD5E1]">·</span>
          <span className="font-bold text-[#3659B8]">Score {profile.data_quality_score}%</span>
        </div>
      </div>

      {/* Column Taxonomy Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#172554]">Column Schema &amp; Semantic Typing</h3>
          <span className="text-xs text-[#64748B] font-mono">Primary Key: {profile.primary_identifier || 'None'}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F5F7FC] border-b border-[#E2E8F0] text-[#172554] font-mono text-[11px]">
                <th className="py-2.5 px-4 font-bold">Column</th>
                <th className="py-2.5 px-4 font-bold">Physical Type</th>
                <th className="py-2.5 px-4 font-bold">Semantic Role</th>
                <th className="py-2.5 px-4 font-bold">Key Status</th>
                <th className="py-2.5 px-4 font-bold text-right">Missing</th>
                <th className="py-2.5 px-4 font-bold text-right">Unique %</th>
                <th className="py-2.5 px-4 font-bold">Sample Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-mono text-[11px] tabular-nums">
              {profile.columns.map((c) => (
                <tr key={c.column_name} className="hover:bg-[#F5F7FC]">
                  <td className="py-2.5 px-4 font-bold text-[#172554]">{c.column_name}</td>
                  <td className="py-2.5 px-4 text-[#64748B]">{c.physical_type}</td>
                  <td className="py-2.5 px-4 font-semibold text-[#3659B8]">{c.semantic_type}</td>
                  <td className="py-2.5 px-4">
                    {c.is_potential_identifier ? (
                      <span className="text-[#10B981] font-bold">Primary ID</span>
                    ) : (
                      <span className="text-[#64748B]">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    {c.missing_count > 0 ? (
                      <span className="text-[#F59E0B] font-bold">
                        {c.missing_count} ({c.missing_percentage}%)
                      </span>
                    ) : (
                      <span className="text-[#10B981]">0</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right text-[#172554]">{c.unique_percentage}%</td>
                  <td className="py-2.5 px-4 text-[#64748B] max-w-[160px] truncate">
                    {c.sample_values[0] || 'NULL'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statistical Visualizations Grid */}
      <div className="space-y-4">
        <HistogramChartCard
          title="Histogram — Numerical Value Distribution"
          subtitle={histCol ? `Frequency distribution of [${histCol}]` : undefined}
          bins={histogramBins}
          exportFilename="profiling_histogram"
          rightControl={
            numericCols.length > 0 && (
              <select
                value={histCol}
                onChange={(e) => setHistCol(e.target.value)}
                className="h-7 px-2 bg-[#F5F7FC] border border-[#E2E8F0] rounded-md text-xs font-mono text-[#172554]"
              >
                {numericCols.map((nc) => (
                  <option key={nc.column} value={nc.column}>{nc.column}</option>
                ))}
              </select>
            )
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BarChartCard
            title="Missing Values by Column"
            subtitle="Null / empty cells per column in original dataset"
            data={missingBarData}
            xKey="column"
            horizontal
            bars={[{ key: 'missing', name: 'Missing Cells', color: CHART_COLORS.warningAmber }]}
            emptyMessage="Zero missing cells detected in the active dataset."
            exportFilename="profiling_missing_values"
          />

          <PieOrDonutChartCard
            title="Dataset Quality Distribution"
            subtitle={summary ? 'Clean vs Quarantined Records' : 'Populated vs Missing Cells'}
            data={qualityDistData}
            donut
            exportFilename="profiling_quality_distribution"
          />
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Schema Taxonomy View                                                       */
/* -------------------------------------------------------------------------- */
export const SchemaTaxonomyView: React.FC<{
  profile: DatasetProfile | null;
}> = ({ profile }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-2">
        <h1 className="text-xl font-bold text-[#172554] flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#3659B8]" />
          <span>Universal Schema Taxonomy &amp; Data Dictionary</span>
        </h1>
        <p className="text-xs text-[#64748B] leading-relaxed">
          Dynamic multi-domain taxonomy rules automatically applied across Student, Employee HR, Inventory, E-Commerce Orders, Healthcare, and custom datasets.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
        {[
          {
            role: 'zero_padded_identifier',
            desc: 'Preserves leading zeros (e.g. 00101, postal codes) as exact strings without float truncation.',
          },
          {
            role: 'email',
            desc: 'Trims whitespace, converts to canonical lowercase, and validates RFC 5322 syntax.',
          },
          {
            role: 'date',
            desc: 'Normalizes mixed formats (MM/DD/YYYY, DD-MM-YYYY, YYYY/MM/DD) to ISO-8601 YYYY-MM-DD.',
          },
          {
            role: 'currency',
            desc: 'Strips currency symbols ($, €, £, ¥, ₹) and thousand separators; enforces non-negative pricing.',
          },
          {
            role: 'phone',
            desc: 'Extracts digits and validates 10–13 digit national/E.164 phone numbers.',
          },
          {
            role: 'integer / decimal',
            desc: 'Verifies numeric cast integrity, non-negative stock/quantity bounds, and cross-field math equations.',
          },
        ].map((item) => (
          <div key={item.role} className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-1.5">
            <div className="font-mono font-bold text-[#3659B8]">{item.role}</div>
            <p className="text-[#64748B] leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      {profile && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#172554]">
              Active Dataset Schema ({profile.domain_title})
            </h3>
            <span className="text-xs font-mono text-[#64748B]">{profile.columns.length} fields</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F5F7FC] border-b border-[#E2E8F0] text-[#172554] font-mono text-[11px]">
                  <th className="py-2.5 px-4 font-bold">Field</th>
                  <th className="py-2.5 px-4 font-bold">Physical Type</th>
                  <th className="py-2.5 px-4 font-bold">Semantic Role</th>
                  <th className="py-2.5 px-4 font-bold">Enforced Constraints</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {profile.columns.map((c) => (
                  <tr key={c.column_name} className="hover:bg-[#F5F7FC]">
                    <td className="py-2.5 px-4 font-mono font-bold text-[#172554]">{c.column_name}</td>
                    <td className="py-2.5 px-4 font-mono text-[#64748B]">{c.physical_type}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-[#3659B8]">{c.semantic_type}</td>
                    <td className="py-2.5 px-4 text-[#172554]">
                      {c.is_potential_identifier
                        ? 'Non-null primary key uniqueness & zero preservation'
                        : 'Type verification, null normalization & whitespace trimming'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Data Cleaning View                                                         */
/* -------------------------------------------------------------------------- */
export const DataCleaningView: React.FC<{
  fileName: string;
  recommendations: CleaningRecommendation[];
  enabledRuleMap: Record<string, boolean>;
  onToggleRule: (id: string) => void;
  onEnableAll: () => void;
  onExecutePipeline: () => void;
  isValidating: boolean;
  engineLogs: string;
}> = ({
  fileName,
  recommendations,
  enabledRuleMap,
  onToggleRule,
  onEnableAll,
  onExecutePipeline,
  isValidating,
  engineLogs,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#172554]">Dynamic Data Cleaning Rules</h1>
          <p className="text-xs text-[#64748B] mt-1">
            Configure automated standardization operations for <span className="font-mono font-semibold text-[#172554]">{fileName}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onEnableAll}
            className="px-3.5 py-2 bg-[#F5F7FC] hover:bg-[#E2E8F0]/60 text-[#172554] border border-[#E2E8F0] text-xs font-bold rounded-lg whitespace-nowrap"
          >
            Enable All Rules
          </button>
          <button
            type="button"
            onClick={onExecutePipeline}
            disabled={isValidating}
            className="px-5 py-2 bg-[#171653] hover:bg-[#211D6B] text-white text-xs font-bold rounded-lg inline-flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
          >
            {isValidating ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin text-[#28B8D5]" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current text-[#28B8D5]" />
            )}
            <span>{isValidating ? 'Executing...' : 'Execute Cleaning Pipeline'}</span>
          </button>
        </div>
      </div>

      {recommendations.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 text-center text-xs text-[#64748B]">
          No cleaning recommendations generated yet. Select or upload a dataset first.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendations.map((rec) => {
            const isEnabled = enabledRuleMap[rec.id] ?? rec.enabled;
            return (
              <div
                key={rec.id}
                onClick={() => onToggleRule(rec.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-colors flex flex-col justify-between gap-3 ${
                  isEnabled
                    ? 'bg-white border-[#3659B8]'
                    : 'bg-[#F5F7FC] border-[#E2E8F0] opacity-65'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {isEnabled ? (
                      <CheckSquare className="w-4 h-4 text-[#171653] shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-[#64748B] shrink-0" />
                    )}
                    <span className="text-xs font-bold text-[#172554]">{rec.name}</span>
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-[#64748B] shrink-0">
                    {rec.severity}
                  </span>
                </div>

                <p className="text-xs text-[#64748B] leading-relaxed">{rec.description}</p>

                <div className="p-2.5 rounded-lg bg-[#F5F7FC] border border-[#E2E8F0] font-mono text-[11px] flex items-center justify-between gap-2">
                  <span className="text-[#EF4444] truncate">{rec.preview.before}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#3659B8] shrink-0" />
                  <span className="text-[#10B981] font-semibold truncate">{rec.preview.after}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {engineLogs && (
        <div className="bg-[#171653] text-[#10B981] rounded-xl p-4 font-mono text-xs whitespace-pre-wrap leading-relaxed">
          <div className="flex items-center gap-2 text-white/80 pb-2 mb-2 border-b border-white/10">
            <Terminal className="w-3.5 h-3.5 text-[#28B8D5]" />
            <span>Last Execution Log</span>
          </div>
          {engineLogs}
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Data Validation View                                                       */
/* -------------------------------------------------------------------------- */
export const DataValidationView: React.FC<{
  fileName: string;
  profile: DatasetProfile | null;
  summary: EngineSummary | null;
  comparison: BeforeAfterSnapshot | null;
  cleanRecords: Record<string, string>[];
  exceptions: ExceptionItem[];
  onExecutePipeline: () => void;
  isValidating: boolean;
  onInspectRecord: (rec: any) => void;
  onDownloadClean: () => void;
}> = ({
  fileName,
  profile,
  summary,
  comparison,
  cleanRecords,
  exceptions,
  onExecutePipeline,
  isValidating,
  onInspectRecord,
  onDownloadClean,
}) => {
  const validInvalidData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: 'Valid Records', value: summary.valid_records, color: CHART_COLORS.successGreen },
      { name: 'Invalid / Quarantined', value: summary.quarantined_records, color: CHART_COLORS.errorRed },
    ];
  }, [summary]);

  const errorClassData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ex of exceptions) {
      map[ex.violation_type] = (map[ex.violation_type] || 0) + 1;
    }
    return Object.entries(map).map(([category, count]) => ({
      category: category.replace(/_/g, ' '),
      count,
    }));
  }, [exceptions]);

  const beforeAfterErrorData = useMemo(() => {
    if (!comparison) return [];
    return [
      {
        stage: 'Before Cleaning',
        missing: comparison.before.missingValues,
        format: comparison.before.formatViolations,
        invalid: comparison.before.invalidRecords,
      },
      {
        stage: 'After Cleaning',
        missing: comparison.after.remainingMissingValues,
        format: comparison.after.remainingFormatViolations,
        invalid: comparison.after.remainingInvalidRecords,
      },
    ];
  }, [comparison]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#172554]">Data Validation &amp; Clean Output</h1>
          <p className="text-xs text-[#64748B] mt-1">
            Partition compliant records from anomalies for <span className="font-mono font-semibold text-[#172554]">{fileName}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onExecutePipeline}
            disabled={isValidating}
            className="px-5 py-2 bg-[#171653] hover:bg-[#211D6B] text-white text-xs font-bold rounded-lg inline-flex items-center gap-2"
          >
            {isValidating ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin text-[#28B8D5]" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current text-[#28B8D5]" />
            )}
            <span>{isValidating ? 'Validating...' : 'Run Validation'}</span>
          </button>
          <button
            type="button"
            onClick={onDownloadClean}
            disabled={cleanRecords.length === 0}
            className="px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Clean CSV</span>
          </button>
        </div>
      </div>

      {summary ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <PieOrDonutChartCard
              title="Valid vs Invalid Records"
              data={validInvalidData}
              exportFilename="validation_valid_invalid"
            />
            <BarChartCard
              title="Error Classification"
              data={errorClassData}
              xKey="category"
              bars={[{ key: 'count', name: 'Count', color: CHART_COLORS.errorRed }]}
              emptyMessage="Zero validation exceptions triggered."
              exportFilename="validation_error_classification"
            />
            <BarChartCard
              title="Before & After Error Comparison"
              data={beforeAfterErrorData}
              xKey="stage"
              stacked
              bars={[
                { key: 'missing', name: 'Missing', color: CHART_COLORS.warningAmber },
                { key: 'format', name: 'Format', color: CHART_COLORS.corporateBlue },
                { key: 'invalid', name: 'Invalid', color: CHART_COLORS.errorRed },
              ]}
              exportFilename="validation_before_after_errors"
            />
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#172554] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                <span>Clean Validated Warehouse Dataset ({cleanRecords.length} records)</span>
              </h3>
              <span className="text-xs font-mono text-[#10B981] font-bold">
                {summary.pass_rate_pct}% Pass Rate
              </span>
            </div>
            <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#F5F7FC] text-[#172554] sticky top-0 border-b border-[#E2E8F0] font-mono text-[11px]">
                  <tr>
                    {profile?.headers.map((h) => (
                      <th key={h} className="py-2.5 px-4 whitespace-nowrap font-bold">{h}</th>
                    ))}
                    <th className="py-2.5 px-4 text-center">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] font-mono text-[11px] tabular-nums">
                  {cleanRecords.map((r, idx) => (
                    <tr key={idx} className="hover:bg-[#F5F7FC]">
                      {profile?.headers.map((h) => (
                        <td key={h} className="py-2 px-4 whitespace-nowrap text-[#172554]">
                          {r[h] || <span className="text-[#64748B]">—</span>}
                        </td>
                      ))}
                      <td className="py-2 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => onInspectRecord(r)}
                          className="p-1 text-[#64748B] hover:text-[#172554]"
                          title="Inspect Record JSON"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center text-xs text-[#64748B]">
          Click <span className="font-bold text-[#172554]">Run Validation</span> above to validate and inspect clean records.
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Exception Management View                                                  */
/* -------------------------------------------------------------------------- */
export const ExceptionManagementView: React.FC<{
  fileName: string;
  exceptions: ExceptionItem[];
  onDownloadExceptions: () => void;
  onExecutePipeline: () => void;
  hasProcessedRun: boolean;
}> = ({ fileName, exceptions, onDownloadExceptions, onExecutePipeline, hasProcessedRun }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const violationTypes = useMemo(
    () => Array.from(new Set(exceptions.map((e) => e.violation_type))),
    [exceptions]
  );

  const filtered = exceptions.filter((ex) => {
    const matchesType = typeFilter === 'ALL' || ex.violation_type === typeFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      ex.record_id.toLowerCase().includes(q) ||
      ex.field_name.toLowerCase().includes(q) ||
      ex.error_message.toLowerCase().includes(q);
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#172554] flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
            <span>Exception Management &amp; Quarantine Register</span>
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Isolated anomaly traceability for <span className="font-mono font-semibold text-[#172554]">{fileName}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!hasProcessedRun && (
            <button
              type="button"
              onClick={onExecutePipeline}
              className="px-4 py-2 bg-[#171653] hover:bg-[#211D6B] text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current text-[#28B8D5]" />
              <span>Run Validation</span>
            </button>
          )}
          <button
            type="button"
            onClick={onDownloadExceptions}
            disabled={exceptions.length === 0}
            className="px-4 py-2 bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Exceptions CSV</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 bg-[#F5F7FC]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search quarantined records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-3 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#172554] w-60 focus:outline-none focus:border-[#3659B8]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#64748B]" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-8 px-2.5 bg-white border border-[#E2E8F0] rounded-lg text-xs font-mono font-semibold text-[#172554]"
            >
              <option value="ALL">All Violations ({exceptions.length})</option>
              {violationTypes.map((vt) => (
                <option key={vt} value={vt}>{vt}</option>
              ))}
            </select>
          </div>
        </div>

        {!hasProcessedRun ? (
          <div className="p-10 text-center text-xs text-[#64748B]">
            Run validation on the active dataset to populate the Quarantine Exception Register.
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#10B981] font-semibold flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            <span>Zero exceptions match the current filter criteria.</span>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#FEF2F2] text-[#991B1B] sticky top-0 border-b border-[#FECACA] font-bold">
                <tr>
                  <th className="py-2.5 px-4">Row #</th>
                  <th className="py-2.5 px-4">Record ID</th>
                  <th className="py-2.5 px-4">Field</th>
                  <th className="py-2.5 px-4">Violation</th>
                  <th className="py-2.5 px-4">Severity</th>
                  <th className="py-2.5 px-4">Raw Value</th>
                  <th className="py-2.5 px-4">Diagnosis &amp; Suggested Fix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] font-mono text-[11px] tabular-nums">
                {filtered.map((ex, idx) => (
                  <tr key={idx} className="hover:bg-[#FEF2F2]/40">
                    <td className="py-2.5 px-4 text-[#64748B]">#{ex.row_number}</td>
                    <td className="py-2.5 px-4 font-bold text-[#172554]">{ex.record_id}</td>
                    <td className="py-2.5 px-4 text-[#EF4444] font-bold">{ex.field_name}</td>
                    <td className="py-2.5 px-4 text-[#172554] font-semibold">{ex.violation_type}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`font-bold ${
                          ex.severity === 'CRITICAL' ? 'text-[#EF4444]' : 'text-[#F59E0B]'
                        }`}
                      >
                        {ex.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-[#EF4444] max-w-[160px] truncate">
                      {ex.raw_value || 'EMPTY_NULL'}
                    </td>
                    <td className="py-2.5 px-4 font-sans text-xs">
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
    </div>
  );
};
