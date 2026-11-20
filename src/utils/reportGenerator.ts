import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  BeforeAfterSnapshot,
  DatasetProfile,
  ExceptionItem,
  SixDimensionItem,
} from '../types/idata';

export interface QualityReportPayload {
  datasetName: string;
  fileFormat: string;
  profile: DatasetProfile;
  comparison: BeforeAfterSnapshot;
  dimensions: SixDimensionItem[];
  cleanedRecords: Record<string, string>[];
  exceptionRecords: ExceptionItem[];
  passRatePct: number;
}

export function downloadQualityReportExcel(payload: QualityReportPayload): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Executive Summary
  const summaryRows = [
    ['iData Engine v2.5 — Before & After Data Quality Report', ''],
    ['Dataset Name', payload.datasetName],
    ['Detected Domain', `${payload.profile.domain_title} (${payload.profile.domain_confidence_pct}% match)`],
    ['Source Format', payload.fileFormat],
    ['Primary Identifier Key', payload.profile.primary_identifier || 'None Detected'],
    ['Report Generated At', new Date(payload.comparison.generatedAt).toLocaleString()],
    ['Validation Status', payload.exceptionRecords.length === 0 ? 'PASSED (Zero Exceptions)' : `COMPLETED WITH ${payload.comparison.after.quarantinedRecords} QUARANTINED RECORD(S)`],
    ['', ''],
    ['Important Accounting Note', 'Quarantined invalid records are isolated separately in the Exception Register and NOT counted as cleaned records.'],
    ['Original Total Records', payload.comparison.before.totalRecords],
    ['Clean Warehouse Records', payload.comparison.after.finalCleanRecords],
    ['Quarantined Records (Isolated)', payload.comparison.after.quarantinedRecords],
    ['Records Automatically Cleaned (In-Place)', payload.comparison.autoCleanedRecords],
    ['Cells Automatically Standardized', payload.comparison.autoCleanedCells],
    ['Pass Rate (%)', `${payload.passRatePct}%`],
    ['Initial Quality Score', `${payload.comparison.before.qualityScore}%`],
    ['Final Clean Dataset Quality Score', `${payload.comparison.after.qualityScore}%`],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

  // Sheet 2: Before vs After Comparison
  const compHeader = [['Metric', 'Before Cleaning', 'After Cleaning', 'Improvement / Quarantine Accounting', 'Notes']];
  const compBody = payload.comparison.comparisonRows.map((r) => [
    r.metric,
    r.before,
    r.after,
    r.improvement,
    r.note || '',
  ]);
  const wsComp = XLSX.utils.aoa_to_sheet([...compHeader, ...compBody]);
  XLSX.utils.book_append_sheet(wb, wsComp, 'Before vs After');

  // Sheet 3: Cleaning Operations Performed
  const opsRows = [
    ['#', 'Cleaning / Validation Rule Executed'],
    ...(payload.comparison.operationsPerformed.length > 0
      ? payload.comparison.operationsPerformed.map((op, i) => [i + 1, op])
      : [[1, 'Standard whitespace trimming, null normalization, and primary key uniqueness check']]),
  ];
  const wsOps = XLSX.utils.aoa_to_sheet(opsRows);
  XLSX.utils.book_append_sheet(wb, wsOps, 'Cleaning Operations');

  // Sheet 4: Six Quality Dimensions
  const dimHeader = [['Dimension', 'Score (%)', 'Status', 'Weight', 'Methodology', 'Identified Issues']];
  const dimBody = payload.dimensions.map((d) => [
    d.label,
    d.verifiable && d.percentage !== null ? `${d.percentage}%` : 'N/A',
    d.status,
    d.weight,
    d.methodology,
    d.identifiedProblems.join(' | '),
  ]);
  const wsDim = XLSX.utils.aoa_to_sheet([...dimHeader, ...dimBody]);
  XLSX.utils.book_append_sheet(wb, wsDim, 'Six Quality Dimensions');

  // Sheet 5: Clean Validated Dataset
  if (payload.cleanedRecords.length > 0) {
    const wsClean = XLSX.utils.json_to_sheet(payload.cleanedRecords);
    XLSX.utils.book_append_sheet(wb, wsClean, 'Clean Dataset');
  }

  // Sheet 6: Quarantined Exception Register
  if (payload.exceptionRecords.length > 0) {
    const wsExc = XLSX.utils.json_to_sheet(payload.exceptionRecords);
    XLSX.utils.book_append_sheet(wb, wsExc, 'Quarantined Exceptions');
  }

  const safeBase = payload.datasetName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '_');
  XLSX.writeFile(wb, `${safeBase}_quality_report.xlsx`);
}

export function downloadQualityReportPDF(payload: QualityReportPayload): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Banner
  doc.setFillColor(23, 22, 83); // #171653 Primary Navy
  doc.rect(0, 0, pageWidth, 82, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('iData Engine v2.5 — Before & After Quality Report', 36, 36);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(40, 184, 213); // #28B8D5 Accent Cyan
  doc.text(
    `Dataset: ${payload.datasetName}  |  Domain: ${payload.profile.domain_title}  |  Format: ${payload.fileFormat}`,
    36,
    56
  );

  doc.setTextColor(203, 213, 225);
  doc.setFontSize(8.5);
  doc.text(`Generated: ${new Date(payload.comparison.generatedAt).toLocaleString()}`, 36, 71);

  let yPos = 104;

  // Section 1: Executive Validation & Quarantine Summary
  doc.setTextColor(23, 37, 84);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('1. Executive Summary & Quarantine Accounting', 36, yPos);
  yPos += 10;

  const statusText =
    payload.exceptionRecords.length === 0
      ? 'PASSED — Zero Remaining Exceptions'
      : `VALIDATED — ${payload.comparison.after.finalCleanRecords} Clean / ${payload.comparison.after.quarantinedRecords} Quarantined`;

  autoTable(doc, {
    startY: yPos,
    margin: { left: 36, right: 36 },
    headStyles: { fillColor: [33, 29, 107], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8.5, textColor: [23, 37, 84] },
    head: [['Attribute', 'Measured Value']],
    body: [
      ['Dataset Name & Primary Key', `${payload.datasetName} (Key: ${payload.profile.primary_identifier || 'None'})`],
      ['Original Record Count (Preserved)', `${payload.comparison.before.totalRecords}`],
      ['Clean Warehouse Records', `${payload.comparison.after.finalCleanRecords} (${payload.passRatePct}%)`],
      ['Quarantined Records (Isolated Separately)', `${payload.comparison.after.quarantinedRecords}`],
      ['Records Automatically Standardized In-Place', `${payload.comparison.autoCleanedRecords} (${payload.comparison.autoCleanedCells} cells)`],
      ['Final Validation Status', statusText],
    ],
  });

  yPos = (doc as any).lastAutoTable.finalY + 18;

  // Section 2: Before vs After Comparison Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('2. Before & After Quality Comparison', 36, yPos);
  yPos += 10;

  autoTable(doc, {
    startY: yPos,
    margin: { left: 36, right: 36 },
    headStyles: { fillColor: [54, 89, 184], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8.5, textColor: [23, 37, 84] },
    head: [['Metric', 'Before Cleaning', 'After Cleaning', 'Improvement / Notes']],
    body: payload.comparison.comparisonRows.map((r) => [
      r.metric,
      String(r.before),
      String(r.after),
      r.improvement,
    ]),
  });

  yPos = (doc as any).lastAutoTable.finalY + 18;

  // Embedded Visual Bar Comparison (Before vs After Quality Score & Errors)
  if (yPos > 660) {
    doc.addPage();
    yPos = 42;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('3. Quality Score & Error Reduction Chart', 36, yPos);
  yPos += 14;

  const chartBoxW = pageWidth - 72;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(245, 247, 252);
  doc.roundedRect(36, yPos, chartBoxW, 88, 4, 4, 'FD');

  const drawBarRow = (label: string, valBefore: number, valAfter: number, maxScale: number, rowY: number, isHigherBetter: boolean) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(23, 37, 84);
    doc.text(label, 48, rowY + 10);

    const barStart = 180;
    const barMaxW = chartBoxW - 210;
    const wBefore = Math.max(4, Math.min(barMaxW, (valBefore / Math.max(1, maxScale)) * barMaxW));
    const wAfter = Math.max(4, Math.min(barMaxW, (valAfter / Math.max(1, maxScale)) * barMaxW));

    doc.setFillColor(245, 158, 11); // Amber Before
    doc.rect(barStart, rowY, wBefore, 7, 'F');
    doc.setFillColor(isHigherBetter ? 16 : 54, isHigherBetter ? 185 : 89, isHigherBetter ? 129 : 184); // Emerald / Blue After
    doc.rect(barStart, rowY + 10, wAfter, 7, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Before: ${valBefore}  ->  After: ${valAfter}`, barStart + barMaxW + 8, rowY + 11, { align: 'right' });
  };

  drawBarRow(
    'Quality Score (%)',
    payload.comparison.before.qualityScore,
    payload.comparison.after.qualityScore,
    100,
    yPos + 14,
    true
  );
  const maxIssues = Math.max(
    1,
    payload.comparison.before.missingValues + payload.comparison.before.formatViolations,
    payload.comparison.before.invalidRecords
  );
  drawBarRow(
    'Missing + Format Issues',
    payload.comparison.before.missingValues + payload.comparison.before.formatViolations,
    payload.comparison.after.remainingMissingValues + payload.comparison.after.remainingFormatViolations,
    maxIssues,
    yPos + 46,
    false
  );

  yPos += 108;

  // Section 4: Cleaning Operations Performed & Six Dimensions
  if (yPos > 620) {
    doc.addPage();
    yPos = 42;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(23, 37, 84);
  doc.text('4. Six-Dimension Enterprise Quality Monitoring', 36, yPos);
  yPos += 10;

  autoTable(doc, {
    startY: yPos,
    margin: { left: 36, right: 36 },
    headStyles: { fillColor: [23, 22, 83], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [23, 37, 84] },
    head: [['Dimension', 'Score', 'Status', 'Methodology']],
    body: payload.dimensions.map((d) => [
      d.label,
      d.verifiable && d.percentage !== null ? `${d.percentage}%` : 'N/A',
      d.status,
      d.methodology,
    ]),
  });

  yPos = (doc as any).lastAutoTable.finalY + 18;

  // Section 5: Cleaning Operations & Remaining Quarantine Exceptions
  if (yPos > 640) {
    doc.addPage();
    yPos = 42;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('5. Cleaning Operations & Quarantined Exceptions', 36, yPos);
  yPos += 10;

  autoTable(doc, {
    startY: yPos,
    margin: { left: 36, right: 36 },
    headStyles: { fillColor: [33, 29, 107], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [23, 37, 84] },
    head: [['Executed Operations']],
    body: (payload.comparison.operationsPerformed.length > 0
      ? payload.comparison.operationsPerformed
      : ['Standard whitespace trimming & null normalization']
    ).map((op) => [op]),
  });

  if (payload.exceptionRecords.length > 0) {
    const excY = (doc as any).lastAutoTable.finalY + 14;
    autoTable(doc, {
      startY: excY,
      margin: { left: 36, right: 36 },
      headStyles: { fillColor: [239, 68, 68], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [23, 37, 84] },
      head: [['Row #', 'Record ID', 'Field', 'Violation Code', 'Raw Value', 'Diagnosis']],
      body: payload.exceptionRecords.slice(0, 40).map((ex) => [
        ex.row_number,
        ex.record_id,
        ex.field_name,
        ex.violation_type,
        ex.raw_value || 'EMPTY_NULL',
        ex.error_message,
      ]),
    });
  }

  const safeBase = payload.datasetName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '_');
  doc.save(`${safeBase}_quality_report.pdf`);
}
