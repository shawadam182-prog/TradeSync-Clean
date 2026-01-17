
import React, { useState, useRef, useEffect } from 'react';
import { Quote, Customer, AppSettings, MaterialItem, QuoteSection, QuoteDisplayOptions } from '../types';
import {
  analyzeJobRequirements,
  parseVoiceCommandForItems,
  parseCustomerVoiceInput
} from '../src/services/geminiService';
import {
  ArrowLeft, Mic, Sparkles, Plus,
  Trash2, Loader2, Camera,
  UserPlus, ChevronDown, X, MicOff, AlertCircle,
  HardHat, PoundSterling, Percent, Package, FileText, ShieldCheck,
  Calendar, GripVertical, Copy, Layers,
  User, Hammer, Mail, Phone, MapPin
} from 'lucide-react';
import { AddressAutocomplete } from './AddressAutocomplete';
import { hapticTap, hapticSuccess } from '../src/hooks/useHaptic';

interface QuoteCreatorProps {
  existingQuote?: Quote;
  projectId?: string;
  initialType?: 'estimate' | 'quotation' | 'invoice';
  customers: Customer[];
  settings: AppSettings;
  onSave: (quote: Quote) => void;
  onAddCustomer: (customer: Customer) => Promise<Customer>;
  onCancel: () => void;
}

export const QuoteCreator: React.FC<QuoteCreatorProps> = ({
  existingQuote, projectId, initialType = 'estimate', customers, settings, onSave, onAddCustomer, onCancel
}) => {
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isListeningTitle, setIsListeningTitle] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [targetSectionId, setTargetSectionId] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({});
  const [isListeningCustomer, setIsListeningCustomer] = useState(false);
  const [isProcessingCustomer, setIsProcessingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  // Migration logic for old flat quotes
  const getInitialData = (): Partial<Quote> => {
    if (!existingQuote) {
      // Set default due date for invoices (14 days from now)
      const defaultDueDate = initialType === 'invoice'
        ? (() => {
            const d = new Date();
            d.setDate(d.getDate() + 14);
            return d.toISOString().split('T')[0];
          })()
        : undefined;

      return {
        id: Math.random().toString(36).substr(2, 9),
        projectId,
        date: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString(),
        title: '',
        customerId: '',
        sections: [{
          id: Math.random().toString(36).substr(2, 9),
          title: 'Work Section 1',
          items: [],
          labourHours: 0
        }],
        labourRate: settings.defaultLabourRate,
        markupPercent: 15,
        taxPercent: settings.enableVat ? settings.defaultTaxRate : 0,
        cisPercent: settings.enableCis ? settings.defaultCisRate : 0,
        status: 'draft',
        type: initialType,
        notes: initialType === 'invoice' ? settings.defaultInvoiceNotes : settings.defaultQuoteNotes,
        displayOptions: { ...settings.defaultDisplayOptions },
        dueDate: defaultDueDate
      };
    }

    // If it's an old quote with flat items, migrate it
    if ((existingQuote as any).items) {
      return {
        ...existingQuote,
        sections: [{
          id: 'legacy-section',
          title: existingQuote.title || 'Work Section',
          items: (existingQuote as any).items,
          labourHours: (existingQuote as any).labourHours || 0
        }]
      };
    }

    return existingQuote;
  };

  const [formData, setFormData] = useState<Partial<Quote>>(getInitialData());

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formData.customerId) {
      const c = customers.find(cust => cust.id === formData.customerId);
      if (c) setCustomerSearch(c.name);
    }
  }, [formData.customerId, customers]);

  const handleTypeChange = (newType: 'estimate' | 'quotation' | 'invoice') => {
    setFormData(prev => {
      let updatedNotes = prev.notes;
      const isCurrentlyDefaultQuote = prev.notes === settings.defaultQuoteNotes;
      const isCurrentlyDefaultInvoice = prev.notes === settings.defaultInvoiceNotes;

      if (isCurrentlyDefaultQuote || isCurrentlyDefaultInvoice || !prev.notes) {
        updatedNotes = (newType === 'invoice') ? settings.defaultInvoiceNotes : settings.defaultQuoteNotes;
      }

      // Set default due date when switching to invoice (14 days from now)
      let dueDate = prev.dueDate;
      if (newType === 'invoice' && !prev.dueDate) {
        const defaultDue = new Date();
        defaultDue.setDate(defaultDue.getDate() + 14);
        dueDate = defaultDue.toISOString().split('T')[0];
      }

      return { ...prev, type: newType, notes: updatedNotes, dueDate };
    });
  };

  const recognitionRef = useRef<any>(null);
  const titleRecognitionRef = useRef<any>(null);
  const customerRecognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-GB';
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        if (event.results?.[0]?.isFinal && event.results[0][0]?.transcript) {
          handleVoiceCommand(event.results[0][0].transcript);
        }
      };
      recognitionRef.current = recognition;

      const titleRec = new SpeechRecognition();
      titleRec.continuous = false;
      titleRec.lang = 'en-GB';
      titleRec.onstart = () => setIsListeningTitle(true);
      titleRec.onend = () => setIsListeningTitle(false);
      titleRec.onerror = () => setIsListeningTitle(false);
      titleRec.onresult = (event: any) => {
        if (event.results?.[0]?.[0]?.transcript) {
          setFormData(prev => ({ ...prev, title: event.results[0][0].transcript }));
        }
      };
      titleRecognitionRef.current = titleRec;

      const custRec = new SpeechRecognition();
      custRec.continuous = false;
      custRec.lang = 'en-GB';
      custRec.onstart = () => setIsListeningCustomer(true);
      custRec.onend = () => setIsListeningCustomer(false);
      custRec.onerror = () => setIsListeningCustomer(false);
      custRec.onresult = async (event: any) => {
        if (event.results?.[0]?.[0]?.transcript) {
          const transcript = event.results[0][0].transcript;
          setIsProcessingCustomer(true);
          setCustomerError(null);
          try {
            const details = await parseCustomerVoiceInput(transcript);
            setNewCustomer(prev => ({ ...prev, ...details }));
          } catch (err) {
            setCustomerError("Magic fill failed.");
          } finally {
            setIsProcessingCustomer(false);
          }
        }
      };
      customerRecognitionRef.current = custRec;
    }
    return () => {
      recognitionRef.current?.abort();
      titleRecognitionRef.current?.abort();
      customerRecognitionRef.current?.abort();
    };
  }, []);

  const handleVoiceCommand = async (transcript: string) => {
    const lowerTranscript = transcript.toLowerCase();
    if (lowerTranscript.includes('add') || lowerTranscript.includes('plus')) {
      if (!targetSectionId && formData.sections?.length) {
        setTargetSectionId(formData.sections[0].id);
      }
      setLoading(true);
      try {
        const items = await parseVoiceCommandForItems(transcript);
        if (items && items.length > 0) {
          const newItems = items.map((m: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            name: m.name,
            description: `Voice added`,
            quantity: m.quantity || 1,
            unit: m.unit || 'pc',
            unitPrice: m.unitPrice || 0,
            totalPrice: (m.quantity || 1) * (m.unitPrice || 0),
            isAIProposed: true
          }));
          
          setFormData(prev => ({
            ...prev,
            sections: prev.sections?.map(s => 
              s.id === (targetSectionId || prev.sections?.[0].id) 
                ? { ...s, items: [...s.items, ...newItems] } 
                : s
            )
          }));
        }
      } catch (error) { console.error('Voice command parsing failed:', error); } finally { setLoading(false); }
    } else { setAiInput(prev => (prev + ' ' + transcript).trim()); }
  };

  const runAIAnalysis = async () => {
    if (!aiInput && !attachedImage) return;
    if (!targetSectionId && formData.sections?.length) {
      setTargetSectionId(formData.sections[0].id);
    }
    setLoading(true);
    try {
      const result = await analyzeJobRequirements(aiInput, attachedImage || undefined);
      const newItems = result.materials.map((m: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: m.name,
        description: m.description,
        quantity: m.quantity,
        unit: m.unit,
        unitPrice: m.estimatedUnitPrice,
        totalPrice: m.quantity * m.estimatedUnitPrice,
        isAIProposed: true
      }));

      setFormData(prev => ({
        ...prev,
        sections: prev.sections?.map(s => 
          s.id === (targetSectionId || prev.sections?.[0].id) 
            ? { 
                ...s, 
                title: s.title === 'Work Section 1' ? (result.suggestedTitle || s.title) : s.title,
                labourHours: s.labourHours + (result.laborHoursEstimate || 0),
                items: [...s.items, ...newItems] 
              } 
            : s
        )
      }));
      setAiInput(''); setAttachedImage(null);
    } catch (error) { console.error('AI analysis failed:', error); alert("AI analysis failed."); } finally { setLoading(false); }
  };

  const addSection = () => {
    const newSection: QuoteSection = {
      id: Math.random().toString(36).substr(2, 9),
      title: `Work Section ${ (formData.sections?.length || 0) + 1}`,
      items: [],
      labourHours: 0
    };
    setFormData(prev => ({
      ...prev,
      sections: [...(prev.sections || []), newSection]
    }));
    setTargetSectionId(newSection.id);
  };

  const removeSection = (id: string) => {
    if (formData.sections?.length === 1) return;
    setFormData(prev => ({
      ...prev,
      sections: prev.sections?.filter(s => s.id !== id)
    }));
    if (targetSectionId === id) setTargetSectionId(null);
  };

  const updateSectionTitle = (id: string, title: string) => {
    setFormData(prev => ({
      ...prev,
      sections: prev.sections?.map(s => s.id === id ? { ...s, title } : s)
    }));
  };

  const updateSectionLabour = (id: string, hours: number) => {
    setFormData(prev => ({
      ...prev,
      sections: prev.sections?.map(s => s.id === id ? { ...s, labourHours: hours } : s)
    }));
  };

  const addMaterialToSection = (sectionId: string) => {
    setFormData(prev => ({
      ...prev,
      sections: prev.sections?.map(s => s.id === sectionId ? {
        ...s,
        items: [...s.items, {
          id: Math.random().toString(36).substr(2, 9),
          name: '',
          description: '',
          quantity: 1,
          unit: 'pc',
          unitPrice: 0,
          totalPrice: 0
        }]
      } : s)
    }));
  };

  const updateItem = (sectionId: string, itemId: string, updates: Partial<MaterialItem>) => {
    setFormData(prev => ({
      ...prev,
      sections: prev.sections?.map(s => s.id === sectionId ? {
        ...s,
        items: s.items.map(item => item.id === itemId ? { 
          ...item, 
          ...updates, 
          totalPrice: (updates.quantity ?? item.quantity) * (updates.unitPrice ?? item.unitPrice) 
        } : item)
      } : s)
    }));
  };

  const removeItem = (sectionId: string, itemId: string) => {
    setFormData(prev => ({
      ...prev,
      sections: prev.sections?.map(s => s.id === sectionId ? {
        ...s,
        items: s.items.filter(i => i.id !== itemId)
      } : s)
    }));
  };

  const totals = (() => {
    const sections = formData.sections || [];
    let materialsTotal = 0;
    let labourTotal = 0;
    let sectionsTotal = 0;

    sections.forEach(s => {
      const sectionMaterials = s.items.reduce((sum, i) => sum + i.totalPrice, 0);
      const sectionLabour = s.labourCost || 0;
      const sectionPrice = s.subsectionPrice !== undefined ? s.subsectionPrice : (sectionMaterials + sectionLabour);

      materialsTotal += sectionMaterials;
      labourTotal += sectionLabour;
      sectionsTotal += sectionPrice;
    });

    const subtotal = sectionsTotal;
    const markup = subtotal * ((formData.markupPercent || 0) / 100);
    const clientSubtotal = subtotal + markup;
    const tax = clientSubtotal * ((formData.taxPercent || 0) / 100);
    const cis = labourTotal * ((formData.cisPercent || 0) / 100);

    return { materialsTotal, labourTotal, subtotal, markup, tax, cis, total: (clientSubtotal + tax) - cis };
  })();

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name?.trim()) {
      setCustomerError("Client name is required.");
      return;
    }
    const customer: Customer = {
      id: Math.random().toString(36).substr(2, 9),
      name: newCustomer.name.trim(),
      email: newCustomer.email || '',
      phone: newCustomer.phone || '',
      address: newCustomer.address || '',
      company: newCustomer.company || '',
    };

    try {
      const createdCustomer = await onAddCustomer(customer);
      setFormData(prev => ({ ...prev, customerId: createdCustomer.id }));
      setCustomerSearch(createdCustomer.name);
      setIsAddingCustomer(false);
      setNewCustomer({});
    } catch (error) {
      setCustomerError("Failed to create customer. Please try again.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-32 bg-slate-50 min-h-screen">
      {/* Unified Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => { hapticTap(); onCancel(); }} className="p-2 -ml-2 text-slate-400 hover:text-slate-700">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold text-slate-900">
            {existingQuote
              ? `Edit ${formData.type === 'invoice' ? 'Invoice' : formData.type === 'quotation' ? 'Quotation' : 'Estimate'}`
              : `New ${formData.type === 'invoice' ? 'Invoice' : formData.type === 'quotation' ? 'Quotation' : 'Estimate'}`}
          </h1>
        </div>
        <div className="flex gap-2">
           <button
             onClick={() => { hapticTap(); onSave(formData as Quote); }}
             className="text-amber-600 font-bold text-sm px-3 py-1.5 bg-amber-50 rounded-lg"
           >
             Save
           </button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="grid grid-cols-2 gap-4 mb-4">
             <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Project Title</label>
                <input type="text" className="w-full text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 outline-none focus:border-amber-500 transition-colors placeholder:text-slate-300" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Enter title..." />
             </div>

             {/* Document Type Selector */}
             <div className="col-span-2">
               <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Document Type</label>
               <div className="flex gap-1.5 sm:gap-2">
                 <button
                   type="button"
                   onClick={() => { hapticTap(); handleTypeChange('estimate'); }}
                   className={`flex-1 py-2 sm:py-3 px-2 sm:px-4 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm transition-all ${
                     formData.type === 'estimate'
                       ? 'bg-amber-500 text-white shadow-lg'
                       : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                   }`}
                 >
                   <span className="sm:hidden">Est.</span>
                   <span className="hidden sm:inline">Estimate</span>
                 </button>
                 <button
                   type="button"
                   onClick={() => { hapticTap(); handleTypeChange('quotation'); }}
                   className={`flex-1 py-2 sm:py-3 px-2 sm:px-4 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm transition-all ${
                     formData.type === 'quotation'
                       ? 'bg-blue-500 text-white shadow-lg'
                       : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                   }`}
                 >
                   <span className="sm:hidden">Quote</span>
                   <span className="hidden sm:inline">Quotation</span>
                 </button>
                 <button
                   type="button"
                   onClick={() => { hapticTap(); handleTypeChange('invoice'); }}
                   className={`flex-1 py-2 sm:py-3 px-2 sm:px-4 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm transition-all ${
                     formData.type === 'invoice'
                       ? 'bg-emerald-500 text-white shadow-lg'
                       : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                   }`}
                 >
                   Invoice
                 </button>
               </div>
             </div>

             <div className="relative" ref={dropdownRef}>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Client</label>
                <div className="flex items-center gap-2">
                   <input type="text" className="w-full font-medium text-slate-900 border-b border-slate-100 pb-2 outline-none focus:border-amber-500 transition-colors placeholder:text-slate-300" value={customerSearch} onFocus={() => setShowCustomerDropdown(true)} onChange={e => setCustomerSearch(e.target.value)} placeholder="Select client" />
                   <button onClick={() => setIsAddingCustomer(true)} className="p-1 bg-slate-50 text-amber-600 rounded-md"><UserPlus size={14}/></button>
                </div>
                {showCustomerDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                    {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).map(c => (
                      <button key={c.id} onClick={() => { setFormData({ ...formData, customerId: c.id }); setCustomerSearch(c.name); setShowCustomerDropdown(false); }} className="w-full text-left p-3 hover:bg-slate-50 border-b border-slate-50 flex flex-col">
                        <span className="font-bold text-slate-900">{c.name}</span>
                        {c.company && <span className="text-xs text-slate-500">{c.company}</span>}
                      </button>
                    ))}
                  </div>
                )}
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {formData.type === 'invoice' ? 'Invoice Date' : 'Date'}
                </label>
                <input type="date" className="w-full font-medium text-slate-900 border-b border-slate-100 pb-2 outline-none focus:border-amber-500 transition-colors" value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} />
             </div>

             {/* Job Address (if different from client address) */}
             <div className="col-span-2 mt-2">
               <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                 <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                   <MapPin size={12} className="text-amber-500" />
                   Job Site Address <span className="text-slate-300 font-normal normal-case">(if different from client)</span>
                 </label>
                 <AddressAutocomplete
                   value={formData.jobAddress || ''}
                   onChange={(address) => setFormData(prev => ({ ...prev, jobAddress: address }))}
                   placeholder="Enter job site address if different from client..."
                 />
               </div>
             </div>

             {/* Invoice-specific fields */}
             {formData.type === 'invoice' && (
               <div className="col-span-2 mt-2 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">
                       <Calendar size={12} className="inline mr-1" />
                       Due Date
                     </label>
                     <input
                       type="date"
                       className="w-full font-medium text-slate-900 bg-white border border-emerald-200 rounded-lg px-3 py-2 outline-none focus:border-emerald-400 transition-colors"
                       value={formData.dueDate || ''}
                       onChange={e => setFormData({...formData, dueDate: e.target.value})}
                     />
                   </div>
                   <div className="flex items-end">
                     <div className="text-xs text-emerald-600 font-bold">
                       {formData.dueDate && formData.date && (
                         <>
                           Payment due in{' '}
                           {Math.ceil((new Date(formData.dueDate).getTime() - new Date(formData.date).getTime()) / (1000 * 60 * 60 * 24))}{' '}
                           days
                         </>
                       )}
                     </div>
                   </div>
                 </div>
               </div>
             )}
          </div>
        </div>

      {/* Register Client Modal */}
      {isAddingCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-[32px] md:rounded-[40px] p-3 sm:p-5 md:p-10 max-w-xl w-full mx-2 max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="space-y-2 md:space-y-6">
              <div className="flex justify-between items-center mb-2 md:mb-4">
                <h3 className="font-black text-sm md:text-xl text-slate-900 uppercase tracking-tight">Register Client</h3>
                <button
                  type="button"
                  onClick={() => isListeningCustomer ? customerRecognitionRef.current?.stop() : customerRecognitionRef.current?.start()}
                  disabled={isProcessingCustomer}
                  className={`flex items-center gap-1 px-3 py-1.5 md:px-6 md:py-3 rounded-xl font-black text-[9px] md:text-[10px] uppercase transition-all border ${
                    isListeningCustomer
                      ? 'bg-red-500 text-white border-red-600 animate-pulse'
                      : isProcessingCustomer
                      ? 'bg-amber-500 text-white border-amber-600'
                      : 'bg-white text-amber-600 border-amber-100 hover:bg-amber-50'
                  }`}
                >
                  {isProcessingCustomer ? <Loader2 size={10} className="md:w-3 md:h-3 animate-spin" /> : isListeningCustomer ? <MicOff size={10} className="md:w-3 md:h-3" /> : <Sparkles size={10} className="md:w-3 md:h-3" />}
                  <span className="hidden sm:inline">{isProcessingCustomer ? 'Analyzing...' : isListeningCustomer ? 'Stop' : 'Voice'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-6">
                {/* Name Field */}
                <div className="space-y-0.5">
                  <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1 px-0.5">
                    <User size={10} className="md:w-3 md:h-3" /> Full Name *
                  </label>
                  <input
                    type="text"
                    autoComplete="name"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-1.5 md:px-4 md:py-4 text-slate-950 font-bold text-sm md:text-base outline-none focus:bg-white focus:border-amber-500 transition-all"
                    value={newCustomer.name || ''}
                    placeholder="e.g. John Smith"
                    onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                  />
                </div>

                {/* Company Field */}
                <div className="space-y-0.5">
                  <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1 px-0.5">
                    <Hammer size={10} className="md:w-3 md:h-3" /> Company Name
                  </label>
                  <input
                    type="text"
                    autoComplete="organization"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-1.5 md:px-4 md:py-4 text-slate-950 font-bold text-sm md:text-base outline-none focus:bg-white focus:border-amber-500 transition-all"
                    value={newCustomer.company || ''}
                    placeholder="e.g. Smith & Co Roofing"
                    onChange={e => setNewCustomer({...newCustomer, company: e.target.value})}
                  />
                </div>

                {/* Email Field */}
                <div className="space-y-0.5">
                  <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1 px-0.5">
                    <Mail size={10} className="md:w-3 md:h-3" /> Email Address
                  </label>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-1.5 md:px-4 md:py-4 text-slate-950 font-bold text-sm md:text-base outline-none focus:bg-white focus:border-amber-500 transition-all"
                    value={newCustomer.email || ''}
                    placeholder="john@example.com"
                    onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                  />
                </div>

                {/* Phone Field */}
                <div className="space-y-0.5">
                  <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1 px-0.5">
                    <Phone size={10} className="md:w-3 md:h-3" /> Phone Number
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-1.5 md:px-4 md:py-4 text-slate-950 font-bold text-sm md:text-base outline-none focus:bg-white focus:border-amber-500 transition-all"
                    value={newCustomer.phone || ''}
                    placeholder="07123 456789"
                    onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                  />
                </div>

                {/* Address Field */}
                <div className="md:col-span-2">
                  <AddressAutocomplete
                    value={newCustomer.address || ''}
                    onChange={(address) => setNewCustomer(prev => ({ ...prev, address }))}
                    placeholder="Start typing address or postcode..."
                  />
                </div>
              </div>

              {customerError && (
                <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100">
                  <AlertCircle size={18} />
                  <p className="text-xs font-bold uppercase tracking-widest">{customerError}</p>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button onClick={handleQuickAddCustomer} className="flex-1 bg-amber-500 text-white font-black py-5 rounded-[24px] hover:bg-amber-600 transition-all shadow-xl shadow-amber-200 uppercase tracking-widest text-xs">Register Contact</button>
                <button onClick={() => setIsAddingCustomer(false)} className="px-12 bg-slate-50 text-slate-500 font-black py-5 rounded-[24px] hover:bg-slate-100 transition-all uppercase tracking-widest text-xs">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global AI Magic Builder targeting sections */}
      <details className="group bg-amber-500/5 border border-amber-500/10 p-2 md:p-4 rounded-[20px] shadow-sm">
        <summary className="flex items-center justify-between cursor-pointer list-none">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-100 rounded-lg text-amber-600"><Sparkles size={14} /></div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.1em] text-amber-700 italic">AI Magic Builder</h3>
          </div>
          <ChevronDown size={16} className="text-amber-400 transition-transform group-open:rotate-180" />
        </summary>

        <div className="mt-3 pt-3 border-t border-amber-100/50">
          <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Target:</span>
              <select className="bg-white border border-amber-100 rounded-lg text-[9px] font-black uppercase px-2 py-1 outline-none text-amber-600 cursor-pointer flex-1" value={targetSectionId || ''} onChange={e => setTargetSectionId(e.target.value)}>
                {(formData.sections || []).map((s, idx) => <option key={s.id} value={s.id}>{s.title || `Job ${idx+1}`}</option>)}
              </select>
          </div>
          <div className="relative mb-2">
            <textarea className="w-full bg-white border border-amber-100 rounded-xl p-3 min-h-[60px] text-xs font-bold text-slate-900 outline-none focus:border-amber-400 transition-all placeholder:text-amber-300/60 shadow-inner" placeholder="Describe items..." value={aiInput} onChange={e => setAiInput(e.target.value)} />
            <button onClick={() => isListening ? recognitionRef.current?.stop() : recognitionRef.current?.start()} className={`absolute right-2 bottom-2 p-1.5 rounded-lg shadow-sm transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
              {isListening ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = (e: any) => { const f = e.target.files[0]; if(f){ const r = new FileReader(); r.onload = (ev) => setAttachedImage(ev.target?.result as string); r.readAsDataURL(f); } }; i.click(); }} className="flex-1 bg-white border border-amber-100 text-amber-600 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-50 transition-all shadow-sm flex items-center justify-center gap-1.5">
              <Camera size={12} /> {attachedImage ? 'Photo Attached' : 'Photo'}
            </button>
            <button onClick={runAIAnalysis} disabled={loading || (!aiInput && !attachedImage)} className="flex-1 bg-slate-900 text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl hover:bg-black disabled:opacity-30 flex items-center justify-center gap-1.5 transition-all">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Generate
            </button>
          </div>
        </div>
      </details>

      {/* Multiple Sections / Jobs List */}
      <div className="space-y-4 md:space-y-6">
        {(formData.sections || []).map((section, sectionIdx) => (
          <div key={section.id} className="bg-white rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden transition-all group/section hover:shadow-xl">
            <div className="absolute top-0 left-0 w-2 h-full bg-slate-900 transition-all group-hover/section:bg-amber-500"></div>

            <div className="p-4 md:p-6 space-y-3 md:space-y-4">
              <div className="flex justify-between items-center gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-slate-100 rounded-xl flex items-center justify-center font-black text-xs text-slate-500">{sectionIdx + 1}</div>
                    <input 
                      type="text" 
                      className="bg-transparent text-sm md:text-xl font-black text-slate-900 outline-none focus:text-amber-600 transition-colors w-full" 
                      value={section.title} 
                      onChange={e => updateSectionTitle(section.id, e.target.value)} 
                      placeholder="Job Section Title (e.g. Rewire Kitchen)"
                    />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic ml-11">Work Specifications & Labour</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => removeSection(section.id)} 
                    disabled={formData.sections?.length === 1}
                    className="p-3 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-10"
                    title="Remove Job Section"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>

              {/* Material Items - Amazing List Style */}
              <div className="space-y-3">
                {section.items.map((item) => (
                  <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 relative group overflow-hidden">
                      <div className="flex justify-between items-start mb-3">
                         <div className="flex-1 mr-4">
                            <input type="text" className="w-full font-bold text-base text-slate-900 outline-none placeholder:text-slate-300 bg-transparent" value={item.name} onChange={e => updateItem(section.id, item.id, { name: e.target.value })} placeholder="Item Name" />
                            <input type="text" className="w-full text-xs text-slate-500 outline-none placeholder:text-slate-300 bg-transparent mt-1" value={item.description} onChange={e => updateItem(section.id, item.id, { description: e.target.value })} placeholder="Description (optional)" />
                         </div>
                         <button onClick={() => removeItem(section.id, item.id)} className="p-2 bg-slate-50 text-slate-300 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                      </div>

                      <div className="flex gap-3 bg-slate-50 p-2 rounded-lg">
                         <div className="flex-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1 pl-1">Qty</label>
                            <input type="number" className="w-full bg-white rounded-md text-sm font-bold p-2 text-center shadow-sm outline-none focus:ring-2 focus:ring-amber-100" value={item.quantity || ''} onChange={e => updateItem(section.id, item.id, { quantity: parseFloat(e.target.value) || 0 })} placeholder="0" />
                         </div>
                         <div className="flex-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1 pl-1">Price (£)</label>
                            <input type="number" className="w-full bg-white rounded-md text-sm font-bold p-2 text-center shadow-sm outline-none focus:ring-2 focus:ring-amber-100" value={item.unitPrice || ''} onChange={e => updateItem(section.id, item.id, { unitPrice: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
                         </div>
                         <div className="flex-1 flex flex-col justify-end">
                            <div className="w-full bg-slate-900 rounded-md p-2 text-center">
                               <span className="text-white text-sm font-bold">£{item.totalPrice.toFixed(2)}</span>
                            </div>
                         </div>
                      </div>
                  </div>
                ))}

                <div className="pt-2">
                   <button onClick={() => addMaterialToSection(section.id)} className="w-full flex items-center justify-center gap-2 py-4 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-xs uppercase tracking-wider shadow-sm hover:bg-slate-50 active:scale-95 transition-all">
                      <Plus size={16} className="text-amber-500"/> Add Material Item
                   </button>
                </div>
              </div>

              {/* Section Pricing: Materials, Labour, Subsection Price */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  {/* Materials Total (calculated, read-only display) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
                      <Package size={12} className="text-blue-500" /> Materials
                    </label>
                    <div className="bg-slate-100 rounded-xl px-3 py-2.5 text-center">
                      <span className="text-sm font-black text-slate-600">£{section.items.reduce((s, i) => s + i.totalPrice, 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Labour Cost (editable) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
                      <HardHat size={12} className="text-amber-500" /> Labour
                    </label>
                    <div className="flex items-center bg-white border-2 border-slate-100 rounded-xl px-2 py-1.5 focus-within:border-amber-400 transition-all">
                      <span className="text-slate-400 text-sm font-bold">£</span>
                      <input
                        type="number"
                        className="bg-transparent border-none text-slate-950 font-black text-sm outline-none w-full text-center"
                        value={section.labourCost !== undefined ? section.labourCost : ''}
                        onChange={e => {
                          const labourCost = parseFloat(e.target.value) || 0;
                          setFormData(prev => ({
                            ...prev,
                            sections: prev.sections?.map(s => s.id === section.id ? { ...s, labourCost } : s)
                          }));
                        }}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Subsection Price (editable, auto-calculates if empty) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
                      <PoundSterling size={12} className="text-emerald-500" /> Subsection
                    </label>
                    <div className="flex items-center bg-emerald-50 border-2 border-emerald-200 rounded-xl px-2 py-1.5 focus-within:border-emerald-400 transition-all">
                      <span className="text-emerald-600 text-sm font-bold">£</span>
                      <input
                        type="number"
                        className="bg-transparent border-none text-emerald-700 font-black text-sm outline-none w-full text-center"
                        value={section.subsectionPrice !== undefined ? section.subsectionPrice : (section.items.reduce((s, i) => s + i.totalPrice, 0) + (section.labourCost || 0)).toFixed(2)}
                        onChange={e => {
                          const subsectionPrice = e.target.value === '' ? undefined : parseFloat(e.target.value) || 0;
                          setFormData(prev => ({
                            ...prev,
                            sections: prev.sections?.map(s => s.id === section.id ? { ...s, subsectionPrice } : s)
                          }));
                        }}
                        placeholder="Auto"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[9px] text-slate-400 text-center italic">Materials + Labour = Subsection Price (edit subsection to override)</p>
              </div>
            </div>
          </div>
        ))}

        <button onClick={addSection} className="w-full py-6 md:py-8 border-4 border-dashed border-slate-100 text-slate-300 hover:border-amber-200 hover:text-amber-500 rounded-[32px] transition-all flex flex-col items-center justify-center gap-2">
          <div className="h-12 w-12 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center group-hover:bg-amber-50 group-hover:text-amber-500 transition-colors">
            <Layers size={24} />
          </div>
          <span className="text-xs font-black uppercase tracking-[0.2em]">Add Another Job Section</span>
          <span className="text-[9px] font-bold italic">Separate distinct parts of the project</span>
        </button>
      </div>

      {/* Global Terms & Financial Summary */}
      <div className="bg-white p-3 md:p-5 rounded-[24px] border border-slate-200 space-y-3 md:space-y-4 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
          <div className="h-10 w-10 bg-slate-900 text-amber-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"><FileText size={20} /></div>
          <div><h3 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-widest">Document Terms & Document-wide Rates</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Apply to all sections</p></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2 italic"><PoundSterling size={12} className="text-amber-500" /> Default Hourly Rate</label><input type="number" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 text-slate-950 font-black text-sm outline-none focus:border-amber-400 transition-all" value={formData.labourRate || ''} onChange={e => setFormData({...formData, labourRate: parseFloat(e.target.value) || 0})} placeholder="65.00" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-amber-600 uppercase tracking-widest px-1 flex items-center gap-2 italic"><Percent size={12} className="text-amber-500" /> Global Markup %</label><input type="number" className="w-full bg-amber-50 border-2 border-amber-100 rounded-xl p-3 text-amber-900 font-black text-sm outline-none focus:border-amber-400 transition-all" value={formData.markupPercent || ''} onChange={e => setFormData({...formData, markupPercent: parseFloat(e.target.value) || 0})} placeholder="15" /></div>
        </div>
        <div className="pt-2 space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2 italic"><FileText size={14} className="text-amber-500" /> Document Footer / Terms</label><textarea className="w-full bg-slate-50 border-2 border-slate-100 rounded-[20px] p-3 md:p-4 text-slate-900 font-medium text-sm outline-none focus:border-amber-400 transition-all min-h-[100px]" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Final notes, bank details etc..." /></div>
      </div>

      <div className="bg-slate-900 text-white p-5 md:p-6 rounded-[32px] shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 md:p-6 opacity-10 group-hover:scale-110 transition-transform"><PoundSterling size={100} /></div>
        <div className="flex flex-col md:flex-row justify-between items-end gap-6">
          <div><div className="flex items-center gap-2 mb-2 text-slate-500"><span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic">Consolidated Total</span><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div></div><p className="text-4xl md:text-5xl font-black tracking-tighter">£{totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
          <div className="text-right text-[11px] font-bold space-y-1.5 w-full md:w-auto">
            <div className="flex justify-between md:justify-end gap-3 md:gap-6 border-b border-slate-800 pb-2"><span className="text-slate-500 uppercase tracking-widest">Materials Total</span><span className="text-slate-300 italic">£{totals.materialsTotal.toFixed(2)}</span></div>
            <div className="flex justify-between md:justify-end gap-3 md:gap-6 border-b border-slate-800 pb-2"><span className="text-slate-500 uppercase tracking-widest">Net Sections</span><span className="text-slate-300 italic">£{totals.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between md:justify-end gap-3 md:gap-6 border-b border-slate-800 pb-2"><span className="text-amber-500 uppercase tracking-widest">Markup</span><span className="text-amber-500/80">£{totals.markup.toFixed(2)}</span></div>
            {settings.enableVat && <div className="flex justify-between md:justify-end gap-3 md:gap-6 border-b border-slate-800 pb-2"><span className="text-blue-400 uppercase tracking-widest">VAT</span><span className="text-blue-400/80">£{totals.tax.toFixed(2)}</span></div>}
            {settings.enableCis && <div className="flex justify-between md:justify-end gap-6"><span className="text-red-400 uppercase tracking-widest">CIS</span><span className="text-red-400/80">-£{totals.cis.toFixed(2)}</span></div>}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
