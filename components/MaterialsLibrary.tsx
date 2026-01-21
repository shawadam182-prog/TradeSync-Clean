import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, Search, Star, Filter, Plus, Edit2, Trash2,
  Upload, ChevronDown, X, Check, AlertCircle, Loader2,
  Building2, Tag, PoundSterling, ArrowLeft, MoreVertical
} from 'lucide-react';
import { useData } from '../src/contexts/DataContext';
import { WholesalerImportPage } from './WholesalerImportPage';
import type { DBMaterialLibraryItem } from '../types';

interface MaterialsLibraryProps {
  onSelectMaterial?: (material: DBMaterialLibraryItem) => void;
  selectionMode?: boolean;
  onBack?: () => void;
}

export const MaterialsLibrary: React.FC<MaterialsLibraryProps> = ({
  onSelectMaterial,
  selectionMode = false,
  onBack,
}) => {
  const { services } = useData();
  const [view, setView] = useState<'library' | 'import'>('library');
  const [materials, setMaterials] = useState<DBMaterialLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stats, setStats] = useState({ totalItems: 0, suppliers: 0, categories: 0, favourites: 0 });

  // Edit modal state
  const [editingMaterial, setEditingMaterial] = useState<DBMaterialLibraryItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    unit: '',
    cost_price: '',
    sell_price: '',
    category: '',
  });
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [materialsData, suppliersData, categoriesData, statsData] = await Promise.all([
        services.materialsLibrary.getAll(),
        services.materialsLibrary.getSuppliers(),
        services.materialsLibrary.getCategories(),
        services.materialsLibrary.getStats(),
      ]);
      setMaterials(materialsData || []);
      setSuppliers(suppliersData || []);
      setCategories(categoriesData || []);
      setStats(statsData);
    } catch (err: any) {
      console.error('Failed to load materials:', err);
      setError(err.message || 'Failed to load materials');
    } finally {
      setLoading(false);
    }
  }, [services.materialsLibrary]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  // Filter materials
  const filteredMaterials = materials.filter(m => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        m.name.toLowerCase().includes(query) ||
        m.product_code?.toLowerCase().includes(query) ||
        m.description?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Supplier filter
    if (selectedSupplier !== 'all' && m.supplier !== selectedSupplier) return false;

    // Category filter
    if (selectedCategory !== 'all' && m.category !== selectedCategory) return false;

    // Favourites filter
    if (showFavouritesOnly && !m.is_favourite) return false;

    return true;
  });

  const handleToggleFavourite = async (id: string) => {
    try {
      await services.materialsLibrary.toggleFavourite(id);
      setMaterials(prev =>
        prev.map(m => m.id === id ? { ...m, is_favourite: !m.is_favourite } : m)
      );
    } catch (err) {
      console.error('Failed to toggle favourite:', err);
    }
  };

  const handleEdit = (material: DBMaterialLibraryItem) => {
    setEditingMaterial(material);
    setEditForm({
      name: material.name,
      description: material.description || '',
      unit: material.unit || 'pc',
      cost_price: material.cost_price?.toString() || '',
      sell_price: material.sell_price?.toString() || '',
      category: material.category || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingMaterial) return;
    setSaving(true);
    try {
      await services.materialsLibrary.update(editingMaterial.id, {
        name: editForm.name,
        description: editForm.description || undefined,
        unit: editForm.unit || 'pc',
        cost_price: editForm.cost_price ? parseFloat(editForm.cost_price) : undefined,
        sell_price: editForm.sell_price ? parseFloat(editForm.sell_price) : undefined,
        category: editForm.category || undefined,
      });
      setMaterials(prev =>
        prev.map(m => m.id === editingMaterial.id ? {
          ...m,
          name: editForm.name,
          description: editForm.description || undefined,
          unit: editForm.unit || 'pc',
          cost_price: editForm.cost_price ? parseFloat(editForm.cost_price) : undefined,
          sell_price: editForm.sell_price ? parseFloat(editForm.sell_price) : undefined,
          category: editForm.category || undefined,
        } : m)
      );
      setEditingMaterial(null);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await services.materialsLibrary.delete(id);
      setMaterials(prev => prev.filter(m => m.id !== id));
      setDeletingId(null);
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleSelectMaterial = (material: DBMaterialLibraryItem) => {
    if (onSelectMaterial) {
      onSelectMaterial(material);
    }
  };

  if (view === 'import') {
    return (
      <WholesalerImportPage
        onBack={() => {
          setView('library');
          loadMaterials();
        }}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <ArrowLeft size={24} className="text-slate-600" />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Materials Library</h1>
            <p className="text-slate-500 text-sm font-medium">
              {stats.totalItems} materials from {stats.suppliers} suppliers
            </p>
          </div>
        </div>
        <button
          onClick={() => setView('import')}
          className="flex items-center gap-2 px-4 py-3 bg-teal-500 text-white rounded-2xl font-black hover:bg-teal-400 transition-colors"
        >
          <Upload size={18} />
          Import CSV
        </button>
      </div>

      {/* Stats Cards */}
      {!selectionMode && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <Package size={20} className="text-slate-400 mb-2" />
            <p className="text-2xl font-black text-slate-900">{stats.totalItems}</p>
            <p className="text-xs text-slate-500 font-medium">Total Materials</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <Building2 size={20} className="text-slate-400 mb-2" />
            <p className="text-2xl font-black text-slate-900">{stats.suppliers}</p>
            <p className="text-xs text-slate-500 font-medium">Suppliers</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <Tag size={20} className="text-slate-400 mb-2" />
            <p className="text-2xl font-black text-slate-900">{stats.categories}</p>
            <p className="text-xs text-slate-500 font-medium">Categories</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <Star size={20} className="text-amber-400 mb-2" />
            <p className="text-2xl font-black text-slate-900">{stats.favourites}</p>
            <p className="text-xs text-slate-500 font-medium">Favourites</p>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, code, or description..."
              className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>

          {/* Supplier Filter */}
          <div className="relative">
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="appearance-none pl-4 pr-10 py-3 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-medium text-sm"
            >
              <option value="all">All Suppliers</option>
              {suppliers.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none pl-4 pr-10 py-3 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-medium text-sm capitalize"
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Favourites Toggle */}
          <button
            onClick={() => setShowFavouritesOnly(!showFavouritesOnly)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-colors ${
              showFavouritesOnly
                ? 'bg-amber-100 text-amber-700 border-2 border-amber-500'
                : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Star size={16} className={showFavouritesOnly ? 'fill-amber-500' : ''} />
            Favourites
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <span className="font-medium text-sm">{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-slate-500">Loading materials...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && materials.length === 0 && (
        <div className="text-center py-12 bg-white rounded-3xl border border-slate-200">
          <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-black text-slate-900 mb-2">No Materials Yet</h3>
          <p className="text-slate-500 text-sm mb-6">Import a price list from your wholesaler to get started</p>
          <button
            onClick={() => setView('import')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-slate-900 rounded-2xl font-black hover:bg-amber-400 transition-colors"
          >
            <Upload size={18} />
            Import CSV
          </button>
        </div>
      )}

      {/* Materials List */}
      {!loading && filteredMaterials.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
          <div className="max-h-[600px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {!selectionMode && <th className="w-12 p-4"></th>}
                  <th className="text-left p-4 font-black text-slate-600 text-xs uppercase">Material</th>
                  <th className="text-left p-4 font-black text-slate-600 text-xs uppercase hidden sm:table-cell">Supplier</th>
                  <th className="text-left p-4 font-black text-slate-600 text-xs uppercase hidden md:table-cell">Unit</th>
                  <th className="text-right p-4 font-black text-slate-600 text-xs uppercase">Cost</th>
                  <th className="text-right p-4 font-black text-slate-600 text-xs uppercase">Sell</th>
                  <th className="w-12 p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMaterials.map((material) => (
                  <tr
                    key={material.id}
                    className={`hover:bg-slate-50 ${selectionMode ? 'cursor-pointer' : ''}`}
                    onClick={() => selectionMode && handleSelectMaterial(material)}
                  >
                    {!selectionMode && (
                      <td className="p-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavourite(material.id);
                          }}
                          className="p-1 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          <Star
                            size={18}
                            className={material.is_favourite
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-slate-300 hover:text-amber-400'
                            }
                          />
                        </button>
                      </td>
                    )}
                    <td className="p-4">
                      <p className="font-bold text-slate-900">{material.name}</p>
                      {material.product_code && (
                        <p className="text-xs text-slate-400 font-mono">{material.product_code}</p>
                      )}
                      {material.category && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full capitalize">
                          {material.category}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-slate-600 hidden sm:table-cell">{material.supplier || '-'}</td>
                    <td className="p-4 text-slate-600 hidden md:table-cell">{material.unit || 'pc'}</td>
                    <td className="p-4 text-right text-slate-600">
                      {material.cost_price ? `£${Number(material.cost_price).toFixed(2)}` : '-'}
                    </td>
                    <td className="p-4 text-right font-bold text-emerald-600">
                      {material.sell_price ? `£${Number(material.sell_price).toFixed(2)}` : '-'}
                    </td>
                    <td className="p-4">
                      {!selectionMode ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(material);
                            }}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Edit2 size={16} className="text-slate-400" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingId(material.id);
                            }}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} className="text-slate-400 hover:text-red-500" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSelectMaterial(material)}
                          className="px-3 py-1 bg-amber-500 text-slate-900 rounded-lg font-bold text-xs hover:bg-amber-400 transition-colors"
                        >
                          Add
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <p className="text-sm text-slate-500">
              Showing {filteredMaterials.length} of {materials.length} materials
            </p>
          </div>
        </div>
      )}

      {/* No Results */}
      {!loading && materials.length > 0 && filteredMaterials.length === 0 && (
        <div className="text-center py-12 bg-white rounded-3xl border border-slate-200">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-black text-slate-900 mb-2">No Results Found</h3>
          <p className="text-slate-500 text-sm">Try adjusting your search or filters</p>
        </div>
      )}

      {/* Edit Modal */}
      {editingMaterial && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-900">Edit Material</h3>
              <button
                onClick={() => setEditingMaterial(null)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Description</label>
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Unit</label>
                  <select
                    value={editForm.unit}
                    onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl"
                  >
                    <option value="pc">pc</option>
                    <option value="m">m</option>
                    <option value="sqm">sqm</option>
                    <option value="bag">bag</option>
                    <option value="sheet">sheet</option>
                    <option value="pack">pack</option>
                    <option value="roll">roll</option>
                    <option value="tin">tin</option>
                    <option value="tube">tube</option>
                    <option value="length">length</option>
                    <option value="pair">pair</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Cost Price</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">£</span>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.cost_price}
                      onChange={(e) => setEditForm({ ...editForm, cost_price: e.target.value })}
                      className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Sell Price</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">£</span>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.sell_price}
                      onChange={(e) => setEditForm({ ...editForm, sell_price: e.target.value })}
                      className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Category</label>
                <input
                  type="text"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  placeholder="e.g. timber, plasterboard, fixings..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setEditingMaterial(null)}
                className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editForm.name}
                className="flex-1 px-4 py-3 bg-amber-500 text-slate-900 rounded-xl font-black hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check size={18} />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Delete Material?</h3>
            <p className="text-slate-500 text-sm mb-6">This action cannot be undone.</p>
            <div className="flex gap-4">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-black hover:bg-red-500 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
