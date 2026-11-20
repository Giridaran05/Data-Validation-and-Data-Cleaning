import React, { useRef } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { Download } from 'lucide-react';
import { HistogramBin } from '../utils/analytics';

export const CHART_COLORS = {
  primaryNavy: '#171653',
  deepIndigo: '#211D6B',
  corporateBlue: '#3659B8',
  accentCyan: '#28B8D5',
  successGreen: '#10B981',
  warningAmber: '#F59E0B',
  errorRed: '#EF4444',
  slateMuted: '#64748B',
};

const PALETTE = [
  CHART_COLORS.corporateBlue,
  CHART_COLORS.accentCyan,
  CHART_COLORS.successGreen,
  CHART_COLORS.warningAmber,
  CHART_COLORS.deepIndigo,
  CHART_COLORS.errorRed,
];

interface ChartCardProps {
  title: string;
  subtitle?: string;
  rightControl?: React.ReactNode;
  children: React.ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
  exportCsvRows?: Array<Record<string, string | number>>;
  exportFilename?: string;
}

function downloadSvgElement(container: HTMLDivElement | null, filename: string) {
  if (!container) return;
  const svg = container.querySelector('svg');
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const serialized = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  rightControl,
  children,
  isEmpty,
  emptyMessage = 'No dataset metrics available for this visualization yet.',
  exportFilename = 'chart_export',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#172554] truncate">{title}</h3>
          {subtitle && (
            <p className="text-xs text-[#64748B] mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {rightControl}
          {!isEmpty && (
            <button
              type="button"
              onClick={() => downloadSvgElement(containerRef.current, exportFilename)}
              className="p-1.5 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:text-[#172554] hover:bg-[#F5F7FC] transition-colors"
              title="Export chart vector SVG"
              aria-label={`Export ${title}`}
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isEmpty ? (
        <div className="h-56 flex items-center justify-center text-center px-6 bg-[#F5F7FC] rounded-lg border border-dashed border-[#E2E8F0]">
          <p className="text-xs text-[#64748B] max-w-xs leading-relaxed">{emptyMessage}</p>
        </div>
      ) : (
        <div ref={containerRef} className="w-full">
          {children}
        </div>
      )}
    </div>
  );
};

/* 1. Pie / Donut Chart */
export const PieOrDonutChartCard: React.FC<{
  title: string;
  subtitle?: string;
  data: Array<{ name: string; value: number; color?: string }>;
  donut?: boolean;
  exportFilename?: string;
  emptyMessage?: string;
}> = ({ title, subtitle, data, donut = false, exportFilename, emptyMessage }) => {
  const validData = data.filter((d) => d.value > 0);
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      isEmpty={validData.length === 0}
      emptyMessage={emptyMessage}
      exportFilename={exportFilename}
    >
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={validData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="48%"
              innerRadius={donut ? 52 : 0}
              outerRadius={82}
              paddingAngle={donut ? 3 : 1}
            >
              {validData.map((entry, idx) => (
                <Cell key={entry.name} fill={entry.color || PALETTE[idx % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFFFFF',
                borderColor: '#E2E8F0',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#172554',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#64748B' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

/* 2. Vertical / Horizontal Bar Chart */
export const BarChartCard: React.FC<{
  title: string;
  subtitle?: string;
  data: Array<Record<string, any>>;
  xKey: string;
  bars: Array<{ key: string; name: string; color: string }>;
  horizontal?: boolean;
  stacked?: boolean;
  exportFilename?: string;
  emptyMessage?: string;
}> = ({
  title,
  subtitle,
  data,
  xKey,
  bars,
  horizontal = false,
  stacked = false,
  exportFilename,
  emptyMessage,
}) => {
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      isEmpty={!data || data.length === 0}
      emptyMessage={emptyMessage}
      exportFilename={exportFilename}
    >
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={horizontal ? 'vertical' : 'horizontal'}
            margin={{ top: 8, right: 16, left: horizontal ? 24 : 0, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            {horizontal ? (
              <>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis
                  type="category"
                  dataKey={xKey}
                  width={105}
                  tick={{ fontSize: 11, fill: '#172554' }}
                />
              </>
            ) : (
              <>
                <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
              </>
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFFFFF',
                borderColor: '#E2E8F0',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#172554',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {bars.map((b) => (
              <Bar
                key={b.key}
                dataKey={b.key}
                name={b.name}
                fill={b.color}
                stackId={stacked ? 'stack' : undefined}
                radius={stacked ? [0, 0, 0, 0] : [4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

/* 3. Line Chart (Quality Trends) */
export const LineTrendChartCard: React.FC<{
  title: string;
  subtitle?: string;
  data: Array<Record<string, any>>;
  xKey: string;
  lines: Array<{ key: string; name: string; color: string }>;
  yDomain?: [number, number];
  exportFilename?: string;
  emptyMessage?: string;
}> = ({ title, subtitle, data, xKey, lines, yDomain = [0, 100], exportFilename, emptyMessage }) => {
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      isEmpty={!data || data.length === 0}
      emptyMessage={emptyMessage}
      exportFilename={exportFilename}
    >
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#64748B' }} />
            <YAxis domain={yDomain} tick={{ fontSize: 11, fill: '#64748B' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFFFFF',
                borderColor: '#E2E8F0',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#172554',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {lines.map((l) => (
              <Line
                key={l.key}
                type="monotone"
                dataKey={l.key}
                name={l.name}
                stroke={l.color}
                strokeWidth={2.5}
                dot={{ r: 4, fill: l.color }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

/* 4. Histogram (Numerical Distribution) */
export const HistogramChartCard: React.FC<{
  title: string;
  subtitle?: string;
  bins: HistogramBin[];
  rightControl?: React.ReactNode;
  exportFilename?: string;
}> = ({ title, subtitle, bins, rightControl, exportFilename = 'histogram' }) => {
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      rightControl={rightControl}
      isEmpty={bins.length === 0}
      emptyMessage="Select a dataset with numerical columns (at least 3 values) to render distribution bins."
      exportFilename={exportFilename}
    >
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bins} barCategoryGap={2} margin={{ top: 8, right: 16, left: 0, bottom: 14 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis
              dataKey="range"
              tick={{ fontSize: 10, fill: '#64748B' }}
              interval={0}
              angle={-18}
              textAnchor="end"
              height={42}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFFFFF',
                borderColor: '#E2E8F0',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="count" name="Frequency" fill={CHART_COLORS.corporateBlue} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};
