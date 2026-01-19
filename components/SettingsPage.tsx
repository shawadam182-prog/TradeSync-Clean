
import React, { useState } from 'react';
import { AppSettings, QuoteDisplayOptions, DocumentTemplate, TIER_LIMITS } from '../types';
import {
  Save, Building2, Calculator, MapPin,
  PoundSterling, CheckCircle, FileText,
  Settings2, Info, Palette, ReceiptText,
  ChevronRight, Building, Upload, X, Image as ImageIcon,
  Plus, Eye, EyeOff, HardHat, Package, Landmark, ShieldCheck, Hash, Loader2,
  Calendar, Layout, FileSpreadsheet, FileEdit, List, ArrowLeft,
  Crown, Zap, Clock, Users, Briefcase, Camera, FileBox, ExternalLink,
  HelpCircle, MessageSquare, Send
} from 'lucide-react';
import { useToast } from '../src/contexts/ToastContext';
import { handleApiError } from '../src/utils/errorHandler';
import { userSettingsService } from '../src/services/dataService';
import { useSubscription } from '../src/hooks/useFeatureAccess';
import { redirectToCheckout, redirectToPortal } from '../src/lib/stripe';
import { useData } from '../src/contexts/DataContext';
import { useAuth } from '../src/contexts/AuthContext';
import { supabase } from '../src/lib/supabase';

interface SettingsPageProps {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  onSave?: (settings: Partial<AppSettings>) => Promise<void>;
  onBack?: () => void;
}

type SettingsCategory = 'company' | 'quotes' | 'invoices' | 'subscription' | 'help';

export const SettingsPage: React.FC<SettingsPageProps> = ({ settings, setSettings, onSave, onBack }) => {
  const toast = useToast();
  const subscription = useSubscription();
  const { quotes, projects, customers } = useData();
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('company');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [upgradingTier, setUpgradingTier] = useState<string | null>(null);
  const [managingSubscription, setManagingSubscription] = useState(false);

  // Help/Contact form state
  const [helpTitle, setHelpTitle] = useState('');
  const [helpMessage, setHelpMessage] = useState('');
  const [submittingHelp, setSubmittingHelp] = useState(false);

  // Calculate current usage for limits display
  const currentInvoiceCount = quotes.filter(q => q.type === 'invoice').length;
  const currentQuoteCount = quotes.filter(q => q.type === 'estimate' || q.type === 'quotation').length;
  const currentJobPackCount = projects.length;
  const currentCustomerCount = customers.length;
  const limits = subscription.usageLimits || TIER_LIMITS[subscription.tier];

  const handleUpgrade = async (tier: 'professional' | 'business') => {
    setUpgradingTier(tier);
    try {
      await redirectToCheckout(tier);
    } catch (error) {
      console.error('Checkout error:', error);
      const { message } = handleApiError(error);
      toast.error('Upgrade Failed', message);
      setUpgradingTier(null);
    }
  };

  const handleManageSubscription = async () => {
    setManagingSubscription(true);
    try {
      await redirectToPortal();
    } catch (error) {
      console.error('Portal error:', error);
      const { message } = handleApiError(error);
      toast.error('Unable to Open Portal', message);
      setManagingSubscription(false);
    }
  };

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

  const handleSubmitHelpRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!helpTitle.trim() || !helpMessage.trim()) {
      toast.error('Missing Information', 'Please provide both a title and message');
      return;
    }

    if (!user?.id) {
      toast.error('Not Logged In', 'Please sign in to submit a request');
      return;
    }

    setSubmittingHelp(true);
    try {
      const { error } = await supabase.from('support_requests').insert({
        user_id: user.id,
        title: helpTitle.trim(),
        message: helpMessage.trim(),
        user_email: user.email || null,
        user_name: settings.companyName || user.email || null
      });

      if (error) throw error;

      toast.success('Request Submitted', 'We\'ve received your message and will get back to you soon');
      setHelpTitle('');
      setHelpMessage('');
    } catch (error) {
      console.error('Failed to submit help request:', error);
      const { message } = handleApiError(error);
      toast.error('Submission Failed', message);
    } finally {
      setSubmittingHelp(false);
    }
  };

  const CategoryButton = ({ id, label, icon: Icon, color }: { id: SettingsCategory, label: string, icon: any, color: string }) => (
    <button
      onClick={() => setActiveCategory(id)}
      className={`w-full flex items-center justify-between p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl md:rounded-[24px] transition-all border-2 ${
        activeCategory === id
        ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white border-teal-500 shadow-xl shadow-teal-500/25'
        : 'bg-white text-slate-500 border-slate-100 hover:border-teal-200 hover:bg-teal-50/30'
      }`}
    >
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 text-left">
        <div className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl ${activeCategory === id ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-400'}`}>
          <Icon size={18} className="sm:w-5 sm:h-5 md:w-[22px] md:h-[22px]" />
        </div>
        <div>
          <span className="font-black text-[10px] sm:text-[11px] uppercase tracking-wide sm:tracking-widest block truncate">{label}</span>
          <span className={`text-[8px] sm:text-[9px] font-bold hidden sm:block ${activeCategory === id ? 'text-white/70' : 'text-slate-400'}`}>
            {id === 'company' ? 'Profile' : id === 'quotes' ? 'Rates' : id === 'help' ? 'Support' : 'Payment'}
          </span>
        </div>
      </div>
      <ChevronRight size={16} className={`sm:w-[18px] sm:h-[18px] shrink-0 ${activeCategory === id ? 'text-white' : 'text-slate-200'}`} />
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row gap-10">
        
        {/* Sidebar Navigation */}
        <aside className="md:w-80 shrink-0 space-y-4">
          <div className="mb-10 px-2">
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
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Business Hub</h2>
                <p className="text-slate-500 text-sm font-medium italic">Adjust your trading preferences</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <CategoryButton id="subscription" label="Subscription" icon={Crown} color="bg-purple-500 text-white" />
            <CategoryButton id="company" label="My Company" icon={Building} color="bg-amber-500 text-slate-900" />
            <CategoryButton id="quotes" label="Quote Preferences" icon={FileText} color="bg-blue-500 text-white" />
            <CategoryButton id="invoices" label="Invoice Preferences" icon={ReceiptText} color="bg-emerald-500 text-white" />
            <CategoryButton id="help" label="Help & Contact" icon={HelpCircle} color="bg-teal-500 text-white" />
          </div>

          <div className="pt-10 border-t border-slate-100">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-teal-600 to-teal-500 text-white p-5 rounded-[24px] font-black hover:from-teal-700 hover:to-teal-600 transition-all shadow-xl shadow-teal-500/25 uppercase text-xs tracking-widest border-b-4 border-teal-700 active:translate-y-1 active:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </aside>

        {/* Dynamic Content Area */}
        <main className="flex-1 min-h-[600px]">
          {activeCategory === 'subscription' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Current Plan Card */}
              <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-10 border-b border-slate-100 bg-gradient-to-r from-purple-50 to-slate-50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl"><Crown size={24} /></div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Your Plan</h3>
                  </div>
                  <p className="text-slate-500 text-sm font-medium italic">Manage your subscription and view usage limits.</p>
                </div>
                <div className="p-10">
                  {/* Current Status */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${
                          subscription.tier === 'free' ? 'bg-slate-100 text-slate-600' :
                          subscription.tier === 'professional' ? 'bg-purple-100 text-purple-600' :
                          'bg-amber-100 text-amber-600'
                        }`}>
                          {subscription.tier}
                        </span>
                        {subscription.status === 'trialing' && (
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                            subscription.trialDaysRemaining !== null && subscription.trialDaysRemaining <= 3
                              ? 'bg-amber-100 text-amber-600'
                              : 'bg-blue-100 text-blue-600'
                          }`}>
                            Trial
                          </span>
                        )}
                        {subscription.status === 'expired' && (
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-red-100 text-red-600">
                            Expired
                          </span>
                        )}
                      </div>
                      <p className="text-2xl font-black text-slate-900 capitalize">{subscription.tier} Plan</p>
                      {subscription.status === 'trialing' && subscription.trialDaysRemaining !== null && (
                        <p className={`text-sm mt-1 ${
                          subscription.trialDaysRemaining === 0
                            ? 'text-red-600 font-semibold'
                            : subscription.trialDaysRemaining <= 3
                            ? 'text-amber-600'
                            : 'text-slate-500'
                        }`}>
                          <Clock size={14} className="inline mr-1" />
                          {subscription.trialDaysRemaining === 0
                            ? 'Your trial ends today!'
                            : `${subscription.trialDaysRemaining} day${subscription.trialDaysRemaining !== 1 ? 's' : ''} left in trial`}
                        </p>
                      )}
                      {subscription.status === 'expired' && (
                        <p className="text-sm text-red-600 mt-1 font-medium">
                          <Clock size={14} className="inline mr-1" />
                          Your free trial has ended. Upgrade to restore full access.
                        </p>
                      )}
                    </div>
                    {subscription.tier === 'free' || subscription.status === 'expired' ? (
                      <button
                        onClick={() => handleUpgrade('professional')}
                        disabled={upgradingTier !== null}
                        className={`flex items-center gap-2 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg disabled:opacity-50 ${
                          subscription.status === 'expired'
                            ? 'bg-red-500 hover:bg-red-600 shadow-red-200'
                            : 'bg-purple-500 hover:bg-purple-600 shadow-purple-200'
                        }`}
                      >
                        {upgradingTier === 'professional' ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                        {subscription.status === 'expired' ? 'Choose a Plan' : 'Upgrade to Pro'}
                      </button>
                    ) : (
                      <button
                        onClick={handleManageSubscription}
                        disabled={managingSubscription}
                        className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50"
                      >
                        {managingSubscription ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                        Manage Subscription
                      </button>
                    )}
                  </div>

                  {/* Usage Limits */}
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Current Usage</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-slate-50 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Users size={16} className="text-purple-500" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customers</span>
                        </div>
                        <p className="text-2xl font-black text-slate-900">
                          {currentCustomerCount}
                          <span className="text-sm text-slate-400 font-bold">/{limits.customers ?? '∞'}</span>
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Briefcase size={16} className="text-blue-500" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Job Packs</span>
                        </div>
                        <p className="text-2xl font-black text-slate-900">
                          {currentJobPackCount}
                          <span className="text-sm text-slate-400 font-bold">/{limits.jobPacks ?? '∞'}</span>
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText size={16} className="text-amber-500" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quotes</span>
                        </div>
                        <p className="text-2xl font-black text-slate-900">
                          {currentQuoteCount}
                          <span className="text-sm text-slate-400 font-bold">/{limits.quotes ?? '∞'}</span>
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <ReceiptText size={16} className="text-emerald-500" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoices</span>
                        </div>
                        <p className="text-2xl font-black text-slate-900">
                          {currentInvoiceCount}
                          <span className="text-sm text-slate-400 font-bold">/{limits.invoices ?? '∞'}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Plans Comparison */}
              {subscription.tier === 'free' && (
                <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-10 border-b border-slate-100">
                    <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Upgrade Your Plan</h4>
                    <p className="text-slate-500 text-sm font-medium italic mt-1">Unlock more features and remove limits.</p>
                  </div>
                  <div className="p-10 grid md:grid-cols-2 gap-6">
                    {/* Professional Plan */}
                    <div className="border-2 border-slate-200 rounded-3xl p-6">
                      <h5 className="text-xl font-black text-slate-900">Professional</h5>
                      <p className="text-sm text-slate-500 mt-1">For solo tradespeople</p>
                      <p className="text-3xl font-black text-slate-900 mt-2">£19<span className="text-sm text-slate-400 font-bold">/month</span></p>
                      <ul className="mt-6 space-y-3 text-sm">
                        <li className="flex items-center gap-2"><CheckCircle size={16} className="text-purple-500" /> Unlimited jobs</li>
                        <li className="flex items-center gap-2"><CheckCircle size={16} className="text-purple-500" /> Unlimited quotes & invoices</li>
                        <li className="flex items-center gap-2"><CheckCircle size={16} className="text-purple-500" /> Materials library</li>
                        <li className="flex items-center gap-2"><CheckCircle size={16} className="text-purple-500" /> Full job pack management</li>
                        <li className="flex items-center gap-2"><CheckCircle size={16} className="text-purple-500" /> Priority support</li>
                      </ul>
                      <button
                        onClick={() => handleUpgrade('professional')}
                        disabled={upgradingTier !== null}
                        className="w-full mt-6 bg-slate-200 hover:bg-slate-300 text-slate-900 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50"
                      >
                        {upgradingTier === 'professional' ? <Loader2 size={16} className="animate-spin inline" /> : 'Get Professional'}
                      </button>
                    </div>

                    {/* Business Plan - Recommended */}
                    <div className="border-2 border-teal-400 rounded-3xl p-6 relative bg-teal-50/30">
                      <div className="absolute -top-3 left-6">
                        <span className="bg-teal-500 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Recommended</span>
                      </div>
                      <h5 className="text-xl font-black text-slate-900 mt-2">Business</h5>
                      <p className="text-sm text-slate-500 mt-1">Full power features</p>
                      <p className="text-3xl font-black text-teal-600 mt-2">£29<span className="text-sm text-slate-400 font-bold">/month</span></p>
                      <ul className="mt-6 space-y-3 text-sm">
                        <li className="flex items-center gap-2"><CheckCircle size={16} className="text-teal-500" /> Everything in Professional</li>
                        <li className="flex items-center gap-2"><CheckCircle size={16} className="text-teal-500" /> AI receipt scanning</li>
                        <li className="flex items-center gap-2"><CheckCircle size={16} className="text-teal-500" /> Bank statement import</li>
                        <li className="flex items-center gap-2"><CheckCircle size={16} className="text-teal-500" /> Auto reconciliation</li>
                        <li className="flex items-center gap-2"><CheckCircle size={16} className="text-teal-500" /> VAT tracking & reports</li>
                      </ul>
                      <button
                        onClick={() => handleUpgrade('business')}
                        disabled={upgradingTier !== null}
                        className="w-full mt-6 bg-teal-500 hover:bg-teal-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50"
                      >
                        {upgradingTier === 'business' ? <Loader2 size={16} className="animate-spin inline" /> : 'Get Business'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
                        <label className={`bg-gradient-to-r from-teal-600 to-teal-500 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-teal-500/25 ${uploadingLogo ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:from-teal-700 hover:to-teal-600'}`}>
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
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-[20px] p-5 focus:border-teal-400 focus:bg-white outline-none text-slate-900 font-bold text-sm transition-all" 
                    value={settings.companyName}
                    onChange={e => setSettings({...settings, companyName: e.target.value})}
                    placeholder="e.g. Acme Construction Ltd"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 italic">Business Address & Contact</label>
                  <div className="flex items-start bg-slate-50 border-2 border-slate-100 rounded-[20px] px-4 focus-within:border-teal-400 focus-within:bg-white transition-all">
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
                      className={`relative w-14 h-8 rounded-full transition-colors ${settings.isVatRegistered ? "bg-teal-500" : "bg-slate-300"}`}>
                      <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${settings.isVatRegistered ? "left-7" : "left-1"}`} />
                    </button>
                  </div>

                  {settings.isVatRegistered && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 italic">VAT Registration Number</label>
                      <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-[20px] px-5 focus-within:border-teal-400 focus-within:bg-white transition-all">
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
                    <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-[20px] px-5 focus-within:border-teal-400 focus-within:bg-white transition-all">
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
                    <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-[20px] px-5 focus-within:border-teal-400 focus-within:bg-white transition-all">
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
                    <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-[20px] px-5 focus-within:border-teal-400 focus-within:bg-white transition-all">
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
                      <Package size={16} className="text-teal-500" />
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
                      className={`w-14 h-8 rounded-full relative transition-all duration-300 ${settings.enableVat ? 'bg-teal-500 shadow-lg shadow-teal-200' : 'bg-slate-300'}`}
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
                    <Palette size={16} className="text-teal-500" />
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Visual Design Theme</label>
                  </div>
                  <div className="grid grid-cols-3 gap-3 md:gap-6">
                    {['slate', 'amber', 'blue'].map(color => (
                      <button
                        key={color}
                        onClick={() => setSettings({ ...settings, costBoxColor: color as any })}
                        className={`flex flex-col items-center gap-4 p-3 md:p-6 rounded-[32px] border-2 transition-all ${settings.costBoxColor === color ? 'border-teal-500 bg-teal-50/30 shadow-lg' : 'border-slate-100 bg-white hover:border-teal-200'}`}
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
                    <Layout size={16} className="text-teal-500" />
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
                        className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${(settings.documentTemplate || 'classic') === template.id ? 'border-teal-500 bg-teal-50/50 shadow-lg' : 'border-slate-100 bg-white hover:border-teal-200'}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${(settings.documentTemplate || 'classic') === template.id ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
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

                  {/* Invoice Style Selection */}
                  <div className="space-y-5 pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2 px-1">
                      <Layout size={16} className="text-emerald-500" />
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Invoice Style</label>
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
                          className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${(settings.documentTemplate || 'classic') === template.id ? 'border-emerald-500 bg-emerald-50/50 shadow-lg' : 'border-slate-100 bg-white hover:border-emerald-200'}`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${(settings.documentTemplate || 'classic') === template.id ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            <template.icon size={20} />
                          </div>
                          <div className="text-center">
                            <span className="text-[10px] font-black uppercase tracking-widest block">{template.name}</span>
                            <span className="text-[8px] text-slate-400">{template.desc}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bank Details Section */}
                  <div className="space-y-5 pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2 px-1">
                      <Landmark size={16} className="text-emerald-500" />
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Bank Details for Payments</label>
                    </div>
                    <p className="text-[10px] text-slate-500 italic px-1">These details will appear as a payment section on your invoices.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Account Holder Name</label>
                        <input
                          type="text"
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-[16px] p-4 outline-none text-slate-900 font-bold text-sm focus:border-emerald-400 focus:bg-white transition-all"
                          value={settings.bankAccountName || ''}
                          onChange={e => setSettings({ ...settings, bankAccountName: e.target.value })}
                          placeholder="e.g. ACME Construction Ltd"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Bank Name</label>
                        <input
                          type="text"
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-[16px] p-4 outline-none text-slate-900 font-bold text-sm focus:border-emerald-400 focus:bg-white transition-all"
                          value={settings.bankName || ''}
                          onChange={e => setSettings({ ...settings, bankName: e.target.value })}
                          placeholder="e.g. Barclays"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Account Number</label>
                        <input
                          type="text"
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-[16px] p-4 outline-none text-slate-900 font-bold text-sm focus:border-emerald-400 focus:bg-white transition-all"
                          value={settings.bankAccountNumber || ''}
                          onChange={e => setSettings({ ...settings, bankAccountNumber: e.target.value })}
                          placeholder="12345678"
                          maxLength={8}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Sort Code</label>
                        <input
                          type="text"
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-[16px] p-4 outline-none text-slate-900 font-bold text-sm focus:border-emerald-400 focus:bg-white transition-all"
                          value={settings.bankSortCode || ''}
                          onChange={e => setSettings({ ...settings, bankSortCode: e.target.value })}
                          placeholder="12-34-56"
                          maxLength={8}
                        />
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

          {activeCategory === 'help' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-10 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-slate-50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-teal-100 text-teal-600 rounded-2xl"><HelpCircle size={24} /></div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Help & Contact Us</h3>
                  </div>
                  <p className="text-slate-500 text-sm font-medium italic">Have a question, feedback, or need assistance? Send us a message and we'll get back to you.</p>
                </div>
                <form onSubmit={handleSubmitHelpRequest} className="p-10 space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 italic">Subject / Title</label>
                    <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-[20px] px-5 focus-within:border-teal-400 focus-within:bg-white transition-all">
                      <MessageSquare size={18} className="text-slate-400 mr-3 shrink-0" />
                      <input
                        type="text"
                        className="w-full bg-transparent border-none py-5 outline-none text-slate-900 font-bold text-sm"
                        value={helpTitle}
                        onChange={e => setHelpTitle(e.target.value)}
                        placeholder="e.g. Question about invoices, Feature request, Bug report..."
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 italic">Your Message</label>
                    <textarea
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-[32px] p-7 text-slate-900 font-medium text-sm outline-none focus:bg-white focus:border-teal-500 transition-all min-h-[200px] leading-relaxed"
                      value={helpMessage}
                      onChange={e => setHelpMessage(e.target.value)}
                      placeholder="Please describe your question, issue, or feedback in detail. The more information you provide, the better we can assist you."
                      required
                    />
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">We'll respond to</p>
                    <p className="text-sm font-bold text-slate-900">{user?.email}</p>
                    {settings.companyName && (
                      <p className="text-xs text-slate-500 mt-1">{settings.companyName}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submittingHelp || !helpTitle.trim() || !helpMessage.trim()}
                    className="w-full flex items-center justify-center gap-3 bg-teal-500 text-white p-5 rounded-[24px] font-black hover:bg-teal-600 transition-all shadow-xl shadow-teal-200 uppercase text-xs tracking-widest border-b-4 border-teal-600 active:translate-y-1 active:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingHelp ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    {submittingHelp ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              </div>

              {/* Quick Links */}
              <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden p-10">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 mb-6">Quick Tips</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-4 bg-slate-50 p-5 rounded-2xl">
                    <div className="p-2.5 bg-amber-100 text-amber-600 rounded-xl"><FileText size={18} /></div>
                    <div>
                      <p className="text-sm font-black text-slate-900">Creating Quotes</p>
                      <p className="text-xs text-slate-500 mt-1">Start from a Job Pack to keep everything organised, or create standalone quotes from the Quotes tab.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 bg-slate-50 p-5 rounded-2xl">
                    <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl"><ReceiptText size={18} /></div>
                    <div>
                      <p className="text-sm font-black text-slate-900">Converting to Invoices</p>
                      <p className="text-xs text-slate-500 mt-1">Once a quote is accepted, use the "Convert to Invoice" option to quickly generate a professional invoice.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 bg-slate-50 p-5 rounded-2xl">
                    <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl"><Building2 size={18} /></div>
                    <div>
                      <p className="text-sm font-black text-slate-900">Company Details</p>
                      <p className="text-xs text-slate-500 mt-1">Set up your company info in the settings to have it automatically appear on all your documents.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 bg-slate-50 p-5 rounded-2xl">
                    <div className="p-2.5 bg-purple-100 text-purple-600 rounded-xl"><Crown size={18} /></div>
                    <div>
                      <p className="text-sm font-black text-slate-900">Upgrade for More</p>
                      <p className="text-xs text-slate-500 mt-1">Professional and Business tiers unlock expense tracking, bank reconciliation, and VAT reporting.</p>
                    </div>
                  </div>
                </div>

                {/* Legal Links */}
                <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                  <a
                    href="/privacy-policy.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-teal-500 transition-colors"
                  >
                    <ShieldCheck size={14} />
                    Privacy Policy
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
