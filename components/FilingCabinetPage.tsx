import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FolderOpen, Search, Upload, FileText, Image, File,
  Calendar, Tag, Download, Trash2, Edit2, X, Loader2,
  AlertTriangle, Filter, Plus, Eye, Clock, ChevronDown, ArrowLeft
} from 'lucide-react';
import { filingService, DocumentCategory, FiledDocument } from '../src/services/dataService';

const CATEGORIES: { id: DocumentCategory; label: string; icon: typeof FileText; color: string }[] = [
  { id: 'receipt', label: 'Receipts', icon: FileText, color: 'bg-blue-100 text-blue-600' },
  { id: 'invoice', label: 'Invoices', icon: FileText, color: 'bg-green-100 text-green-600' },
  { id: 'contract', label: 'Contracts', icon: FileText, color: 'bg-purple-100 text-purple-600' },
  { id: 'certificate', label: 'Certificates', icon: FileText, color: 'bg-amber-100 text-amber-600' },
  { id: 'insurance', label: 'Insurance', icon: FileText, color: 'bg-red-100 text-red-600' },
  { id: 'warranty', label: 'Warranties', icon: FileText, color: 'bg-cyan-100 text-cyan-600' },
  { id: 'tax', label: 'Tax Docs', icon: FileText, color: 'bg-orange-100 text-orange-600' },
  { id: 'bank', label: 'Bank Statements', icon: FileText, color: 'bg-indigo-100 text-indigo-600' },
  { id: 'general', label: 'General', icon: File, color: 'bg-slate-100 text-slate-600' },
];

const getFileIcon = (fileType?: string) => {
  if (!fileType) return File;
  const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  if (imageTypes.includes(fileType.toLowerCase())) return Image;
  return FileText;
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface FilingCabinetPageProps {
  onBack?: () => void;
}

export const FilingCabinetPage: React.FC<FilingCabinetPageProps> = ({ onBack }) => {
  const [documents, setDocuments] = useState<FiledDocument[]>([]);
  const [expiringDocs, setExpiringDocs] = useState<FiledDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    name: '',
    description: '',
    category: 'general' as DocumentCategory,
    document_date: '',
    expiry_date: '',
    vendor_name: '',
    tax_year: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allDocs, expiring] = await Promise.all([
        filingService.getAll(),
        filingService.getExpiring(30).catch(() => []),
      ]);
      setDocuments(allDocs || []);
      setExpiringDocs(expiring || []);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      if (categoryFilter !== 'all' && doc.category !== categoryFilter) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return doc.name.toLowerCase().includes(search) ||
          doc.description?.toLowerCase().includes(search) ||
          doc.vendor_name?.toLowerCase().includes(search);
      }
      return true;
    });
  }, [documents, categoryFilter, searchTerm]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach(doc => {
      counts[doc.category] = (counts[doc.category] || 0) + 1;
    });
    return counts;
  }, [documents]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadForm(prev => ({
        ...prev,
        file,
        name: prev.name || file.name.replace(/\.[^/.]+$/, ''),
      }));
    }
  };

  const resetUploadForm = () => {
    setUploadForm({
      file: null,
      name: '',
      description: '',
      category: 'general',
      document_date: '',
      expiry_date: '',
      vendor_name: '',
      tax_year: '',
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file || !uploadForm.name) return;

    setUploading(true);
    try {
      await filingService.upload(uploadForm.file, {
        name: uploadForm.name,
        description: uploadForm.description || undefined,
        category: uploadForm.category,
        document_date: uploadForm.document_date || undefined,
        expiry_date: uploadForm.expiry_date || undefined,
        vendor_name: uploadForm.vendor_name || undefined,
        tax_year: uploadForm.tax_year || undefined,
      });
      setShowUploadModal(false);
      resetUploadForm();
      await loadData();
    } catch (error) {
      console.error('Failed to upload:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: FiledDocument) => {
    setProcessing(doc.id);
    try {
      const url = await filingService.getDownloadUrl(doc.storage_path);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Failed to get download URL:', error);
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document permanently?')) return;
    setProcessing(id);
    try {
      await filingService.delete(id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete:', error);
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-8">
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
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Filing Cabinet</h1>
            <p className="text-slate-500 text-sm font-medium">Store and organize all your business documents</p>
          </div>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 bg-teal-500 text-slate-900 px-5 py-2 rounded-xl font-black text-sm hover:bg-teal-400 transition-colors"
        >
          <Upload size={18} />
          Upload Document
        </button>
      </div>

      {/* Expiring Documents Alert */}
      {expiringDocs.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 md:mb-8">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-amber-800">Documents Expiring Soon</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {expiringDocs.slice(0, 5).map(doc => (
              <div key={doc.id} className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl text-sm">
                <Clock size={14} className="text-amber-600" />
                <span className="font-medium text-slate-700">{doc.name}</span>
                <span className="text-slate-400">-</span>
                <span className="text-amber-600 font-bold">
                  {new Date(doc.expiry_date!).toLocaleDateString()}
                </span>
              </div>
            ))}
            {expiringDocs.length > 5 && (
              <span className="text-amber-600 font-bold text-sm self-center">
                +{expiringDocs.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Stats by Category */}
      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3 mb-4 md:mb-8">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategoryFilter(categoryFilter === cat.id ? 'all' : cat.id)}
            className={`p-3 rounded-xl text-center transition-all ${
              categoryFilter === cat.id
                ? 'bg-slate-900 text-white shadow-lg'
                : 'bg-white border border-slate-200 hover:border-slate-300'
            }`}
          >
            <p className="text-lg font-black">{categoryCounts[cat.id] || 0}</p>
            <p className="text-[9px] font-bold uppercase tracking-tight truncate">
              {cat.label}
            </p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-3 md:mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hidden md:block" size={18} />
        <input
          type="text"
          placeholder="Search documents..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 md:pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
      </div>

      {/* Documents Grid */}
      {filteredDocuments.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 py-16 text-center">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">
            {searchTerm || categoryFilter !== 'all' ? 'No documents found' : 'No documents yet'}
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="mt-4 text-teal-600 font-bold text-sm hover:underline"
          >
            Upload your first document
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map(doc => {
            const FileIcon = getFileIcon(doc.file_type);
            const categoryConfig = CATEGORIES.find(c => c.id === doc.category);
            const isExpiringSoon = doc.expiry_date && new Date(doc.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            return (
              <div
                key={doc.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${categoryConfig?.color || 'bg-slate-100 text-slate-600'}`}>
                    <FileIcon size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{doc.name}</h3>
                    {doc.description && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">{doc.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${categoryConfig?.color || 'bg-slate-100 text-slate-600'}`}>
                        {categoryConfig?.label || doc.category}
                      </span>
                      {doc.vendor_name && (
                        <span className="text-xs text-slate-400">{doc.vendor_name}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-400 space-y-1">
                    {doc.document_date && (
                      <p className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(doc.document_date).toLocaleDateString()}
                      </p>
                    )}
                    {doc.expiry_date && (
                      <p className={`flex items-center gap-1 ${isExpiringSoon ? 'text-amber-600 font-bold' : ''}`}>
                        <Clock size={12} />
                        Exp: {new Date(doc.expiry_date).toLocaleDateString()}
                      </p>
                    )}
                    <p>{formatFileSize(doc.file_size)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload(doc)}
                      disabled={processing === doc.id}
                      className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-blue-100 hover:text-blue-600 transition-colors"
                      title="Download"
                    >
                      {processing === doc.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download size={18} />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={processing === doc.id}
                      className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-red-100 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900">Upload Document</h2>
                <button
                  onClick={() => { setShowUploadModal(false); resetUploadForm(); }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <form onSubmit={handleUpload} className="p-6 space-y-5">
              {/* File Upload */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  File *
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
                />
                {uploadForm.file ? (
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <FileText className="text-slate-400" size={24} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">{uploadForm.file.name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(uploadForm.file.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setUploadForm(prev => ({ ...prev, file: null })); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="p-1 text-slate-400 hover:text-red-600"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-4 md:p-8 border-2 border-dashed border-slate-200 rounded-xl text-center hover:border-amber-500 hover:bg-amber-50 transition-colors"
                  >
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="font-bold text-slate-600">Click to select file</p>
                    <p className="text-xs text-slate-400 mt-1">PDF, Images, Word, Excel up to 10MB</p>
                  </button>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Document Name *
                </label>
                <input
                  type="text"
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Category & Vendor */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Category
                  </label>
                  <select
                    value={uploadForm.category}
                    onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value as DocumentCategory })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Vendor/Supplier
                  </label>
                  <input
                    type="text"
                    value={uploadForm.vendor_name}
                    onChange={(e) => setUploadForm({ ...uploadForm, vendor_name: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Document Date
                  </label>
                  <input
                    type="date"
                    value={uploadForm.document_date}
                    onChange={(e) => setUploadForm({ ...uploadForm, document_date: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={uploadForm.expiry_date}
                    onChange={(e) => setUploadForm({ ...uploadForm, expiry_date: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Tax Year */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Tax Year
                </label>
                <select
                  value={uploadForm.tax_year}
                  onChange={(e) => setUploadForm({ ...uploadForm, tax_year: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Select tax year</option>
                  <option value="2025-2026">2025-2026</option>
                  <option value="2024-2025">2024-2025</option>
                  <option value="2023-2024">2023-2024</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Description
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowUploadModal(false); resetUploadForm(); }}
                  className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadForm.file || !uploadForm.name || uploading}
                  className="flex-1 px-6 py-3 bg-amber-500 text-slate-900 rounded-2xl font-black hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Upload
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
