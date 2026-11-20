import React from 'react';
import {
  FileCheck,
  Download,
  RefreshCw,
  ShieldAlert,
  ArrowRight,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import {
  BeforeAfterSnapshot,
  ProcessingRunRecord,
} from '../types/idata';
import {
  CHART_COLORS,
  BarChartCard,
  PieOrDonutChartCard,
  LineTrendChartCard,
} from './ChartsSuite';

interface DatasetComparisonViewProps {
  datasetName: string;
  comparison: BeforeAfterSnapshot | null;
  hasProcessedRun: boolean;
  runs: ProcessingRunRecord[];
  onGenerateComparison: () => void;
  onDownloadPDF: () => void;
  onDownloadExcel: () => void;
  onNavigateStudio: () => void;
}

export const DatasetComparisonView: React.FC<DatasetComparisonViewProps> = ({
  datasetName,
  comparison,
  hasProcessedRun,
  runs,
  onGenerateComparison,
  onDownloadPDF,
  onDownloadExcel,
  onNavigateStudio,
}) => {
  if (!hasProcessedRun || !comparison) {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center space-y-4">
        <h2 className="text-lg font-bold text-[#172554]">Before &amp; After Dataset Quality Comparison</h2>
        <p className="text-xs text-[#64748B] max-w-lg mx-auto leading-relaxed">
          Run the cleaning and validation pipeline on your active dataset to preserve the raw original input separately and generate an audited Before-and-After Quality Comparison.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onGenerateComparison}
            className="px-5 py-2.5 bg-[#171653] hover:bg-[#211D6B] text-white text-xs font-bold rounded-lg inline-flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#28B8D5]" />
            <span>Generate Quality Comparison</span>
          </button>
          <button
            type="button"
            onClick={onNavigateStudio}
            className="px-5 py-2.5 bg-[#F5F7FC] hover:bg-[#E2E8F0]/60 text-[#172554] border border-[#E2E8F0] text-xs font-bold rounded-lg"
          >
            Open CSV Engine Studio
          </button>
        </div>
      </div>
    );
  }

  const scoreCompareData = [
    {
      stage: 'Quality Score (%)',
      before: comparison.before.qualityScore,
      after: comparison.after.qualityScore,
    },
  ];

  const errorReductionData = [
    {
      metric: 'Missing Values',
      before: comparison.before.missingValues,
      after: comparison.after.remainingMissingValues,
    },
    {
      metric: 'Duplicate Records',
      before: comparison.before.duplicateRecords,
      after: comparison.after.remainingDuplicates,
    },
    {
      metric: 'Invalid Records',
      before: comparison.before.invalidRecords,
      after: comparison.after.remainingInvalidRecords,
    },
    {
      metric: 'Format Errors',
      before: comparison.before.formatViolations,
      after: comparison.after.remainingFormatViolations,
    },
    {
      metric: 'Outliers',
      before: comparison.before.detectedOutliers,
      after: comparison.after.remainingOutliers,
    },
  ];

  const qualityDistData = [
    {
      name: 'Clean Compliant Records',
      value: comparison.after.finalCleanRecords,
      color: CHART_COLORS.successGreen,
    },
    {
      name: 'Quarantined Records (Isolated)',
      value: comparison.after.quarantinedRecords,
      color: CHART_COLORS.errorRed,
    },
  ];

  const cleaningImpactData = [
    {
      category: 'Before Cleaning',
      compliant: Math.max(0, comparison.before.totalRecords - comparison.before.invalidRecords),
      issues: comparison.before.invalidRecords,
      quarantined: 0,
    },
    {
      category: 'After Cleaning',
      compliant: comparison.after.finalCleanRecords,
      issues: comparison.after.remainingFormatViolations + comparison.after.remainingMissingValues,
      quarantined: comparison.after.quarantinedRecords,
    },
  ];

  const trendData = [...runs]
    .reverse()
    .map((r, i) => ({
      run: `#${i + 1} ${r.datasetName.slice(0, 10)}`,
      before: r.dataQualityScore,
      after: r.afterQualityScore,
    }));

  return (
    <div className="space-y-6">
      {/* Header & Action Controls */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-[#172554]">
            Before &amp; After Quality Report
          </h1>
          <p className="text-xs text-[#64748B]">
            Comparing preserved original dataset <span className="font-mono font-semibold text-[#172554]">{datasetName}</span> against validated clean output · Quarantined records accounted separately.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onGenerateComparison}
            className="px-4 py-2 bg-[#F5F7FC] hover:bg-[#E2E8F0]/60 text-[#172554] border border-[#E2E8F0] text-xs font-bold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#3659B8]" />
            <span>Generate Quality Comparison</span>
          </button>

          <button
            type="button"
            onClick={onDownloadPDF}
            className="px-4 py-2 bg-[#171653] hover:bg-[#211D6B] text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5 text-[#28B8D5]" />
            <span>Download Quality Report (PDF)</span>
          </button>

          <button
            type="button"
            onClick={onDownloadExcel}
            className="px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Download Quality Report (Excel)</span>
          </button>
        </div>
      </div>

      {/* Explicit Quarantine Accounting Banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-[#F59E0B] shrink-0 mt-0.5" />
          <div className="text-xs text-[#172554] space-y-0.5">
            <div className="font-bold">Transparent Quarantine Accounting</div>
            <p className="text-[#64748B]">
              Original dataset ({comparison.before.totalRecords} records) is preserved intact.{' '}
              <span className="font-semibold text-[#172554]">{comparison.autoCleanedRecords} records</span> were automatically standardized in-place ({comparison.autoCleanedCells} cells), while{' '}
              <span className="font-semibold text-[#EF4444]">{comparison.after.quarantinedRecords} unrecoverable records</span> were isolated to the Exception Register rather than counted as repaired.
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Before Cleaning vs After Cleaning Breakdown Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <h2 className="text-sm font-bold text-[#172554]">Before Cleaning (Original Preserved)</h2>
            <span className="font-mono text-sm font-bold text-[#F59E0B] tabular-nums">
              {comparison.before.qualityScore}% Score
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs tabular-nums">
            <div className="p-3 rounded-lg bg-[#F5F7FC]">
              <div className="text-[#64748B]">Original Record Count</div>
              <div className="font-mono text-lg font-bold text-[#172554]">{comparison.before.totalRecords}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#F5F7FC]">
              <div className="text-[#64748B]">Missing Values</div>
              <div className="font-mono text-lg font-bold text-[#F59E0B]">{comparison.before.missingValues}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#F5F7FC]">
              <div className="text-[#64748B]">Duplicate Records</div>
              <div className="font-mono text-lg font-bold text-[#172554]">{comparison.before.duplicateRecords}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#F5F7FC]">
              <div className="text-[#64748B]">Invalid Records</div>
              <div className="font-mono text-lg font-bold text-[#EF4444]">{comparison.before.invalidRecords}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#F5F7FC]">
              <div className="text-[#64748B]">Type Inconsistencies</div>
              <div className="font-mono text-lg font-bold text-[#172554]">{comparison.before.typeInconsistencies}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#F5F7FC]">
              <div className="text-[#64748B]">Format Violations</div>
              <div className="font-mono text-lg font-bold text-[#F59E0B]">{comparison.before.formatViolations}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#F5F7FC]">
              <div className="text-[#64748B]">Detected Outliers (IQR)</div>
              <div className="font-mono text-lg font-bold text-[#172554]">{comparison.before.detectedOutliers}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#F5F7FC]">
              <div className="text-[#64748B]">Initial Quality Score</div>
              <div className="font-mono text-lg font-bold text-[#172554]">{comparison.before.qualityScore}%</div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <h2 className="text-sm font-bold text-[#172554]">After Cleaning (Validated Output)</h2>
            <span className="font-mono text-sm font-bold text-[#10B981] tabular-nums">
              {comparison.after.qualityScore}% Score
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs tabular-nums">
            <div className="p-3 rounded-lg bg-[#F5F7FC]">
              <div className="text-[#64748B]">Final Clean Record Count</div>
              <div className="font-mono text-lg font-bold text-[#10B981]">{comparison.after.finalCleanRecords}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#F5F7FC]">
              <div className="text-[#64748B]">Remaining Missing Values</div>
              <div className="font-mono text-lg font-bold text-[#172554]">{comparison.after.remainingMissingValues}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#F5F7FC]">
              <div className="text-[#64748B]">Remaining Duplicates</div>
              <div className="font-mono text-lg font-bold text-[#10B981]">{comparison.after.remainingDuplicates}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#F5F7FC]">
              <div className="text-[#64748B]">Remaining Invalid Records</div>
              <div className="font-mono text-lg font-bold text-[#10B981]">{comparison.after.remainingInvalidRecords}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#F5F7FC]">
              <div className="text-[#64748B]">Remaining Format Violations</div>
              <div className="font-mono text-lg font-bold text-[#172554]">{comparison.after.remainingFormatViolations}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#F5F7FC]">
              <div className="text-[#64748B]">Remaining Outliers (IQR)</div>
              <div className="font-mono text-lg font-bold text-[#172554]">{comparison.after.remainingOutliers}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#EF4444]/20">
              <div className="text-[#EF4444] font-semibold">Quarantined Records</div>
              <div className="font-mono text-lg font-bold text-[#EF4444]">{comparison.after.quarantinedRecords}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#ECFDF5] border border-[#10B981]/20">
              <div className="text-[#10B981] font-semibold">Final Quality Score</div>
              <div className="font-mono text-lg font-bold text-[#10B981]">{comparison.after.qualityScore}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#172554] flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-[#3659B8]" />
            <span>Before &amp; After Comparison Matrix</span>
          </h3>
          <span className="text-xs text-[#64748B] font-mono">
            Auto-cleaned: {comparison.autoCleanedRecords} rows ({comparison.autoCleanedCells} cells)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F5F7FC] border-b border-[#E2E8F0] text-[#172554]">
                <th className="py-3 px-4 font-bold">Metric</th>
                <th className="py-3 px-4 font-bold text-right">Before Cleaning</th>
                <th className="py-3 px-4 font-bold text-right">After Cleaning</th>
                <th className="py-3 px-4 font-bold">Improvement / Quarantine Accounting</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] tabular-nums">
              {comparison.comparisonRows.map((row) => (
                <tr key={row.metric} className="hover:bg-[#F5F7FC]">
                  <td className="py-2.5 px-4 font-semibold text-[#172554]">{row.metric}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-[#64748B]">{row.before}</td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-[#172554]">{row.after}</td>
                  <td className="py-2.5 px-4 font-mono text-[#3659B8] font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <ArrowRight className="w-3 h-3 text-[#28B8D5]" />
                      {row.improvement}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5 Comparison Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarChartCard
          title="Before vs After Quality Score"
          subtitle="Initial dataset quality score vs final validated score"
          data={scoreCompareData}
          xKey="stage"
          bars={[
            { key: 'before', name: 'Before Cleaning (%)', color: CHART_COLORS.warningAmber },
            { key: 'after', name: 'After Cleaning (%)', color: CHART_COLORS.successGreen },
          ]}
          exportFilename="comparison_quality_score"
        />

        <BarChartCard
          title="Error Reduction by Issue Class"
          subtitle="Remaining counts after sanitization and quarantine isolation"
          data={errorReductionData}
          xKey="metric"
          horizontal
          bars={[
            { key: 'before', name: 'Before Cleaning', color: CHART_COLORS.errorRed },
            { key: 'after', name: 'After Cleaning', color: CHART_COLORS.corporateBlue },
          ]}
          exportFilename="comparison_error_reduction"
        />

        <PieOrDonutChartCard
          title="Data Quality Distribution"
          subtitle="Clean compliant records vs quarantined exceptions"
          data={qualityDistData}
          donut
          exportFilename="comparison_quality_distribution"
        />

        <BarChartCard
          title="Cleaning Impact Breakdown"
          subtitle="Record compliance shift between original and final output"
          data={cleaningImpactData}
          xKey="category"
          stacked
          bars={[
            { key: 'compliant', name: 'Compliant', color: CHART_COLORS.successGreen },
            { key: 'issues', name: 'Cell Anomalies', color: CHART_COLORS.warningAmber },
            { key: 'quarantined', name: 'Quarantined', color: CHART_COLORS.errorRed },
          ]}
          exportFilename="comparison_cleaning_impact"
        />
      </div>

      <LineTrendChartCard
        title="Quality Improvement Trend Across Historical Runs"
        subtitle="Before and After quality trajectory when historical runs exist"
        data={trendData}
        xKey="run"
        lines={[
          { key: 'before', name: 'Before Cleaning (%)', color: CHART_COLORS.warningAmber },
          { key: 'after', name: 'After Cleaning (%)', color: CHART_COLORS.successGreen },
        ]}
        emptyMessage="Historical runs will accumulate automatically as additional datasets are validated."
        exportFilename="comparison_historical_trend"
      />
    </div>
  );
};
