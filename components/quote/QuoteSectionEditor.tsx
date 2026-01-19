import React from 'react';
import { QuoteSection, MaterialItem, LabourItem, AppSettings } from '../../types';
import { MaterialItemRow } from './MaterialItemRow';
import { LabourItemRow } from './LabourItemRow';
import { Trash2, Plus, Package, Type, HardHat, PoundSterling } from 'lucide-react';

interface QuoteSectionEditorProps {
  section: QuoteSection;
  sectionIndex: number;
  totalSections: number;
  defaultLabourRate: number;
  settings: AppSettings;
  // Material item handlers
  onUpdateItem: (sectionId: string, itemId: string, updates: Partial<MaterialItem>) => void;
  onRemoveItem: (sectionId: string, itemId: string) => void;
  onIncrementQuantity: (sectionId: string, itemId: string) => void;
  onDecrementQuantity: (sectionId: string, itemId: string) => void;
  onAddMaterial: (sectionId: string) => void;
  onAddHeading: (sectionId: string) => void;
  onOpenPriceList: (sectionId: string) => void;
  onSaveItemToLibrary: (item: MaterialItem) => void;
  // Labour handlers
  onAddLabourItem: (sectionId: string) => void;
  onUpdateLabourItem: (sectionId: string, itemId: string, updates: Partial<LabourItem>) => void;
  onRemoveLabourItem: (sectionId: string, itemId: string) => void;
  onIncrementLabourHours: (sectionId: string, itemId: string) => void;
  onDecrementLabourHours: (sectionId: string, itemId: string) => void;
  // Section handlers
  onUpdateTitle: (sectionId: string, title: string) => void;
  onUpdateLabourCost: (sectionId: string, cost: number) => void;
  onUpdateSubsectionPrice: (sectionId: string, price: number | undefined) => void;
  onRemoveSection: (sectionId: string) => void;
  // Calculations
  calculateSectionLabour: (section: QuoteSection) => number;
  getTotalLabourHours: (section: QuoteSection) => number;
}

export const QuoteSectionEditor: React.FC<QuoteSectionEditorProps> = ({
  section,
  sectionIndex,
  totalSections,
  defaultLabourRate,
  settings,
  onUpdateItem,
  onRemoveItem,
  onIncrementQuantity,
  onDecrementQuantity,
  onAddMaterial,
  onAddHeading,
  onOpenPriceList,
  onSaveItemToLibrary,
  onAddLabourItem,
  onUpdateLabourItem,
  onRemoveLabourItem,
  onIncrementLabourHours,
  onDecrementLabourHours,
  onUpdateTitle,
  onUpdateLabourCost,
  onUpdateSubsectionPrice,
  onRemoveSection,
  calculateSectionLabour,
  getTotalLabourHours,
}) => {
  const sectionRate = section.labourRate || defaultLabourRate;
  const materialsTotal = section.items.filter(i => !i.isHeading).reduce((s, i) => s + i.totalPrice, 0);
  const labourTotal = calculateSectionLabour(section);
  const calculatedTotal = materialsTotal + labourTotal;
  const displayTotal = section.subsectionPrice !== undefined ? section.subsectionPrice : calculatedTotal;

  return (
    <div className="bg-white p-2 md:p-5 rounded-xl md:rounded-[28px] shadow-md border border-slate-100 md:border-slate-200">
      {/* Section Header */}
      <div className="flex justify-between items-center gap-2 md:gap-4">
        <div className="flex-1 space-y-0.5 md:space-y-1">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="h-6 w-6 md:h-10 md:w-10 bg-slate-100 rounded-lg md:rounded-xl flex items-center justify-center font-black text-[10px] md:text-base text-slate-500">
              {sectionIndex + 1}
            </div>
            <input
              type="text"
              className="bg-transparent text-xs md:text-xl font-black text-slate-900 outline-none focus:text-teal-600 transition-colors w-full leading-tight md:leading-normal py-0.5 md:py-1"
              value={section.title}
              onChange={e => onUpdateTitle(section.id, e.target.value)}
              placeholder="Job Section Title (e.g. Rewire Kitchen)"
            />
          </div>
          <p className="text-[8px] md:text-xs font-black text-slate-400 uppercase tracking-widest italic ml-8 md:ml-[52px]">
            Work Specifications & Labour
          </p>
        </div>
        <div className="flex gap-1 md:gap-2">
          <button
            onClick={() => onRemoveSection(section.id)}
            disabled={totalSections === 1}
            className="p-1.5 md:p-2 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-10"
            title="Remove Job Section"
          >
            <Trash2 size={14} className="md:hidden" />
            <Trash2 size={20} className="hidden md:block" />
          </button>
        </div>
      </div>

      {/* Material Items Section */}
      <div className="pt-1 md:pt-4 mt-1 md:mt-4 border-t border-slate-100">
        <div className="flex items-center justify-between mb-1 md:mb-3">
          <div className="flex items-center gap-1 md:gap-2">
            <Package size={12} className="text-teal-500 md:hidden" />
            <Package size={18} className="text-teal-500 hidden md:block" />
            <span className="text-[9px] md:text-sm font-black text-slate-600 uppercase tracking-widest">Materials</span>
          </div>
        </div>

        {section.items.map((item) => (
          <MaterialItemRow
            key={item.id}
            item={item}
            sectionId={section.id}
            onUpdate={onUpdateItem}
            onRemove={onRemoveItem}
            onIncrement={onIncrementQuantity}
            onDecrement={onDecrementQuantity}
            onSaveToLibrary={onSaveItemToLibrary}
          />
        ))}

        {/* Action buttons for materials */}
        <div className="flex gap-1 md:gap-2 pt-1 md:pt-3 mt-1 md:mt-2">
          <button
            onClick={() => onAddMaterial(section.id)}
            className="flex-1 flex items-center justify-center gap-1 md:gap-2 py-1 md:py-3 bg-white border border-slate-200 rounded md:rounded-xl text-slate-600 font-bold text-[9px] md:text-sm uppercase tracking-wider shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
          >
            <Plus size={12} className="text-teal-500 md:hidden"/>
            <Plus size={18} className="text-teal-500 hidden md:block"/>
            Add Item
          </button>
          <button
            onClick={() => onOpenPriceList(section.id)}
            className="flex-1 flex items-center justify-center gap-1 md:gap-2 py-1 md:py-3 bg-teal-50 border border-teal-200 rounded md:rounded-xl text-teal-600 font-bold text-[9px] md:text-sm uppercase tracking-wider shadow-sm hover:bg-teal-100 active:scale-95 transition-all"
          >
            <Package size={12} className="md:hidden"/>
            <Package size={18} className="hidden md:block"/>
            Price List
          </button>
          <button
            onClick={() => onAddHeading(section.id)}
            className="flex items-center justify-center gap-0.5 md:gap-1.5 py-1 md:py-3 px-2 md:px-4 bg-slate-50 border border-slate-200 rounded md:rounded-xl text-slate-500 font-bold text-[9px] md:text-sm uppercase tracking-wider shadow-sm hover:bg-slate-100 active:scale-95 transition-all"
          >
            <Type size={10} className="md:hidden"/>
            <Type size={16} className="hidden md:block"/>
          </button>
        </div>
      </div>

      {/* Labour Items Section */}
      <div className="pt-1 md:pt-4 mt-1 md:mt-4 border-t border-slate-100">
        <div className="flex items-center justify-between mb-1 md:mb-3">
          <div className="flex items-center gap-1 md:gap-2">
            <HardHat size={12} className="text-blue-500 md:hidden" />
            <HardHat size={18} className="text-blue-500 hidden md:block" />
            <span className="text-[9px] md:text-sm font-black text-slate-600 uppercase tracking-widest">Labour</span>
          </div>
          <div className="text-[9px] md:text-sm text-slate-400">
            Rate: £{sectionRate}/hr
          </div>
        </div>

        {/* Labour Items List */}
        {(section.labourItems || []).map((labourItem) => (
          <LabourItemRow
            key={labourItem.id}
            item={labourItem}
            sectionId={section.id}
            defaultRate={sectionRate}
            onUpdate={onUpdateLabourItem}
            onRemove={onRemoveLabourItem}
            onIncrement={onIncrementLabourHours}
            onDecrement={onDecrementLabourHours}
          />
        ))}

        {/* Add Labour Item Button */}
        <button
          onClick={() => onAddLabourItem(section.id)}
          className="w-full flex items-center justify-center gap-1 md:gap-2 py-1 md:py-3 bg-blue-50 border border-blue-200 rounded md:rounded-xl text-blue-600 font-bold text-[9px] md:text-sm uppercase tracking-wider hover:bg-blue-100 active:scale-95 transition-all mt-1 md:mt-2"
        >
          <Plus size={10} className="md:hidden" />
          <Plus size={18} className="hidden md:block" />
          Add Labour Item
        </button>

        {/* Labour Summary */}
        {(section.labourItems && section.labourItems.length > 0) && (
          <div className="flex justify-between items-center mt-1 md:mt-3 pt-1 md:pt-3 border-t border-blue-100">
            <span className="text-[9px] md:text-sm text-slate-500">
              Total: {getTotalLabourHours(section)} hours × £{sectionRate}
            </span>
            <span className="font-black text-blue-600 text-[11px] md:text-lg">
              £{labourTotal.toFixed(2)}
            </span>
          </div>
        )}

        {/* Fallback: Direct labour cost input if no itemized labour */}
        {(!section.labourItems || section.labourItems.length === 0) && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">Or enter labour cost directly:</span>
              <div className="flex items-center bg-white border-2 border-slate-100 rounded-xl px-2 py-1.5 focus-within:border-blue-400 transition-all">
                <span className="text-slate-400 text-sm font-bold">£</span>
                <input
                  type="number"
                  className="bg-transparent border-none text-slate-950 font-black text-sm outline-none w-20 text-center"
                  value={section.labourCost !== undefined ? section.labourCost : ''}
                  onChange={e => onUpdateLabourCost(section.id, parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section Totals Summary */}
      <div className="pt-2 md:pt-4 mt-2 md:mt-4 border-t border-slate-100">
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          {/* Materials Total */}
          <div className="space-y-0.5 md:space-y-1.5">
            <label className="text-[8px] md:text-xs font-black text-slate-400 uppercase tracking-widest px-0.5 flex items-center gap-0.5 md:gap-1.5">
              <Package size={10} className="text-slate-500 md:hidden" />
              <Package size={14} className="text-slate-500 hidden md:block" />
              Materials
            </label>
            <div className="bg-slate-100 rounded-lg md:rounded-xl px-2 md:px-4 py-1.5 md:py-3 text-center">
              <span className="text-xs md:text-lg font-black text-slate-600">£{materialsTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Labour Total */}
          <div className="space-y-0.5 md:space-y-1.5">
            <label className="text-[8px] md:text-xs font-black text-slate-400 uppercase tracking-widest px-0.5 flex items-center gap-0.5 md:gap-1.5">
              <HardHat size={10} className="text-blue-500 md:hidden" />
              <HardHat size={14} className="text-blue-500 hidden md:block" />
              Labour
            </label>
            <div className="bg-blue-50 rounded-lg md:rounded-xl px-2 md:px-4 py-1.5 md:py-3 text-center">
              <span className="text-xs md:text-lg font-black text-blue-600">£{labourTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Section Total (editable override) */}
          <div className="space-y-0.5 md:space-y-1.5">
            <label className="text-[8px] md:text-xs font-black text-slate-400 uppercase tracking-widest px-0.5 flex items-center gap-0.5 md:gap-1.5">
              <PoundSterling size={10} className="text-emerald-500 md:hidden" />
              <PoundSterling size={14} className="text-emerald-500 hidden md:block" />
              Section
            </label>
            <div className="flex items-center bg-emerald-50 border-2 border-emerald-200 rounded-lg md:rounded-xl px-1 md:px-3 py-1.5 md:py-2.5 focus-within:border-emerald-400 transition-all">
              <span className="text-emerald-600 text-[10px] md:text-base font-bold mr-0.5 md:mr-1">£</span>
              <input
                type="number"
                className="bg-transparent border-none text-emerald-700 font-black text-[10px] md:text-lg outline-none w-full"
                value={section.subsectionPrice !== undefined ? section.subsectionPrice : calculatedTotal.toFixed(2)}
                onChange={e => {
                  const value = e.target.value === '' ? undefined : parseFloat(e.target.value) || 0;
                  onUpdateSubsectionPrice(section.id, value);
                }}
                placeholder="Auto"
              />
            </div>
          </div>
        </div>
        <p className="text-[8px] md:text-xs text-slate-400 text-center italic mt-1 md:mt-2">
          Edit section total to override calculated value
        </p>
      </div>
    </div>
  );
};
