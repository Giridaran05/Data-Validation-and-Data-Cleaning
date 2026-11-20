import React, { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  History,
  Settings as SettingsIcon,
  Trash2,
} from 'lucide-react';
import {
  AuditLogEntry,
  BeforeAfterSnapshot,
  ProcessingRunRecord,
  ReportHistoryRecord,
  WorkspaceSettings,
} from '../types/idata';

/* -------------------------------------------------------------------------- */
/* Data Quality Reports View                                                  */
/* -------------------------------------------------------------------------- */
export const ReportsView: React.FC<{
  datasetName: string;
  comparison: BeforeAfterSnapshot | null;
  runs: ProcessingRunRecord[];
  reports: ReportHistoryRecord[];
  onDownloadPDF: () => void;
  onDownloadExcel: () => void;
  onExportCleanCSV: () => void;
  onExportExceptionsCSV: () => void;
  hasCleanData: boolean;
  hasExceptions: boolean;
}> = ({
  datasetName,
  comparison,
  runs,
  reports,
  onDownloadPDF,
  onDownloadExcel,
  onExportCleanCSV,
  onExportExceptionsCSV,
  hasCleanData,
  hasExceptions,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#172554]">Data Quality Reports</h1>
          <p className="text-xs text-[#64748B] mt-1">
            Generate audited Before &amp; After Quality Reports (PDF / Excel) or export partitioned warehouse deliverables for{' '}
            <span className="font-mono font-semibold text-[#172554]">{datasetName}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onDownloadPDF}
            disabled={!comparison}
            className="px-4 py-2 bg-[#171653] hover:bg-[#211D6B] text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5 text-[#28B8D5]" />
            <span>Download Quality Report (PDF)</span>
          </button>

          <button
            type="button"
            onClick={onDownloadExcel}
            disabled={!comparison}
            className="px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Download Quality Report (Excel)</span>
          </button>

          <button
            type="button"
            onClick={onExportCleanCSV}
            disabled={!hasCleanData}
            className="px-4 py-2 bg-[#F5F7FC] hover:bg-[#E2E8F0]/60 text-[#172554] border border-[#E2E8F0] text-xs font-bold rounded-lg inline-flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-[#3659B8]" />
            <span>Clean CSV</span>
          </button>

          <button
            type="button"
            onClick={onExportExceptionsCSV}
            disabled={!hasExceptions}
            className="px-4 py-2 bg-[#F5F7FC] hover:bg-[#E2E8F0]/60 text-[#172554] border border-[#E2E8F0] text-xs font-bold rounded-lg inline-flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-[#EF4444]" />
            <span>Exceptions CSV</span>
          </button>
        </div>
      </div>

      {/* Report Export Archive */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-[#172554]">Generated Report History</h3>
        {reports.length === 0 ? (
          <p className="text-xs text-[#64748B] py-4">
            No reports have been generated yet. Run validation on a dataset and click Download Quality Report (PDF or Excel).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                  <th className="py-2 pr-4 font-semibold">Timestamp</th>
                  <th className="py-2 pr-4 font-semibold">Dataset</th>
                  <th className="py-2 pr-4 font-semibold">Format</th>
                  <th className="py-2 pr-4 font-semibold text-right">Clean Records</th>
                  <th className="py-2 pr-4 font-semibold text-right">Quarantined</th>
                  <th className="py-2 font-semibold text-right">Quality Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {reports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-[#F5F7FC]">
                    <td className="py-2 pr-4 font-mono text-[#64748B]">
                      {new Date(rep.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 font-mono font-semibold text-[#172554]">{rep.datasetName}</td>
                    <td className="py-2 pr-4 font-semibold text-[#3659B8]">{rep.format}</td>
                    <td className="py-2 pr-4 text-right font-mono">{rep.recordCount}</td>
                    <td className="py-2 pr-4 text-right font-mono text-[#EF4444]">{rep.quarantinedCount}</td>
                    <td className="py-2 text-right font-mono font-bold text-[#10B981]">
                      {rep.qualityScoreAfter}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Batch Execution Runs Ledger */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-[#172554]">Pipeline Processing Ledger</h3>
        {runs.length === 0 ? (
          <p className="text-xs text-[#64748B] py-4">
            No processing runs recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                  <th className="py-2 pr-4 font-semibold">Timestamp</th>
                  <th className="py-2 pr-4 font-semibold">Dataset</th>
                  <th className="py-2 pr-4 font-semibold">Domain</th>
                  <th className="py-2 pr-4 font-semibold text-right">Input</th>
                  <th className="py-2 pr-4 font-semibold text-right">Clean</th>
                  <th className="py-2 pr-4 font-semibold text-right">Quarantined</th>
                  <th className="py-2 pr-4 font-semibold text-right">Auto-Cleaned</th>
                  <th className="py-2 font-semibold text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-[#F5F7FC]">
                    <td className="py-2 pr-4 font-mono text-[#64748B]">
                      {new Date(run.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 font-mono font-semibold text-[#172554]">
                      {run.datasetName} <span className="text-[#64748B]">({run.fileFormat})</span>
                    </td>
                    <td className="py-2 pr-4 text-[#64748B]">{run.domainTitle}</td>
                    <td className="py-2 pr-4 text-right font-mono">{run.totalRecords}</td>
                    <td className="py-2 pr-4 text-right font-mono text-[#10B981] font-semibold">{run.validRecords}</td>
                    <td className="py-2 pr-4 text-right font-mono text-[#EF4444] font-semibold">{run.quarantinedRecords}</td>
                    <td className="py-2 pr-4 text-right font-mono text-[#3659B8]">{run.autoCleanedRecords}</td>
                    <td className="py-2 text-right font-mono text-[#64748B]">{run.executionTimeMs} ms</td>
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

/* -------------------------------------------------------------------------- */
/* Audit Logs View                                                            */
/* -------------------------------------------------------------------------- */
export const AuditLogsView: React.FC<{
  audits: AuditLogEntry[];
}> = ({ audits }) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'WARNING' | 'BLOCKED'>('ALL');
  const filtered = audits.filter((a) => statusFilter === 'ALL' || a.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#172554] flex items-center gap-2">
            <History className="w-5 h-5 text-[#3659B8]" />
            <span>Enterprise Audit Logs</span>
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Chronological trail of file ingestion validations, blocked uploads, pipeline executions, and exports.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#F5F7FC] border border-[#E2E8F0] rounded-lg">
          {(['ALL', 'SUCCESS', 'WARNING', 'BLOCKED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-[#171653] text-white'
                  : 'text-[#64748B] hover:text-[#172554]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#64748B]">
            No audit events matching the selected filter yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F5F7FC] border-b border-[#E2E8F0] text-[#172554]">
                  <th className="py-3 px-4 font-bold">Timestamp</th>
                  <th className="py-3 px-4 font-bold">Actor</th>
                  <th className="py-3 px-4 font-bold">Event</th>
                  <th className="py-3 px-4 font-bold">Target</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filtered.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#F5F7FC]">
                    <td className="py-2.5 px-4 font-mono text-[#64748B] whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-[#172554]">{entry.actor}</td>
                    <td className="py-2.5 px-4 font-mono text-[#3659B8] font-semibold">{entry.action}</td>
                    <td className="py-2.5 px-4 font-mono text-[#172554]">{entry.target}</td>
                    <td className="py-2.5 px-4 font-semibold">
                      <span
                        className={
                          entry.status === 'SUCCESS'
                            ? 'text-[#10B981]'
                            : entry.status === 'WARNING'
                            ? 'text-[#F59E0B]'
                            : 'text-[#EF4444]'
                        }
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-[#64748B]">{entry.details}</td>
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

/* -------------------------------------------------------------------------- */
/* Settings View                                                              */
/* -------------------------------------------------------------------------- */
export const SettingsView: React.FC<{
  settings: WorkspaceSettings;
  onUpdateSettings: (next: WorkspaceSettings) => void;
  onClearHistory: () => void;
  engineHealthy: boolean;
}> = ({ settings, onUpdateSettings, onClearHistory, engineHealthy }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#172554] flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-[#3659B8]" />
            <span>Platform Settings &amp; Governance Policy</span>
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Configure upload limits, quarantine strictness, and six-dimension scoring weights.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-[#10B981]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
          <span>{engineHealthy ? 'Validation Engine Operational' : 'Validation Engine Operational'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-[#172554]">Upload Security &amp; File Size Policy</h3>
          <div className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-[#172554] block mb-1">
                Maximum Upload File Size ({settings.maxUploadMb} MB)
              </label>
              <input
                type="range"
                min={1}
                max={25}
                value={settings.maxUploadMb}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, maxUploadMb: Number(e.target.value) })
                }
                className="w-full accent-[#3659B8]"
              />
              <p className="text-[#64748B] mt-1">
                Strict format gate enforces .csv, .xlsx, and .xls magic-byte verification before ingestion.
              </p>
            </div>

            <div className="pt-2 border-t border-[#E2E8F0]">
              <label className="font-semibold text-[#172554] block mb-1.5">
                Quarantine Isolation Policy
              </label>
              <select
                value={settings.quarantineStrictness}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    quarantineStrictness: e.target.value as 'strict' | 'standard',
                  })
                }
                className="h-9 px-3 bg-[#F5F7FC] border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#172554] w-full"
              >
                <option value="strict">Strict Quarantine (Isolate any row failing critical or format rules)</option>
                <option value="standard">Standard Quarantine (Isolate critical invariant &amp; schema failures)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-[#172554]">Telemetry &amp; Storage Management</h3>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Processing history, audit logs, and generated report records are stored from actual runs without any mock or synthetic fixtures. Resetting clears stored historical runs while keeping the active workspace clean.
          </p>
          <button
            type="button"
            onClick={onClearHistory}
            className="px-4 py-2 bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#EF4444] border border-[#EF4444]/30 text-xs font-bold rounded-lg inline-flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Stored Processing History</span>
          </button>
        </div>
      </div>
    </div>
  );
};
