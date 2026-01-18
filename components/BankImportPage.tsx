import React, { useState, useRef } from 'react';
import {
  Upload, FileSpreadsheet, Check, X, AlertCircle,
  Loader2, ArrowRight, Building2, Calendar, PoundSterling,
  ChevronDown, Trash2, RefreshCw, ArrowLeft
} from 'lucide-react';
import { bankTransactionsService } from '../src/services/dataService';
import { validateCsvFile } from '../src/utils/fileValidation';

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  balance?: number;
  type?: string;
  reference?: string;
}

interface ColumnMapping {
  date: number;
  description: number;
  amount: number;
  balance?: number;
  type?: number;
  reference?: number;
}

// Common UK bank CSV formats
const BANK_PRESETS: Record<string, { name: string; mapping: ColumnMapping; dateFormat: string; skipRows: number; hasHeader: boolean }> = {
  starling: {
    name: 'Starling Bank',
    mapping: { date: 0, description: 1, amount: 2, balance: 3 },
    dateFormat: 'DD/MM/YYYY',
    skipRows: 1,
    hasHeader: true,
  },
  monzo: {
    name: 'Monzo',
    mapping: { date: 0, description: 4, amount: 2, balance: -1, type: 1 },
    dateFormat: 'DD/MM/YYYY',
    skipRows: 1,
    hasHeader: true,
  },
  lloyds: {
    name: 'Lloyds / Halifax',
    mapping: { date: 0, description: 4, amount: 5, balance: 6 },
    dateFormat: 'DD/MM/YYYY',
    skipRows: 1,
    hasHeader: true,
  },
  barclays: {
    name: 'Barclays',
    mapping: { date: 1, description: 5, amount: 3, balance: -1 },
    dateFormat: 'DD/MM/YYYY',
    skipRows: 1,
    hasHeader: true,
  },
  natwest: {
    name: 'NatWest / RBS',
    mapping: { date: 0, description: 2, amount: 3, balance: 4 },
    dateFormat: 'DD/MM/YYYY',
    skipRows: 1,
    hasHeader: true,
  },
  custom: {
    name: 'Custom Mapping',
    mapping: { date: 0, description: 1, amount: 2 },
    dateFormat: 'DD/MM/YYYY',
    skipRows: 0,
    hasHeader: true,
  },
};

interface BankImportPageProps {
  onBack?: () => void;
}

export const BankImportPage: React.FC<BankImportPageProps> = ({ onBack }) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [rawData, setRawData] = useState<string[][]>([]);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>('custom');
  const [mapping, setMapping] = useState<ColumnMapping>(BANK_PRESETS.custom.mapping);
  const [skipRows, setSkipRows] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): string[][] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    return lines.map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  };

  const parseDate = (dateStr: string): string => {
    // Try DD/MM/YYYY format first (UK standard)
    const ukMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (ukMatch) {
      const [, day, month, year] = ukMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Try YYYY-MM-DD format
    const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return dateStr;
    }

    // Try DD-MM-YYYY format
    const dashMatch = dateStr.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (dashMatch) {
      const [, day, month, year] = dashMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return dateStr;
  };

  const parseAmount = (amountStr: string): number => {
    // Remove currency symbols and whitespace
    const cleaned = amountStr.replace(/[£$€\s]/g, '').replace(/,/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate CSV file
    const validation = validateCsvFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const data = parseCSV(text);
        if (data.length < 2) {
          setError('CSV file appears to be empty or invalid');
          return;
        }
        setRawData(data);
        setStep('preview');
      } catch (err) {
        setError('Failed to parse CSV file');
      }
    };
    reader.onerror = () => setError('Failed to read file');
    reader.readAsText(file);
  };

  const handleBankSelect = (bankId: string) => {
    setSelectedBank(bankId);
    const preset = BANK_PRESETS[bankId];
    setMapping(preset.mapping);
    setSkipRows(preset.skipRows);
  };

  const applyMapping = () => {
    try {
      const dataRows = rawData.slice(skipRows);
      const transactions: ParsedTransaction[] = dataRows
        .filter(row => row.length > Math.max(mapping.date, mapping.description, mapping.amount))
        .map(row => ({
          date: parseDate(row[mapping.date] || ''),
          description: row[mapping.description] || '',
          amount: parseAmount(row[mapping.amount] || '0'),
          balance: mapping.balance !== undefined && mapping.balance >= 0 ? parseAmount(row[mapping.balance] || '0') : undefined,
          type: mapping.type !== undefined && mapping.type >= 0 ? row[mapping.type] : undefined,
          reference: mapping.reference !== undefined && mapping.reference >= 0 ? row[mapping.reference] : undefined,
        }))
        .filter(t => t.date && t.description && t.amount !== 0);

      setParsedTransactions(transactions);
    } catch (err) {
      setError('Failed to apply column mapping');
    }
  };

  React.useEffect(() => {
    if (rawData.length > 0) {
      applyMapping();
    }
  }, [rawData, mapping, skipRows]);

  const handleImport = async () => {
    setImporting(true);
    setError(null);

    try {
      const batchId = `import_${Date.now()}`;
      const transactionsToImport = parsedTransactions.map(t => ({
        transaction_date: t.date,
        description: t.description,
        amount: t.amount,
        balance: t.balance,
        transaction_type: t.type,
        reference: t.reference,
        import_batch_id: batchId,
        bank_name: BANK_PRESETS[selectedBank]?.name || 'Unknown',
      }));

      await bankTransactionsService.importBatch(transactionsToImport);
      setImportResult({ success: transactionsToImport.length, failed: 0 });
      setStep('complete');
    } catch (err: any) {
      setError(err.message || 'Failed to import transactions');
      setImportResult({ success: 0, failed: parsedTransactions.length });
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setStep('upload');
    setRawData([]);
    setParsedTransactions([]);
    setError(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 md:gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 md:p-2 -ml-1 md:-ml-2 text-slate-500 hover:text-slate-700 bg-slate-100 md:bg-transparent hover:bg-slate-200 md:hover:bg-slate-100 rounded-xl transition-colors active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Go back"
            >
              <ArrowLeft size={22} className="md:w-5 md:h-5" />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Bank Import</h1>
            <p className="text-slate-500 text-sm font-medium">Import transactions from your bank statement CSV</p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4 mb-4 md:mb-8">
        {['Upload', 'Preview', 'Import'].map((label, idx) => {
          const stepNum = idx + 1;
          const isActive = (step === 'upload' && stepNum === 1) ||
                          (step === 'preview' && stepNum === 2) ||
                          ((step === 'importing' || step === 'complete') && stepNum === 3);
          const isComplete = (step === 'preview' && stepNum === 1) ||
                            ((step === 'importing' || step === 'complete') && stepNum <= 2);
          return (
            <React.Fragment key={label}>
              <div className={`flex items-center gap-2 ${isActive ? 'text-amber-600' : isComplete ? 'text-emerald-600' : 'text-slate-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                  isActive ? 'bg-amber-100' : isComplete ? 'bg-emerald-100' : 'bg-slate-100'
                }`}>
                  {isComplete ? <Check size={16} /> : stepNum}
                </div>
                <span className="font-bold text-sm hidden sm:inline">{label}</span>
              </div>
              {idx < 2 && <ArrowRight size={18} className="text-slate-300" />}
            </React.Fragment>
          );
        })}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <span className="font-medium text-sm">{error}</span>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 md:p-8">
          <div className="text-center mb-4 md:mb-8">
            <FileSpreadsheet className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-black text-slate-900 mb-2">Upload Bank Statement</h2>
            <p className="text-slate-500 text-sm">Export a CSV file from your online banking and upload it here</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full p-4 md:p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center hover:border-teal-500 hover:bg-teal-50 transition-colors group"
          >
            <Upload className="w-10 h-10 text-slate-400 group-hover:text-teal-500 mx-auto mb-3 transition-colors" />
            <p className="font-bold text-slate-600 group-hover:text-teal-600 mb-1">Click to upload CSV</p>
            <p className="text-xs text-slate-400">Supports most UK banks: Starling, Monzo, Lloyds, Barclays, NatWest</p>
          </button>

          <div className="mt-8 p-3 md:p-6 bg-slate-50 rounded-2xl">
            <h3 className="font-black text-sm text-slate-700 mb-3 flex items-center gap-2">
              <Building2 size={16} />
              How to export from your bank
            </h3>
            <ul className="text-xs text-slate-500 space-y-2">
              <li>• <strong>Starling:</strong> Statements → Export → CSV</li>
              <li>• <strong>Monzo:</strong> Account → Download statement → CSV</li>
              <li>• <strong>Lloyds:</strong> Statements → Export → Download as CSV</li>
              <li>• <strong>Barclays:</strong> Statements → Download → CSV format</li>
            </ul>
          </div>
        </div>
      )}

      {/* Step 2: Preview & Map */}
      {step === 'preview' && (
        <div className="space-y-6">
          {/* Bank Selection */}
          <div className="bg-white rounded-3xl border border-slate-200 p-3 md:p-6">
            <h3 className="font-black text-sm text-slate-700 mb-4">Select Your Bank</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(BANK_PRESETS).map(([id, preset]) => (
                <button
                  key={id}
                  onClick={() => handleBankSelect(id)}
                  className={`p-4 rounded-2xl border-2 transition-all text-left ${
                    selectedBank === id
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <p className={`font-bold text-sm ${selectedBank === id ? 'text-teal-700' : 'text-slate-700'}`}>
                    {preset.name}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Column Mapping (for custom) */}
          {selectedBank === 'custom' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-3 md:p-6">
              <h3 className="font-black text-sm text-slate-700 mb-4">Column Mapping</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {['date', 'description', 'amount', 'balance'].map((field) => (
                  <div key={field}>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                      {field} Column
                    </label>
                    <select
                      value={(mapping as any)[field] ?? -1}
                      onChange={(e) => setMapping({ ...mapping, [field]: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                    >
                      <option value={-1}>Not used</option>
                      {rawData[0]?.map((header, idx) => (
                        <option key={idx} value={idx}>Col {idx + 1}: {header.slice(0, 20)}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Skip Header Rows
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={skipRows}
                  onChange={(e) => setSkipRows(parseInt(e.target.value) || 0)}
                  className="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </div>
            </div>
          )}

          {/* Preview Table */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900">Preview ({parsedTransactions.length} transactions)</h3>
                <p className="text-xs text-slate-500">Review before importing</p>
              </div>
              <button
                onClick={applyMapping}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <RefreshCw size={16} />
                <span className="text-sm font-bold">Refresh</span>
              </button>
            </div>

            <div className="max-h-[400px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left p-4 font-black text-slate-600 text-xs uppercase">Date</th>
                    <th className="text-left p-4 font-black text-slate-600 text-xs uppercase">Description</th>
                    <th className="text-right p-4 font-black text-slate-600 text-xs uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedTransactions.slice(0, 50).map((tx, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-4 text-slate-600">{tx.date}</td>
                      <td className="p-4 text-slate-900 font-medium truncate max-w-[300px]">{tx.description}</td>
                      <td className={`p-4 text-right font-bold ${tx.amount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {tx.amount < 0 ? '-' : '+'}£{Math.abs(tx.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedTransactions.length > 50 && (
                <p className="p-4 text-center text-slate-400 text-sm">
                  Showing 50 of {parsedTransactions.length} transactions
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={resetImport}
              className="flex-1 px-6 py-4 border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={parsedTransactions.length === 0 || importing}
              className="flex-1 px-6 py-4 bg-teal-500 text-slate-900 rounded-2xl font-black hover:bg-teal-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {importing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Check size={20} />
                  Import {parsedTransactions.length} Transactions
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Complete */}
      {step === 'complete' && importResult && (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 md:p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3 md:mb-6">
            <Check className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Import Complete!</h2>
          <p className="text-slate-500 mb-4 md:mb-8">
            Successfully imported {importResult.success} transactions
          </p>

          <div className="flex gap-4 justify-center">
            <button
              onClick={resetImport}
              className="px-6 py-3 border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-colors"
            >
              Import More
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-teal-500 text-slate-900 rounded-2xl font-black hover:bg-teal-400 transition-colors"
            >
              View Transactions
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
