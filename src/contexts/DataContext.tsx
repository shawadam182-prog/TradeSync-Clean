import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  customersService,
  jobPacksService,
  quotesService,
  scheduleService,
  userSettingsService,
} from '../services/dataService';
import type { Customer, Quote, JobPack, ScheduleEntry, AppSettings } from '../../types';

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  defaultLabourRate: 65,
  defaultTaxRate: 20,
  defaultCisRate: 20,
  companyName: 'My Trade Business',
  companyAddress: '',
  companyLogo: undefined,
  footerLogos: [],
  isVatRegistered: false,
  vatNumber: undefined,
  enableVat: true,
  enableCis: true,
  quotePrefix: 'EST-',
  invoicePrefix: 'INV-',
  defaultQuoteNotes: 'This estimate is based on the initial survey. Prices for materials are subject to market volatility. Final invoicing will be based on actual quantities used on site.',
  defaultInvoiceNotes: 'Please settle this invoice within 14 days. Thank you for your business!',
  costBoxColor: 'slate',
  showBreakdown: true,
  defaultDisplayOptions: {
    showMaterials: true,
    showMaterialItems: true,
    showMaterialQty: true,
    showMaterialUnitPrice: true,
    showMaterialLineTotals: true,
    showMaterialSectionTotal: true,
    showLabour: true,
    showLabourItems: true,
    showLabourQty: true,
    showLabourUnitPrice: true,
    showLabourLineTotals: true,
    showLabourSectionTotal: true,
    showVat: true,
    showCis: true,
    showNotes: true,
    showLogo: true,
    showTotalsBreakdown: true,
  },
};

interface DataContextType {
  // Data
  customers: Customer[];
  quotes: Quote[];
  projects: JobPack[];
  schedule: ScheduleEntry[];
  settings: AppSettings;

  // Loading states
  loading: boolean;
  error: string | null;

  // Customer actions
  addCustomer: (customer: Omit<Customer, 'id'>) => Promise<Customer>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;

  // Quote actions
  saveQuote: (quote: Quote) => Promise<Quote>;
  updateQuote: (quote: Quote) => Promise<void>;
  updateQuoteStatus: (id: string, status: Quote['status']) => Promise<void>;
  deleteQuote: (id: string) => Promise<void>;

  // Project actions
  addProject: (project: Omit<JobPack, 'id' | 'createdAt' | 'updatedAt'>) => Promise<JobPack>;
  saveProject: (project: JobPack) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // Schedule actions
  addScheduleEntry: (entry: Omit<ScheduleEntry, 'id'>) => Promise<ScheduleEntry>;
  updateScheduleEntry: (id: string, updates: Partial<ScheduleEntry>) => Promise<void>;
  deleteScheduleEntry: (id: string) => Promise<void>;
  setScheduleEntries: React.Dispatch<React.SetStateAction<ScheduleEntry[]>>;

  // Settings actions
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;

  // Setters for components that need direct control
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;

  // Refresh data
  refresh: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

// Helper to convert DB format to app format for JobPack
function dbJobPackToApp(dbPack: any): JobPack {
  return {
    id: dbPack.id,
    title: dbPack.title,
    customerId: dbPack.customer_id || '',
    status: dbPack.status,
    createdAt: dbPack.created_at,
    updatedAt: dbPack.updated_at,
    notepad: dbPack.notepad || '',
    notes: (dbPack.site_notes || []).map((n: any) => ({
      id: n.id,
      text: n.text,
      timestamp: n.created_at,
      isVoice: n.is_voice,
    })),
    photos: (dbPack.site_photos || []).filter((p: any) => !p.is_drawing).map((p: any) => ({
      id: p.id,
      url: p.storage_path, // Will need signed URL
      caption: p.caption || '',
      timestamp: p.created_at,
      tags: p.tags || [],
    })),
    drawings: (dbPack.site_photos || []).filter((p: any) => p.is_drawing).map((p: any) => ({
      id: p.id,
      url: p.storage_path,
      caption: p.caption || '',
      timestamp: p.created_at,
      tags: p.tags || [],
    })),
    documents: (dbPack.site_documents || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      url: d.storage_path,
      type: d.file_type || '',
      summary: d.summary,
      timestamp: d.created_at,
    })),
    materials: (dbPack.project_materials || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      unit: m.unit || '',
      quotedQty: Number(m.quoted_qty) || 0,
      orderedQty: Number(m.ordered_qty) || 0,
      deliveredQty: Number(m.delivered_qty) || 0,
      usedQty: Number(m.used_qty) || 0,
      status: m.status,
    })),
  };
}

// Helper to convert DB format to app format for Quote
function dbQuoteToApp(dbQuote: any): Quote {
  return {
    id: dbQuote.id,
    customerId: dbQuote.customer_id || '',
    projectId: dbQuote.job_pack_id || undefined,
    date: dbQuote.date,
    updatedAt: dbQuote.updated_at,
    title: dbQuote.title,
    sections: dbQuote.sections || [],
    labourRate: Number(dbQuote.labour_rate) || 65,
    markupPercent: Number(dbQuote.markup_percent) || 0,
    taxPercent: Number(dbQuote.tax_percent) || 20,
    cisPercent: Number(dbQuote.cis_percent) || 20,
    status: dbQuote.status,
    notes: dbQuote.notes || '',
    type: dbQuote.type,
    displayOptions: dbQuote.display_options || undefined,
    referenceNumber: dbQuote.reference_number || undefined,
  };
}

// Helper to convert DB format to app format for ScheduleEntry
function dbScheduleToApp(dbEntry: any): ScheduleEntry {
  return {
    id: dbEntry.id,
    title: dbEntry.title,
    start: dbEntry.start_time,
    end: dbEntry.end_time,
    description: dbEntry.description || undefined,
    projectId: dbEntry.job_pack_id || undefined,
    customerId: dbEntry.customer_id || undefined,
    location: dbEntry.location || undefined,
  };
}

// Helper to convert DB settings to app settings
function dbSettingsToApp(dbSettings: any): AppSettings {
  return {
    defaultLabourRate: Number(dbSettings.default_labour_rate) || 65,
    defaultTaxRate: Number(dbSettings.default_tax_rate) || 20,
    defaultCisRate: Number(dbSettings.default_cis_rate) || 20,
    companyName: dbSettings.company_name || '',
    companyAddress: dbSettings.company_address || '',
    companyLogo: dbSettings.company_logo_path || undefined,
    footerLogos: dbSettings.footer_logos || [],
    isVatRegistered: dbSettings.is_vat_registered ?? false,
    vatNumber: dbSettings.vat_number || undefined,
    enableVat: dbSettings.enable_vat ?? true,
    enableCis: dbSettings.enable_cis ?? true,
    quotePrefix: dbSettings.quote_prefix || 'EST-',
    invoicePrefix: dbSettings.invoice_prefix || 'INV-',
    defaultQuoteNotes: dbSettings.default_quote_notes || DEFAULT_SETTINGS.defaultQuoteNotes,
    defaultInvoiceNotes: dbSettings.default_invoice_notes || DEFAULT_SETTINGS.defaultInvoiceNotes,
    costBoxColor: (dbSettings.cost_box_color as 'slate' | 'amber' | 'blue') || 'slate',
    showBreakdown: dbSettings.show_breakdown ?? true,
    defaultDisplayOptions: dbSettings.default_display_options || DEFAULT_SETTINGS.defaultDisplayOptions,
  };
}

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [projects, setProjects] = useState<JobPack[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const [customersData, jobPacksData, quotesData, scheduleData, settingsData] = await Promise.all([
        customersService.getAll(),
        jobPacksService.getAll(),
        quotesService.getAll(),
        scheduleService.getAll(),
        userSettingsService.get().catch(() => null),
      ]);

      setCustomers(customersData.map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email || '',
        phone: c.phone || '',
        address: c.address || '',
        company: c.company || undefined,
      })));

      setProjects(jobPacksData.map(dbJobPackToApp));
      setQuotes(quotesData.map(dbQuoteToApp));
      setSchedule(scheduleData.map(dbScheduleToApp));

      if (settingsData) {
        setSettings(dbSettingsToApp(settingsData));
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Customer actions
  const addCustomer = async (customer: Omit<Customer, 'id'>): Promise<Customer> => {
    if (!user) throw new Error('Not authenticated');

    const created = await customersService.create({
      user_id: user.id,
      name: customer.name,
      email: customer.email || null,
      phone: customer.phone || null,
      address: customer.address || null,
      company: customer.company || null,
    });

    const newCustomer: Customer = {
      id: created.id,
      name: created.name,
      email: created.email || '',
      phone: created.phone || '',
      address: created.address || '',
      company: created.company || undefined,
    };

    setCustomers(prev => [...prev, newCustomer]);
    return newCustomer;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    await customersService.update(id, {
      name: updates.name,
      email: updates.email || null,
      phone: updates.phone || null,
      address: updates.address || null,
      company: updates.company || null,
    });

    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteCustomer = async (id: string) => {
    await customersService.delete(id);
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  // Quote actions
  const saveQuote = async (quote: Quote): Promise<Quote> => {
    if (!user) throw new Error('Not authenticated');

    const isNew = !quotes.find(q => q.id === quote.id);

    if (isNew) {
      const refNum = await quotesService.getNextReferenceNumber(quote.type);

      const created = await quotesService.create({
        user_id: user.id,
        customer_id: quote.customerId || null,
        job_pack_id: quote.projectId || null,
        title: quote.title,
        type: quote.type,
        status: quote.status,
        sections: quote.sections as any,
        labour_rate: quote.labourRate,
        markup_percent: quote.markupPercent,
        tax_percent: quote.taxPercent,
        cis_percent: quote.cisPercent,
        notes: quote.notes || null,
        display_options: quote.displayOptions as any,
        reference_number: refNum,
      });

      const newQuote = dbQuoteToApp(created);
      setQuotes(prev => [...prev, newQuote]);
      return newQuote;
    } else {
      const updated = await quotesService.update(quote.id, {
        customer_id: quote.customerId || null,
        job_pack_id: quote.projectId || null,
        title: quote.title,
        type: quote.type,
        status: quote.status,
        sections: quote.sections as any,
        labour_rate: quote.labourRate,
        markup_percent: quote.markupPercent,
        tax_percent: quote.taxPercent,
        cis_percent: quote.cisPercent,
        notes: quote.notes || null,
        display_options: quote.displayOptions as any,
      });

      const updatedQuote = dbQuoteToApp(updated);
      setQuotes(prev => prev.map(q => q.id === quote.id ? updatedQuote : q));
      return updatedQuote;
    }
  };

  const updateQuote = async (quote: Quote) => {
    await saveQuote(quote);
  };

  const updateQuoteStatus = async (id: string, status: Quote['status']) => {
    await quotesService.update(id, { status });
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, status, updatedAt: new Date().toISOString() } : q));
  };

  const deleteQuote = async (id: string) => {
    await quotesService.delete(id);
    setQuotes(prev => prev.filter(q => q.id !== id));
  };

  // Project actions
  const addProject = async (project: Omit<JobPack, 'id' | 'createdAt' | 'updatedAt'>): Promise<JobPack> => {
    if (!user) throw new Error('Not authenticated');

    const created = await jobPacksService.create({
      user_id: user.id,
      customer_id: project.customerId || null,
      title: project.title,
      status: project.status,
      notepad: project.notepad || null,
    });

    const newProject: JobPack = {
      id: created.id,
      title: created.title,
      customerId: created.customer_id || '',
      status: created.status as JobPack['status'],
      createdAt: created.created_at,
      updatedAt: created.updated_at,
      notepad: created.notepad || '',
      notes: [],
      photos: [],
      drawings: [],
      documents: [],
      materials: [],
    };

    setProjects(prev => [...prev, newProject]);
    return newProject;
  };

  const saveProject = async (project: JobPack) => {
    await jobPacksService.update(project.id, {
      customer_id: project.customerId || null,
      title: project.title,
      status: project.status,
      notepad: project.notepad || null,
    });

    setProjects(prev => prev.map(p => p.id === project.id ? { ...project, updatedAt: new Date().toISOString() } : p));
  };

  const deleteProject = async (id: string) => {
    await jobPacksService.delete(id);
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  // Schedule actions
  const addScheduleEntry = async (entry: Omit<ScheduleEntry, 'id'>): Promise<ScheduleEntry> => {
    if (!user) throw new Error('Not authenticated');

    const created = await scheduleService.create({
      user_id: user.id,
      job_pack_id: entry.projectId || null,
      customer_id: entry.customerId || null,
      title: entry.title,
      description: entry.description || null,
      location: entry.location || null,
      start_time: entry.start,
      end_time: entry.end,
    });

    const newEntry = dbScheduleToApp(created);
    setSchedule(prev => [...prev, newEntry]);
    return newEntry;
  };

  const updateScheduleEntry = async (id: string, updates: Partial<ScheduleEntry>) => {
    await scheduleService.update(id, {
      job_pack_id: updates.projectId || null,
      customer_id: updates.customerId || null,
      title: updates.title,
      description: updates.description || null,
      location: updates.location || null,
      start_time: updates.start,
      end_time: updates.end,
    });

    setSchedule(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const deleteScheduleEntry = async (id: string) => {
    await scheduleService.delete(id);
    setSchedule(prev => prev.filter(e => e.id !== id));
  };

  const setScheduleEntries: React.Dispatch<React.SetStateAction<ScheduleEntry[]>> = (action) => {
    // This is for direct manipulation - we'll handle sync separately
    setSchedule(action);
  };

  // Settings actions
  const updateSettings = async (updates: Partial<AppSettings>) => {
    await userSettingsService.update({
      default_labour_rate: updates.defaultLabourRate,
      default_tax_rate: updates.defaultTaxRate,
      default_cis_rate: updates.defaultCisRate,
      company_name: updates.companyName || null,
      company_address: updates.companyAddress || null,
      is_vat_registered: updates.isVatRegistered,
      vat_number: updates.vatNumber || null,
      enable_vat: updates.enableVat,
      enable_cis: updates.enableCis,
      quote_prefix: updates.quotePrefix,
      invoice_prefix: updates.invoicePrefix,
      default_quote_notes: updates.defaultQuoteNotes || null,
      default_invoice_notes: updates.defaultInvoiceNotes || null,
      cost_box_color: updates.costBoxColor,
      show_breakdown: updates.showBreakdown,
      default_display_options: updates.defaultDisplayOptions as any,
    });

    setSettings(prev => ({ ...prev, ...updates }));
  };

  const value: DataContextType = {
    customers,
    quotes,
    projects,
    schedule,
    settings,
    loading,
    error,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    saveQuote,
    updateQuote,
    updateQuoteStatus,
    deleteQuote,
    addProject,
    saveProject,
    deleteProject,
    addScheduleEntry,
    updateScheduleEntry,
    deleteScheduleEntry,
    setScheduleEntries,
    updateSettings,
    setSettings,
    setCustomers,
    refresh: fetchData,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};
