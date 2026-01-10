import React, { useState, useEffect } from 'react';
import {
  X, Plus, Trash2, Edit2, Check, GripVertical, Loader2,
  Package, Wrench, Fuel, Car, Shield, CreditCard, Briefcase, Tag,
  Zap, Coffee, Phone, Home, Truck, HardHat, Hammer, Lightbulb
} from 'lucide-react';
import { expenseCategoriesService } from '../src/services/dataService';

interface ExpenseCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  display_order: number;
  is_default: boolean;
}

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesChange: () => void;
}

const ICON_OPTIONS = [
  { name: 'package', Icon: Package },
  { name: 'wrench', Icon: Wrench },
  { name: 'fuel', Icon: Fuel },
  { name: 'car', Icon: Car },
  { name: 'shield', Icon: Shield },
  { name: 'credit-card', Icon: CreditCard },
  { name: 'briefcase', Icon: Briefcase },
  { name: 'tag', Icon: Tag },
  { name: 'zap', Icon: Zap },
  { name: 'coffee', Icon: Coffee },
  { name: 'phone', Icon: Phone },
  { name: 'home', Icon: Home },
  { name: 'truck', Icon: Truck },
  { name: 'hard-hat', Icon: HardHat },
  { name: 'hammer', Icon: Hammer },
  { name: 'lightbulb', Icon: Lightbulb },
];

const COLOR_OPTIONS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ef4444', // red
  '#06b6d4', // cyan
  '#10b981', // green
  '#f59e0b', // amber
  '#6366f1', // indigo
  '#ec4899', // pink
  '#64748b', // slate
  '#f97316', // orange
];

const getIconComponent = (iconName: string) => {
  const found = ICON_OPTIONS.find(i => i.name === iconName);
  return found ? found.Icon : Tag;
};

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  isOpen,
  onClose,
  onCategoriesChange,
}) => {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('tag');
  const [editColor, setEditColor] = useState('#f59e0b');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('tag');
  const [newColor, setNewColor] = useState('#f59e0b');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await expenseCategoriesService.getAll();
      setCategories(data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await expenseCategoriesService.create({
        name: newName.trim(),
        icon: newIcon,
        color: newColor,
      });
      setNewName('');
      setNewIcon('tag');
      setNewColor('#f59e0b');
      setShowNewForm(false);
      await loadCategories();
      onCategoriesChange();
    } catch (error) {
      console.error('Failed to add category:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (cat: ExpenseCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon);
    setEditColor(cat.color);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      await expenseCategoriesService.update(editingId, {
        name: editName.trim(),
        icon: editIcon,
        color: editColor,
      });
      setEditingId(null);
      await loadCategories();
      onCategoriesChange();
    } catch (error) {
      console.error('Failed to update category:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (name === 'Other') {
      alert('Cannot delete the "Other" category');
      return;
    }
    if (!confirm(`Delete "${name}"? Expenses with this category will be moved to "Other".`)) {
      return;
    }
    setSaving(true);
    try {
      await expenseCategoriesService.delete(id);
      await loadCategories();
      onCategoriesChange();
    } catch (error) {
      console.error('Failed to delete category:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-black text-slate-900">Manage Categories</h2>
            <p className="text-sm text-slate-500">Add, edit, or remove expense categories</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X size={24} className="text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map(cat => {
                const IconComponent = getIconComponent(cat.icon);
                const isEditing = editingId === cat.id;
                const isProtected = cat.name === 'Other';

                return (
                  <div
                    key={cat.id}
                    className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors ${
                      isEditing ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    {isEditing ? (
                      <>
                        {/* Edit Mode */}
                        <div className="flex-1 space-y-3">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            placeholder="Category name"
                            autoFocus
                          />
                          <div className="flex gap-2 flex-wrap">
                            {ICON_OPTIONS.slice(0, 8).map(({ name, Icon }) => (
                              <button
                                key={name}
                                type="button"
                                onClick={() => setEditIcon(name)}
                                className={`p-2 rounded-lg transition-colors ${
                                  editIcon === name
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:border-amber-300'
                                }`}
                              >
                                <Icon size={18} />
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {COLOR_OPTIONS.map(color => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setEditColor(color)}
                                className={`w-7 h-7 rounded-full transition-transform ${
                                  editColor === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''
                                }`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={handleSaveEdit}
                            disabled={saving}
                            className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-2 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* View Mode */}
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: cat.color + '20' }}
                        >
                          <IconComponent size={20} style={{ color: cat.color }} />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-900">{cat.name}</p>
                          {cat.is_default && (
                            <span className="text-[10px] text-slate-400 uppercase tracking-wide">Default</span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(cat)}
                            disabled={isProtected}
                            className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isProtected ? 'Cannot edit "Other" category' : 'Edit category'}
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(cat.id, cat.name)}
                            disabled={isProtected}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isProtected ? 'Cannot delete "Other" category' : 'Delete category'}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {/* Add New Category Form */}
              {showNewForm ? (
                <div className="p-4 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50">
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      placeholder="New category name"
                      autoFocus
                    />
                    <div className="flex gap-2 flex-wrap">
                      {ICON_OPTIONS.slice(0, 8).map(({ name, Icon }) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setNewIcon(name)}
                          className={`p-2 rounded-lg transition-colors ${
                            newIcon === name
                              ? 'bg-amber-500 text-white'
                              : 'bg-white border border-slate-200 text-slate-600 hover:border-amber-300'
                          }`}
                        >
                          <Icon size={18} />
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {COLOR_OPTIONS.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewColor(color)}
                          className={`w-7 h-7 rounded-full transition-transform ${
                            newColor === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAdd}
                        disabled={saving || !newName.trim()}
                        className="flex-1 py-2 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 disabled:opacity-50 transition-colors"
                      >
                        {saving ? (
                          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                        ) : (
                          'Add Category'
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowNewForm(false);
                          setNewName('');
                        }}
                        className="px-4 py-2 bg-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewForm(true)}
                  className="w-full p-4 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 font-bold flex items-center justify-center gap-2 hover:border-amber-400 hover:text-amber-600 transition-colors"
                >
                  <Plus size={20} />
                  Add New Category
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryManager;
