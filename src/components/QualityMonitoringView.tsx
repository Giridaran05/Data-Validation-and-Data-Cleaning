import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Sliders,
} from 'lucide-react';
import {
  ProcessingRunRecord,
  QualityWeightsConfig,
  SixDimensionItem,
} from '../types/idata';
import { CHART_COLORS, LineTrendChartCard } from './ChartsSuite';

interface QualityMonitoringViewProps {
  datasetName: string;
  dimensions: SixDimensionItem[];
  weights: QualityWeightsConfig;
  onUpdateWeights: (weights: QualityWeightsConfig) => void;
  runs: ProcessingRunRecord[];
  onNavigateStudio: () => void;
}

export const QualityMonitoringView: React.FC<QualityMonitoringViewProps> = ({
  datasetName,
  dimensions,
  weights,
  onUpdateWeights,
  runs,
  onNavigateStudio,
}) => {
  const verifiableDims = dimensions.filter((d) => d.verifiable && d.percentage !== null);
  const totalWeight = verifiableDims.reduce((acc, d) => acc + d.weight, 0);
  const weightedComposite =
    totalWeight > 0
      ? Math.round(
          (verifiableDims.reduce((acc, d) => acc + (d.percentage || 0) * d.weight, 0) /
            totalWeight) *
            10
        ) / 10
      : null;

  const trendData = [...runs]
    .reverse()
    .slice(-10)
    .map((r, idx) => ({
      run: `#${idx + 1} ${r.datasetName.slice(0, 10)}`,
      completeness: r.dimensionsSummary?.completeness ?? null,
      consistency: r.dimensionsSummary?.consistency ?? null,
      validity: r.dimensionsSummary?.validity ?? null,
      uniqueness: r.dimensionsSummary?.uniqueness ?? null,
    }));

  const getStatusIcon = (status: SixDimensionItem['status']) => {
    switch (status) {
      case 'Healthy':
        return <CheckCircle2 className="w-4 h-4 text-[#10B981]" />;
      case 'Warning':
        return <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />;
      case 'Critical':
        return <XCircle className="w-4 h-4 text-[#EF4444]" />;
      default:
        return <HelpCircle className="w-4 h-4 text-[#64748B]" />;
    }
  };

  const getStatusColor = (status: SixDimensionItem['status']) => {
    switch (status) {
      case 'Healthy':
        return 'text-[#10B981]';
      case 'Warning':
        return 'text-[#F59E0B]';
      case 'Critical':
        return 'text-[#EF4444]';
      default:
        return 'text-[#64748B]';
    }
  };

  if (dimensions.length === 0) {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center space-y-4">
        <h2 className="text-lg font-bold text-[#172554]">Six-Dimension Quality Monitoring</h2>
        <p className="text-xs text-[#64748B] max-w-md mx-auto">
          Load and validate a CSV or Excel dataset first to compute Completeness, Accuracy, Consistency, Validity, Uniqueness, and Timeliness metrics.
        </p>
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
      {/* Header Summary */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#172554]">
            Enterprise Six-Dimension Quality Monitoring
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Active Dataset: <span className="font-mono font-semibold text-[#172554]">{datasetName}</span> · Accuracy &amp; Timeliness are reported strictly when verifiable reference formulas or timestamp columns exist.
          </p>
        </div>

        <div className="flex items-center gap-4 px-4 py-2.5 bg-[#F5F7FC] border border-[#E2E8F0] rounded-xl shrink-0">
          <div className="text-xs text-[#64748B]">Weighted Verifiable Index</div>
          <div className="font-mono text-2xl font-bold text-[#171653] tabular-nums">
            {weightedComposite !== null ? `${weightedComposite}%` : '—'}
          </div>
        </div>
      </div>

      {/* 6 Dimensions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dimensions.map((dim) => (
          <div
            key={dim.key}
            className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-[#172554]">{dim.label}</span>
                <div className={`flex items-center gap-1.5 text-xs font-semibold ${getStatusColor(dim.status)}`}>
                  {getStatusIcon(dim.status)}
                  <span>{dim.status}</span>
                </div>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="font-mono text-3xl font-bold text-[#172554] tabular-nums">
                  {dim.verifiable && dim.percentage !== null ? `${dim.percentage}%` : 'N/A'}
                </span>
                <span className="text-xs font-mono text-[#64748B]">Weight: {dim.weight}%</span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-[#F5F7FC] rounded-full overflow-hidden border border-[#E2E8F0]">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${dim.verifiable && dim.percentage !== null ? dim.percentage : 0}%`,
                    backgroundColor:
                      !dim.verifiable || dim.percentage === null
                        ? '#CBD5E1'
                        : dim.percentage >= 90
                        ? CHART_COLORS.successGreen
                        : dim.percentage >= 75
                        ? CHART_COLORS.warningAmber
                        : CHART_COLORS.errorRed,
                  }}
                />
              </div>

              <div className="space-y-1 text-xs">
                <div className="font-semibold text-[#172554]">Identified Problems</div>
                <ul className="space-y-1 text-[#64748B]">
                  {dim.identifiedProblems.slice(0, 3).map((prob, idx) => (
                    <li key={idx} className="leading-snug">• {prob}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E2E8F0] space-y-1 text-[11px] text-[#64748B]">
              <div>
                <span className="font-semibold text-[#172554]">Methodology: </span>
                {dim.methodology}
              </div>
              <div className="font-mono text-[#3659B8]">{dim.formulaNote}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Configurable Formula Weights */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#172554] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#3659B8]" />
              <span>Configurable Dimension Scoring Weights</span>
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Adjust governance weights per dimension; composite index normalizes dynamically across verifiable dimensions.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {(['completeness', 'validity', 'consistency', 'uniqueness', 'accuracy', 'timeliness'] as const).map(
            (key) => (
              <div key={key} className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172554] capitalize block">
                  {key} ({weights[key]}%)
                </label>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={5}
                  value={weights[key]}
                  onChange={(e) =>
                    onUpdateWeights({ ...weights, [key]: Number(e.target.value) })
                  }
                  className="w-full accent-[#3659B8]"
                />
              </div>
            )
          )}
        </div>
      </div>

      {/* Historical Trend Chart */}
      <LineTrendChartCard
        title="Dimension Quality Trend Across Historical Runs"
        subtitle="Real historical measurements recorded across processed datasets"
        data={trendData}
        xKey="run"
        lines={[
          { key: 'completeness', name: 'Completeness', color: CHART_COLORS.corporateBlue },
          { key: 'validity', name: 'Validity', color: CHART_COLORS.successGreen },
          { key: 'consistency', name: 'Consistency', color: CHART_COLORS.accentCyan },
          { key: 'uniqueness', name: 'Uniqueness', color: CHART_COLORS.warningAmber },
        ]}
        emptyMessage="Process 1 or more datasets to plot historical dimension quality trends."
        exportFilename="six_dimensions_trend"
      />
    </div>
  );
};
