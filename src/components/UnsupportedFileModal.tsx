import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface UnsupportedFileModalProps {
  isOpen: boolean;
  fileName?: string;
  diagnosticReason?: string;
  onClose: () => void;
}

export const UnsupportedFileModal: React.FC<UnsupportedFileModalProps> = ({
  isOpen,
  fileName,
  diagnosticReason,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#171653]/70 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsupported-file-title"
    >
      <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#FEF2F2]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EF4444]/15 text-[#EF4444] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3
              id="unsupported-file-title"
              className="text-base font-bold text-[#172554]"
            >
              Unsupported File Format
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#64748B] hover:text-[#172554] p-1.5 rounded-lg hover:bg-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-sm text-[#172554] leading-relaxed space-y-3">
            <p className="font-semibold">The uploaded file format is not supported.</p>
            <p className="text-[#64748B]">
              iData Engine accepts only CSV and Excel files for data cleaning and validation.
            </p>
            <p className="font-medium text-[#211D6B]">
              Please upload a .csv, .xlsx, or .xls file to continue.
            </p>
          </div>

          {(fileName || diagnosticReason) && (
            <div className="p-3 rounded-xl bg-[#F5F7FC] border border-[#E2E8F0] text-xs text-[#64748B] space-y-1">
              {fileName && (
                <div className="font-mono truncate">
                  Rejected file: <span className="text-[#172554] font-semibold">{fileName}</span>
                </div>
              )}
              {diagnosticReason && (
                <div>Reason: {diagnosticReason}</div>
              )}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-[#171653] hover:bg-[#211D6B] text-white text-xs font-bold rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              Understood
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
