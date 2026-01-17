
import React, { useState } from 'react';
import { AppSettings, QuoteDisplayOptions, DocumentTemplate } from '../types';
import {
  Save, Building2, Calculator, MapPin,
  PoundSterling, CheckCircle, FileText,
  Settings2, Info, Palette, ReceiptText,
  ChevronRight, Building, Upload, X, Image as ImageIcon,
  Plus, Eye, EyeOff, HardHat, Package, Landmark, ShieldCheck, Hash, Loader2,
  Calendar, Layout, FileSpreadsheet, FileEdit, List, ArrowLeft
} from 'lucide-react';
import { useToast } from '../src/contexts/ToastContext';
import { handleApiError } from '../src/utils/errorHandler';
import { userSettingsService } from '../src/services/dataService';

interface SettingsPageProps {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  onSave?: (settings: Partial<AppSettings>) => Promise<void>;
  onBack?: () => void;
}

type SettingsCategory = 'company' | 'quotes' | 'invoices';

export const SettingsPage: React.FC<SettingsPageProps> = ({ settings, setSettings, onSave, onBack }) => {
  const toast = useToast();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('company');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleNumericChange = (field: keyof AppSettings, val: string) => {
    if (val === '') {
      setSettings({ ...settings, [field]: 0 });
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setSettings({ ...settings, [field]: num });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isFooter: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isFooter) {
      // Footer logos still use base64 for now (multiple logos)
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setSettings({ ...settings, footerLogos: [...(settings.footerLogos || []), base64] });
      };
      reader.readAsDataURL(file);
    } else {
      // Main company logo - upload to Supabase storage for persistence
      setUploadingLogo(true);
      try {
        const storagePath = await userSettingsService.uploadLogo(file);
        const signedUrl = await userSettingsService.getLogoUrl(storagePath);
        if (signedUrl) {
          setSettings({ ...settings, companyLogo: signedUrl });
          toast.success('Logo Uploaded', 'Your company logo has been saved');
        }
      } catch (error) {
        console.error('Failed to upload logo:', error);
        const { message } = handleApiError(error);
        toast.error('Upload Failed', message);
      } finally {
        setUploadingLogo(false);
      }
    }

    // Reset the input so the same file can be re-selected
    e.target.value = '';
  };

  const removeFooterLogo = (index: number) => {
    const newList = [...(settings.footerLogos || [])];
    newList.splice(index, 1);
    setSettings({ ...settings, footerLogos: newList });
  };

  const removeCompanyLogo = async () => {
    setUploadingLogo(true);
    try {
      // Clear the logo path in the database
      await userSettingsService.update({ company_logo_path: null });
      setSettings({ ...settings, companyLogo: undefined });
      toast.success('Logo Removed', 'Your company logo has been removed');
    } catch (error) {
      console.error('Failed to remove logo:', error);
      const { message } = handleApiError(error);
      toast.error('Remove Failed', message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const toggleDisplayOption = (key: keyof QuoteDisplayOptions) => {
    setSettings({
      ...settings,
      defaultDisplayOptions: {
        ...settings.defaultDisplayOptions,
        [key]: !settings.defaultDisplayOptions[key]
      }
    });
  };

  const handleSave = async () => {
    if (!onSave) {
      toast.success('Settings Saved', 'Your preferences have been updated');
      return;
    }

    setSaving(true);
    try {
      await onSave(settings);
      toast.success('Settings Saved', 'Your preferences have been synchronized');
    } catch (error) {
      console.error('Failed to save settings:', error);
      const { message } = handleApiError(error);
      toast.error('Save Failed', message);
    } finally {
      setSaving(false);
    }
  };

  const CategoryButton = ({ id, label, icon: Icon, color }: { id: SettingsCategory, label: string, icon: any, color: string }) => (
    <button
      onClick={() => setActiveCategory(id)}
      className={`w-full flex items-center justify-between p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl md:rounded-[24px] transition-all border-2 ${
        activeCategory === id
        ? 'bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-200'
        : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'
      }`}
    >
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 text-left">
        <div className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl ${activeCategory === id ? color : 'bg-slate-50 text-slate-400'}`}>
          <Icon size={18} className="sm:w-5 sm:h-5 md:w-[22px] md:h-[22px]" />
        </div>
        <div>
          <span className="font-black text-[10px] sm:text-[11px] uppercase tracking-wide sm:tracking-widest block truncate">{label}</span>
          <span className={`text-[8px] sm:text-[9px] font-bold hidden sm:block ${activeCategory === id ? 'text-white/60' : 'text-slate-400'}`}>
            {id === 'company' ? 'Profile' : id === 'quotes' ? 'Rates' : 'Payment'}
          </span>
        </div>
      </div>
      <ChevronRight size={16} className={`sm:w-[18px] sm:h-[18px] shrink-0 ${activeCategory === id ? 'text-amber-500' : 'text-slate-200'}`} />
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row gap-10">
        
        {/* Sidebar Navigation */}
        <aside className="md:w-80 shrink-0 space-y-4">
          <div className="mb-10 px-2">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 -ml-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                  aria-label="Go back"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Business Hub</h2>
                <p className="text-slate-500 text-sm font-medium italic">Adjust your trading preferences</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <CategoryButton id="company" label="My Company" icon={Building} color="bg-amber-500 text-slate-900" />
            <CategoryButton id="quotes" label="Quote Preferences" icon={FileText} color="bg-blue-500 text-white" />
            <CategoryButton id="invoices" label="Invoice Preferences" icon={ReceiptText} color="bg-emerald-500 text-white" />
          </div>

          <div className="pt-10 border-t border-slate-100">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-3 bg-slate-900 text-amber-500 p-5 rounded-[24px] font-black hover:bg-black transition-all shadow-xl shadow-slate-200 uppercase text-xs tracking-widest border-b-4 border-slate-950 active:translate-y-1 active:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </aside>

        {/* Dynamic Content Area */}
        <main className="flex-1 min-h-[600px]">
          {activeCategory === 'company' && (
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="p-10 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl"><Building2 size={24} /></div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Company Identity</h3>
                </div>
                <p className="text-slate-500 text-sm font-medium italic">These details form the header of every professional document you generate.</p>
              </div>
              <div className="p-10 space-y-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 italic">Main Business Logo</label>
                  <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-6 p-3 md:p-6 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200">
                    <div className="w-32 h-32 rounded-[24px] bg-white border-2 border-slate-100 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                      {uploadingLogo ? (
                        <Loader2 className="text-slate-400 animate-spin" size={32} />
                      ) : settings.companyLogo ? (
                        <img src={settings.companyLogo} className="w-full h-full object-contain" alt="Logo" />
                      ) : (
                        <ImageIcon className="text-slate-200" size={40} />
                      )}
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <p className="text-sm font-black text-slate-900 mb-1">Upload your brand mark</p>
                      <p className="text-[10px] text-slate-500 italic mb-4">Recommended: PNG or JPG, square or wide format.</p>
                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                        <label className={`bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${uploadingLogo ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-black'}`}>
                          {uploadingLogo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                          {uploadingLogo ? 'Uploading...' : 'Browse Files'}
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleLogoUpload(e)} disabled={uploadingLogo} />
                        </label>
                        {settings.companyLogo && !uploadingLogo && (
                          <button
                            onClick={removeCompanyLogo}
                            className="bg-white border border-slate-200 text-red-500 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all flex items-center gap-2"
                          >
                            <X size={14} /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 italic">Trading Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-[20px] p-5 focus:border-amber-400 focus:bg-white outline-none text-slate-900 font-bold text-sm transition-all" 
                    value={settings.companyName}
                    onChange={e => setSettings({...settings, companyName: e.target.value})}
                    placeholder="e.g. Acme Construction Ltd"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 italic">Business Address & Contact</label>
                  <div className="flex items-start bg-slate-50 border-2 border-slate-100 rounded-[20px] px-4 focus-within:border-amber-400 focus-within:bg-white transition-all">
                    <MapPin size={18} className="text-slate-400 mt-5 mr-2 shrink-0" />
                    <textarea 
                      className="w-full bg-transparent border-none py-5 outline-none text-slate-900 font-bold text-sm min-h-[140px] leading-relaxed" 
                      value={settings.companyAddress}
                      onChange={e => setSettings({...settings, companyAddress: e.target.value})}
                      placeholder="Line 1&#10;Line 2&#10;Postcode&#10;Phone / Email"
                    />
                  </div>
                </div>

                {/* VAT Registration Section */}
                <div className="p-10 border-t border-slate-100 space-y-3 md:space-y-6">
                  <div className="flex items-center justify-between bg-amber-50 p-7 rounded-[32px] border border-amber-100">
                    <div className="flex gap-4">
                      <div className="p-3 bg-white rounded-2xl border border-amber-200 shadow-sm flex items-center justify-center text-amber-600"><Landmark size={20}/></div>
                      <div>
                        <p className="text-sm font-black text-slate-900 uppercase tracking-tight">VAT Registered Business</p>
                        <p className="text-[10px] font-medium text-slate-500 italic mt-0.5">Toggle if your business is registered for VAT with HMRC.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSettings({ ...settings, isVatRegistered: !settings.isVatRegistered })}
                      className={`relative w-14 h-8 rounded-full transition-colors ${settings.isVatRegistered ? "bg-amber-500" : "bg-slate-300"}`}>
                      <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${settings.isVatRegistered ? "left-7" : "left-1"}`} />
                    </button>
                  </div>

                  {settings.isVatRegistered && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 italic">VAT Registration Number</label>
                      <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-[20px] px-5 focus-within:border-amber-400 focus-within:bg-white transition-all">
                        <Hash size={18} className="text-slate-400 mr-3 shrink-0" />
                        <input
                          type="text"
                          className="w-full bg-transparent border-none py-5 outline-none text-slate-900 font-bold text-sm"
                          value={settings.vatNumber || ''}
                          onChange={e => setSettings({...settings, vatNumber: e.target.value.toUpperCase()})}
                          placeholder="GB 123 4567 89"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeCategory === 'quotes' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-10 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl"><Calculator size={24} /></div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Quote Preferences</h3>
                  </div>
                  <p className="text-slate-500 text-sm font-medium italic">Standard trade rates and tax settings for new estimates.</p>
                </div>
                <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 italic">Default Labour Rate (£/hr)</label>
                    <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-[20px] px-5 focus-within:border-amber-400 focus-within:bg-white transition-all">
                      <PoundSterling size={18} className="text-slate-400 mr-3 shrink-0" />
                      <input 
                        type="number" 
                        className="w-full bg-transparent border-none py-5 outline-none text-slate-900 font-bold text-sm" 
                        value={settings.defaultLabourRate || ''}
                        onChange={e => handleNumericChange('defaultLabourRate', e.target.value)}
                        placeholder="65.00"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 italic">Standard VAT Rate (%)</label>
                    <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-[20px] px-5 focus-within:border-amber-400 focus-within:bg-white transition-all">
                      <Landmark size={18} className="text-slate-400 mr-3 shrink-0" />
                      <input 
                        type="number" 
                        className="w-full bg-transparent border-none py-5 outline-none text-slate-900 font-bold text-sm" 
                        value={settings.defaultTaxRate || ''}
                        onChange={e => handleNumericChange('defaultTaxRate', e.target.value)}
                        placeholder="20"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 italic">Reference Prefix</label>
                    <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-[20px] px-5 focus-within:border-amber-400 focus-within:bg-white transition-all">
                      <Hash size={18} className="text-slate-400 mr-3 shrink-0" />
                      <input 
                        type="text" 
                        className="w-full bg-transparent border-none py-5 outline-none text-slate-900 font-bold text-sm" 
                        value={settings.quotePrefix}
                        onChange={e => setSettings({...settings, quotePrefix: e.target.value.toUpperCase()})}
                        placeholder="EST-"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-10 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl"><Eye size={24} /></div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Default Visibility</h3>
                  </div>
                  <p className="text-slate-500 text-sm font-medium italic">Set business-wide standards for what clients see on your quotes.</p>
                </div>
                <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-2 pb-2 border-b border-slate-100">
                      <Package size={16} className="text-amber-500" />
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Materials Defaults</h4>
                    </div>
                    {[
                      { key: 'showMaterials', label: 'Show Section', info: 'Master toggle for materials.' },
                      { key: 'showMaterialQty', label: 'Show Quantities', info: 'Display item counts.' },
                      { key: 'showMaterialUnitPrice', label: 'Show Unit Prices', info: 'Display individual costs.' },
                      { key: 'showMaterialLineTotals', label: 'Show Line Totals', info: 'Display row subtotals.' },
                      { key: 'showMaterialSectionTotal', label: 'Show Section Total', info: 'Show materials subtotal.' }
                    ].map(option => (
                      <div key={option.key} className="flex items-center justify-between group">
                        <div className="max-w-[180px]">
                          <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{option.label}</p>
                          <p className="text-[8px] text-slate-400 font-bold italic">{option.info}</p>
                        </div>
                        <button 
                          onClick={() => toggleDisplayOption(option.key as keyof QuoteDisplayOptions)}
                          className={`w-10 h-6 rounded-full relative transition-all duration-300 ${settings.defaultDisplayOptions[option.key as keyof QuoteDisplayOptions] ? 'bg-purple-500' : 'bg-slate-200'}`}
                        >
                          <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${settings.defaultDisplayOptions[option.key as keyof QuoteDisplayOptions] ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-2 pb-2 border-b border-slate-100">
                      <HardHat size={16} className="text-blue-500" />
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Labour Defaults</h4>
                    </div>
                    {[
                      { key: 'showLabour', label: 'Show Section', info: 'Master toggle for site work.' },
                      { key: 'showLabourQty', label: 'Show Hours', info: 'Display estimated time.' },
                      { key: 'showLabourUnitPrice', label: 'Show Hourly Rate', info: 'Display trade rate.' },
                      { key: 'showLabourLineTotals', label: 'Show Subtotals', info: 'Display row subtotals.' },
                      { key: 'showLabourSectionTotal', label: 'Show Section Total', info: 'Show labour subtotal.' }
                    ].map(option => (
                      <div key={option.key} className="flex items-center justify-between group">
                        <div className="max-w-[180px]">
                          <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{option.label}</p>
                          <p className="text-[8px] text-slate-400 font-bold italic">{option.info}</p>
                        </div>
                        <button 
                          onClick={() => toggleDisplayOption(option.key as keyof QuoteDisplayOptions)}
                          className={`w-10 h-6 rounded-full relative transition-all duration-300 ${settings.defaultDisplayOptions[option.key as keyof QuoteDisplayOptions] ? 'bg-blue-500' : 'bg-slate-200'}`}
                        >
                          <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${settings.defaultDisplayOptions[option.key as keyof QuoteDisplayOptions] ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden p-10 space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                  <div className="flex items-center justify-between bg-slate-50 p-7 rounded-[32px] border border-slate-100">
                    <div className="flex gap-4">
                      <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center text-slate-900"><Landmark size={20}/></div>
                      <div>
                        <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Show VAT on Documents</p>
                        <p className="text-[10px] font-medium text-slate-500 italic mt-0.5">Include standard UK tax calculations.</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSettings({ ...settings, enableVat: !settings.enableVat })}
                      className={`w-14 h-8 rounded-full relative transition-all duration-300 ${settings.enableVat ? 'bg-amber-500 shadow-lg shadow-amber-200' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 ${settings.enableVat ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 p-7 rounded-[32px] border border-slate-100">
                    <div className="flex gap-4">
                      <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center text-slate-900"><ShieldCheck size={20}/></div>
                      <div>
                        <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Show CIS Deductions</p>
                        <p className="text-[10px] font-medium text-slate-500 italic mt-0.5">Subcontractor tax (Construction Industry Scheme).</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSettings({ ...settings, enableCis: !settings.enableCis })}
                      className={`w-14 h-8 rounded-full relative transition-all duration-300 ${settings.enableCis ? 'bg-blue-500 shadow-lg shadow-blue-200' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 ${settings.enableCis ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="flex items-center gap-2 px-1">
                    <Palette size={16} className="text-amber-500" />
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Visual Design Theme</label>
                  </div>
                  <div className="grid grid-cols-3 gap-3 md:gap-6">
                    {['slate', 'amber', 'blue'].map(color => (
                      <button
                        key={color}
                        onClick={() => setSettings({ ...settings, costBoxColor: color as any })}
                        className={`flex flex-col items-center gap-4 p-3 md:p-6 rounded-[32px] border-2 transition-all ${settings.costBoxColor === color ? 'border-amber-500 bg-amber-50/20 shadow-lg' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                      >
                        <div className={`w-12 h-12 rounded-[14px] shadow-lg ${color === 'slate' ? 'bg-slate-900' : color === 'amber' ? 'bg-amber-500' : 'bg-blue-600'}`}></div>
                        <span className="text-[10px] font-black uppercase tracking-widest">{color}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Document Template Selection */}
                <div className="space-y-5 pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-2 px-1">
                    <Layout size={16} className="text-purple-500" />
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Document Template</label>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { id: 'classic', name: 'Classic', icon: FileText, desc: 'Traditional layout' },
                      { id: 'modern', name: 'Modern', icon: FileSpreadsheet, desc: 'Clean & minimal' },
                      { id: 'minimal', name: 'Minimal', icon: FileEdit, desc: 'Simple & elegant' },
                      { id: 'detailed', name: 'Detailed', icon: List, desc: 'Full breakdown' }
                    ].map(template => (
                      <button
                        key={template.id}
                        onClick={() => setSettings({ ...settings, documentTemplate: template.id as DocumentTemplate })}
                        className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${(settings.documentTemplate || 'classic') === template.id ? 'border-purple-500 bg-purple-50/50 shadow-lg' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${(settings.documentTemplate || 'classic') === template.id ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          <template.icon size={20} />
                        </div>
                        <div className="text-center">
                          <span className="text-[10px] font-black uppercase tracking-widest block">{template.name}</span>
                          <span className="text-[8px] text-slate-400">{template.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 text-center italic">Choose how your PDF documents will look when exported</p>
                </div>
              </div>
            </div>
          )}

          {activeCategory === 'invoices' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-10 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl"><ReceiptText size={24} /></div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Invoice Preferences</h3>
                  </div>
                  <p className="text-slate-500 text-sm font-medium italic">Configure payment instructions and legal terms for final billing.</p>
                </div>
                <div className="p-10 space-y-10">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 italic">Invoice Reference Prefix</label>
                    <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-[20px] px-5 focus-within:border-emerald-400 focus-within:bg-white transition-all">
                      <Hash size={18} className="text-slate-400 mr-3 shrink-0" />
                      <input
                        type="text"
                        className="w-full bg-transparent border-none py-5 outline-none text-slate-900 font-bold text-sm"
                        value={settings.invoicePrefix}
                        onChange={e => setSettings({...settings, invoicePrefix: e.target.value.toUpperCase()})}
                        placeholder="INV-"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                      <Calendar size={16} className="text-emerald-500" />
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Tax Year Start Date</label>
                    </div>
                    <p className="text-[10px] text-slate-500 italic px-1">Used for financial reports. UK default is 6th April.</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Day</label>
                        <select
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-[16px] p-4 outline-none text-slate-900 font-bold text-sm focus:border-emerald-400 focus:bg-white transition-all"
                          value={settings.taxYearStartDay || 6}
                          onChange={e => setSettings({ ...settings, taxYearStartDay: parseInt(e.target.value) })}
                        >
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Month</label>
                        <select
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-[16px] p-4 outline-none text-slate-900 font-bold text-sm focus:border-emerald-400 focus:bg-white transition-all"
                          value={settings.taxYearStartMonth || 4}
                          onChange={e => setSettings({ ...settings, taxYearStartMonth: parseInt(e.target.value) })}
                        >
                          {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, i) => (
                            <option key={i + 1} value={i + 1}>{month}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                      <Settings2 size={16} className="text-emerald-500" />
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Invoice Footer & Payment Terms</label>
                    </div>
                    <textarea 
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-[32px] p-7 text-slate-900 font-medium text-sm outline-none focus:bg-white focus:border-emerald-500 transition-all min-h-[200px] leading-relaxed" 
                      value={settings.defaultInvoiceNotes}
                      onChange={e => setSettings({...settings, defaultInvoiceNotes: e.target.value})}
                      placeholder="e.g. Please settle this invoice within 14 days. Bank: ACME Ltd, Account: 01234567, Sort: 00-00-00."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
