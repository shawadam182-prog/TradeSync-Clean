import React, { useState, useRef, useEffect } from 'react';
import {
  Upload, FileSpreadsheet, Check, X, AlertCircle,
  Loader2, ArrowRight, Building2, Package, Star,
  RefreshCw, Trash2, ArrowLeft, PoundSterling
} from 'lucide-react';
import { useData } from '../src/contexts/DataContext';
import type { WholesalerPreset } from '../types';

interface ParsedMaterial {
  productCode?: string;
  name: string;
  description?: string;
  unit?: string;
  costPrice?: number;
  sellPrice?: number;
  category?: string;
  isValid: boolean;
  error?: string;
}

interface ColumnMapping {
  productCode: number;
  name: number;
  description: number;
  unit: number;
  costPrice: number;
  sellPrice: number;
  category: number;
}

// Common UK builders merchant CSV formats
const WHOLESALER_PRESETS: Record<string, { name: string; mapping: Partial<ColumnMapping>; skipRows: number; hasHeader: boolean }> = {
  jewson: {
    name: 'Jewson',
    mapping: { productCode: 0, name: 1, description: 2, unit: 3, costPrice: 4 },
    skipRows: 1,
    hasHeader: true,
  },
  travis_perkins: {
    name: 'Travis Perkins',
    mapping: { productCode: 0, name: 1, description: 2, unit: 4, costPrice: 5 },
    skipRows: 1,
    hasHeader: true,
  },
  selco: {
    name: 'Selco',
    mapping: { productCode: 0, name: 1, unit: 2, costPrice: 3 },
    skipRows: 1,
    hasHeader: true,
  },
  buildbase: {
    name: 'Buildbase',
    mapping: { productCode: 0, name: 1, description: 2, unit: 3, costPrice: 4 },
    skipRows: 1,
    hasHeader: true,
  },
  howdens: {
    name: 'Howdens',
    mapping: { productCode: 0, name: 1, description: 2, costPrice: 3 },
    skipRows: 1,
    hasHeader: true,
  },
  toolstation: {
    name: 'Toolstation',
    mapping: { productCode: 0, name: 1, costPrice: 2 },
    skipRows: 1,
    hasHeader: true,
  },
  screwfix: {
    name: 'Screwfix',
    mapping: { productCode: 0, name: 1, costPrice: 2 },
    skipRows: 1,
    hasHeader: true,
  },
  custom: {
    name: 'Custom Mapping',
    mapping: { name: 0, costPrice: 1 },
    skipRows: 0,
    hasHeader: true,
  },
};

const DEFAULT_MAPPING: ColumnMapping = {
  productCode: -1,
  name: 0,
  description: -1,
  unit: -1,
  costPrice: 1,
  sellPrice: -1,
  category: -1,
};

interface WholesalerImportPageProps {
  onBack?: () => void;
}

export const WholesalerImportPage: React.FC<WholesalerImportPageProps> = ({ onBack }) => {
  const { services } = useData();
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [rawData, setRawData] = useState<string[][]>([]);
  const [parsedMaterials, setParsedMaterials] = useState<ParsedMaterial[]>([]);
  const [selectedWholesaler, setSelectedWholesaler] = useState<string>('custom');
  const [customSupplierName, setCustomSupplierName] = useState<string>('');
  const [mapping, setMapping] = useState<ColumnMapping>(DEFAULT_MAPPING);
  const [skipRows, setSkipRows] = useState(1);
  const [defaultMarkupPercent, setDefaultMarkupPercent] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; updated: number; failed: number; errors: string[] } | null>(null);
  const [fileName, setFileName] = useState<string>('');
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

  const parsePrice = (priceStr: string): number | undefined => {
    if (!priceStr) return undefined;
    const cleaned = priceStr.replace(/[£$€\s]/g, '').replace(/,/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  };

  const inferUnit = (name: string, description?: string): string => {
    const text = `${name} ${description || ''}`.toLowerCase();

    if (text.includes('per m') || text.includes('/m') || text.includes('metre') || text.includes('meter')) {
      return 'm';
    }
    if (text.includes('per sqm') || text.includes('/sqm') || text.includes('sq m') || text.includes('square metre')) {
      return 'sqm';
    }
    if (text.includes('bag') || text.includes('25kg') || text.includes('20kg')) {
      return 'bag';
    }
    if (text.includes('sheet') || text.includes('board')) {
      return 'sheet';
    }
    if (text.includes('pack') || text.includes('box')) {
      return 'pack';
    }
    if (text.includes('roll')) {
      return 'roll';
    }
    if (text.includes('tube') || text.includes('cartridge')) {
      return 'tube';
    }
    if (text.includes('tin') || text.includes('litre') || text.includes('ltr')) {
      return 'tin';
    }
    if (text.includes('pair')) {
      return 'pair';
    }
    if (text.includes('length')) {
      return 'length';
    }
    return 'pc';
  };

  const inferCategory = (name: string, description?: string): string | undefined => {
    const text = `${name} ${description || ''}`.toLowerCase();

    if (text.includes('timber') || text.includes('wood') || text.includes('plywood') || text.includes('mdf') || text.includes('osb')) {
      return 'timber';
    }
    if (text.includes('plasterboard') || text.includes('drywall')) {
      return 'plasterboard';
    }
    if (text.includes('plaster') || text.includes('multifinish') || text.includes('bonding')) {
      return 'plaster';
    }
    if (text.includes('screw') || text.includes('nail') || text.includes('fixing') || text.includes('bracket') || text.includes('anchor')) {
      return 'fixings';
    }
    if (text.includes('insulation') || text.includes('rockwool') || text.includes('celotex') || text.includes('kingspan')) {
      return 'insulation';
    }
    if (text.includes('cable') || text.includes('wire') || text.includes('socket') || text.includes('switch') || text.includes('consumer')) {
      return 'electrical';
    }
    if (text.includes('pipe') || text.includes('fitting') || text.includes('valve') || text.includes('tap') || text.includes('copper')) {
      return 'plumbing';
    }
    if (text.includes('cement') || text.includes('concrete') || text.includes('mortar')) {
      return 'cement';
    }
    if (text.includes('brick') || text.includes('block') || text.includes('aggregate') || text.includes('sand') || text.includes('ballast')) {
      return 'aggregates';
    }
    if (text.includes('paint') || text.includes('primer') || text.includes('emulsion') || text.includes('gloss')) {
      return 'paint';
    }
    if (text.includes('adhesive') || text.includes('glue') || text.includes('silicone') || text.includes('sealant') || text.includes('foam')) {
      return 'adhesives';
    }
    if (text.includes('roof') || text.includes('tile') || text.includes('slate') || text.includes('felt')) {
      return 'roofing';
    }
    if (text.includes('door') || text.includes('handle') || text.includes('hinge')) {
      return 'doors';
    }
    if (text.includes('window') || text.includes('glass')) {
      return 'windows';
    }
    return undefined;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);
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

  const handleWholesalerSelect = (wholesalerId: string) => {
    setSelectedWholesaler(wholesalerId);
    const preset = WHOLESALER_PRESETS[wholesalerId];

    // Apply preset mapping, keeping -1 for unmapped fields
    const newMapping: ColumnMapping = { ...DEFAULT_MAPPING };
    Object.entries(preset.mapping).forEach(([key, value]) => {
      if (value !== undefined) {
        (newMapping as any)[key] = value;
      }
    });
    setMapping(newMapping);
    setSkipRows(preset.skipRows);

    if (wholesalerId !== 'custom') {
      setCustomSupplierName(preset.name);
    }
  };

  const applyMapping = () => {
    try {
      const dataRows = rawData.slice(skipRows);
      const materials: ParsedMaterial[] = dataRows
        .filter(row => row.length > 0 && row.some(cell => cell.trim()))
        .map(row => {
          const name = mapping.name >= 0 ? row[mapping.name]?.trim() : '';
          const costPrice = mapping.costPrice >= 0 ? parsePrice(row[mapping.costPrice]) : undefined;

          // Validation
          if (!name) {
            return { name: '', isValid: false, error: 'Missing name' };
          }

          const description = mapping.description >= 0 ? row[mapping.description]?.trim() : undefined;
          let unit = mapping.unit >= 0 ? row[mapping.unit]?.trim() : undefined;
          let category = mapping.category >= 0 ? row[mapping.category]?.trim() : undefined;

          // Auto-infer unit and category if not mapped
          if (!unit) {
            unit = inferUnit(name, description);
          }
          if (!category) {
            category = inferCategory(name, description);
          }

          // Calculate sell price with markup if cost price exists
          let sellPrice = mapping.sellPrice >= 0 ? parsePrice(row[mapping.sellPrice]) : undefined;
          if (!sellPrice && costPrice && defaultMarkupPercent > 0) {
            sellPrice = costPrice * (1 + defaultMarkupPercent / 100);
          }

          return {
            productCode: mapping.productCode >= 0 ? row[mapping.productCode]?.trim() : undefined,
            name,
            description,
            unit,
            costPrice,
            sellPrice,
            category,
            isValid: true,
          };
        })
        .filter(m => m.name); // Filter out empty rows

      setParsedMaterials(materials);
    } catch (err) {
      console.error('Mapping error:', err);
      setError('Failed to apply column mapping');
    }
  };

  useEffect(() => {
    if (rawData.length > 0) {
      applyMapping();
    }
  }, [rawData, mapping, skipRows, defaultMarkupPercent]);

  const handleImport = async () => {
    const supplierName = selectedWholesaler === 'custom'
      ? (customSupplierName || 'Unknown')
      : WHOLESALER_PRESETS[selectedWholesaler].name;

    if (!supplierName || supplierName === 'Unknown') {
      setError('Please enter a supplier name');
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const validMaterials = parsedMaterials.filter(m => m.isValid);

      const materialsToImport = validMaterials.map(m => ({
        product_code: m.productCode,
        name: m.name,
        description: m.description,
        unit: m.unit || 'pc',
        cost_price: m.costPrice,
        sell_price: m.sellPrice,
        category: m.category,
      }));

      const result = await services.materialsLibrary.upsertBatch(materialsToImport, supplierName);

      // Record import history
      await services.materialsImportHistory.create({
        supplier: supplierName,
        filename: fileName,
        items_imported: result.imported,
        items_updated: result.updated,
        items_failed: result.failed,
      });

      setImportResult(result);
      setStep('complete');
    } catch (err: any) {
      console.error('Import error:', err);
      setError(err.message || 'Failed to import materials');
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setStep('upload');
    setRawData([]);
    setParsedMaterials([]);
    setError(null);
    setImportResult(null);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validCount = parsedMaterials.filter(m => m.isValid).length;
  const invalidCount = parsedMaterials.filter(m => !m.isValid).length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft size={24} className="text-slate-600" />
          </button>
        )}
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Import Price List</h1>
          <p className="text-slate-500 text-sm font-medium">Upload a CSV from your wholesaler to build your materials library</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4 mb-8">
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
        <div className="bg-white rounded-3xl border border-slate-200 p-8">
          <div className="text-center mb-8">
            <FileSpreadsheet className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-black text-slate-900 mb-2">Upload Price List CSV</h2>
            <p className="text-slate-500 text-sm">Export a price list from your wholesaler account and upload it here</p>
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
            className="w-full p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center hover:border-amber-500 hover:bg-amber-50 transition-colors group"
          >
            <Upload className="w-10 h-10 text-slate-400 group-hover:text-amber-500 mx-auto mb-3 transition-colors" />
            <p className="font-bold text-slate-600 group-hover:text-amber-600 mb-1">Click to upload CSV</p>
            <p className="text-xs text-slate-400">Supports: Jewson, Travis Perkins, Selco, Buildbase, Howdens, and more</p>
          </button>

          <div className="mt-8 p-6 bg-slate-50 rounded-2xl">
            <h3 className="font-black text-sm text-slate-700 mb-3 flex items-center gap-2">
              <Building2 size={16} />
              How to export from your wholesaler
            </h3>
            <ul className="text-xs text-slate-500 space-y-2">
              <li>• <strong>Jewson:</strong> My Account → Order History → Export Price List</li>
              <li>• <strong>Travis Perkins:</strong> Trade Account → Products → Download CSV</li>
              <li>• <strong>Selco:</strong> Account → Price List → Export</li>
              <li>• <strong>Buildbase:</strong> Trade Account → Materials → Export List</li>
              <li>• <strong>Or:</strong> Use any spreadsheet with columns for Name, Price, etc.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Step 2: Preview & Map */}
      {step === 'preview' && (
        <div className="space-y-6">
          {/* Wholesaler Selection */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6">
            <h3 className="font-black text-sm text-slate-700 mb-4">Select Your Wholesaler</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(WHOLESALER_PRESETS).map(([id, preset]) => (
                <button
                  key={id}
                  onClick={() => handleWholesalerSelect(id)}
                  className={`p-4 rounded-2xl border-2 transition-all text-left ${
                    selectedWholesaler === id
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <p className={`font-bold text-sm ${selectedWholesaler === id ? 'text-amber-700' : 'text-slate-700'}`}>
                    {preset.name}
                  </p>
                </button>
              ))}
            </div>

            {/* Custom supplier name */}
            {selectedWholesaler === 'custom' && (
              <div className="mt-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Supplier Name
                </label>
                <input
                  type="text"
                  value={customSupplierName}
                  onChange={(e) => setCustomSupplierName(e.target.value)}
                  placeholder="Enter supplier name..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm"
                />
              </div>
            )}
          </div>

          {/* Column Mapping (for custom) */}
          {selectedWholesaler === 'custom' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6">
              <h3 className="font-black text-sm text-slate-700 mb-4">Column Mapping</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { field: 'productCode', label: 'Product Code' },
                  { field: 'name', label: 'Name *' },
                  { field: 'description', label: 'Description' },
                  { field: 'unit', label: 'Unit' },
                  { field: 'costPrice', label: 'Cost Price *' },
                  { field: 'sellPrice', label: 'Sell Price' },
                  { field: 'category', label: 'Category' },
                ].map(({ field, label }) => (
                  <div key={field}>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                      {label}
                    </label>
                    <select
                      value={(mapping as any)[field] ?? -1}
                      onChange={(e) => setMapping({ ...mapping, [field]: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                    >
                      <option value={-1}>Not used</option>
                      {rawData[0]?.map((header, idx) => (
                        <option key={idx} value={idx}>Col {idx + 1}: {header.slice(0, 15)}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-4">
                <div>
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
            </div>
          )}

          {/* Markup Settings */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6">
            <h3 className="font-black text-sm text-slate-700 mb-4 flex items-center gap-2">
              <PoundSterling size={16} />
              Default Markup
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              If no sell price is in the CSV, we'll calculate it from the cost price
            </p>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min={0}
                max={200}
                value={defaultMarkupPercent}
                onChange={(e) => setDefaultMarkupPercent(parseInt(e.target.value) || 0)}
                className="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
              <span className="text-slate-600 font-medium">% markup on cost</span>
            </div>
          </div>

          {/* Preview Table */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900">
                  Preview ({validCount} valid, {invalidCount} skipped)
                </h3>
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
                    <th className="text-left p-4 font-black text-slate-600 text-xs uppercase">Code</th>
                    <th className="text-left p-4 font-black text-slate-600 text-xs uppercase">Name</th>
                    <th className="text-left p-4 font-black text-slate-600 text-xs uppercase">Unit</th>
                    <th className="text-right p-4 font-black text-slate-600 text-xs uppercase">Cost</th>
                    <th className="text-right p-4 font-black text-slate-600 text-xs uppercase">Sell</th>
                    <th className="text-left p-4 font-black text-slate-600 text-xs uppercase">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedMaterials.slice(0, 50).map((material, idx) => (
                    <tr key={idx} className={`hover:bg-slate-50 ${!material.isValid ? 'opacity-50' : ''}`}>
                      <td className="p-4 text-slate-500 font-mono text-xs">{material.productCode || '-'}</td>
                      <td className="p-4 text-slate-900 font-medium truncate max-w-[200px]">
                        {material.name}
                        {material.description && (
                          <span className="text-xs text-slate-400 block truncate">{material.description}</span>
                        )}
                      </td>
                      <td className="p-4 text-slate-600">{material.unit || '-'}</td>
                      <td className="p-4 text-right text-slate-600">
                        {material.costPrice ? `£${material.costPrice.toFixed(2)}` : '-'}
                      </td>
                      <td className="p-4 text-right font-bold text-emerald-600">
                        {material.sellPrice ? `£${material.sellPrice.toFixed(2)}` : '-'}
                      </td>
                      <td className="p-4">
                        {material.category && (
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full capitalize">
                            {material.category}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedMaterials.length > 50 && (
                <p className="p-4 text-center text-slate-400 text-sm">
                  Showing 50 of {parsedMaterials.length} materials
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
              disabled={validCount === 0 || importing}
              className="flex-1 px-6 py-4 bg-amber-500 text-slate-900 rounded-2xl font-black hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {importing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Package size={20} />
                  Import {validCount} Materials
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Complete */}
      {step === 'complete' && importResult && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Import Complete!</h2>
          <p className="text-slate-500 mb-4">
            {importResult.imported > 0 && <span className="block">Added {importResult.imported} new materials</span>}
            {importResult.updated > 0 && <span className="block">Updated {importResult.updated} existing materials</span>}
            {importResult.failed > 0 && <span className="block text-amber-600">{importResult.failed} failed to import</span>}
          </p>

          {importResult.errors.length > 0 && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-left mb-6">
              <p className="font-bold text-amber-700 text-sm mb-2">Errors:</p>
              <ul className="text-xs text-amber-600 space-y-1 max-h-32 overflow-auto">
                {importResult.errors.slice(0, 10).map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
                {importResult.errors.length > 10 && (
                  <li>...and {importResult.errors.length - 10} more</li>
                )}
              </ul>
            </div>
          )}

          <div className="flex gap-4 justify-center">
            <button
              onClick={resetImport}
              className="px-6 py-3 border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-colors"
            >
              Import More
            </button>
            <button
              onClick={onBack}
              className="px-6 py-3 bg-amber-500 text-slate-900 rounded-2xl font-black hover:bg-amber-400 transition-colors"
            >
              View Materials Library
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
