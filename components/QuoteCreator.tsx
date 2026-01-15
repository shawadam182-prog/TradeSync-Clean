
import React, { useState, useRef, useEffect } from 'react';
import { Quote, Customer, AppSettings, MaterialItem, QuoteSection, QuoteDisplayOptions, DBMaterialLibraryItem } from '../types';
import {
  analyzeJobRequirements,
  parseVoiceCommandForItems,
  parseCustomerVoiceInput,
  formatAddressAI,
  reverseGeocode
} from '../src/services/geminiService';
import {
  ArrowLeft, Mic, Sparkles, Plus,
  Trash2, Loader2, Camera,
  UserPlus, ChevronDown, X, MapPinned, MicOff, AlertCircle,
  HardHat, PoundSterling, Clock, Percent, Package, FileText, ShieldCheck,
  Calendar, GripVertical, Copy, Layers, LocateFixed, Library,
  User, Hammer, Mail, Phone, MapPin
} from 'lucide-react';
import { MaterialsLibrary } from './MaterialsLibrary';
import { hapticTap, hapticSuccess } from '../src/hooks/useHaptic';

interface QuoteCreatorProps {
  existingQuote?: Quote;
  projectId?: string;
  customers: Customer[];
  settings: AppSettings;
  onSave: (quote: Quote) => void;
  onAddCustomer: (customer: Customer) => Promise<Customer>;
  onCancel: () => void;
}

export const QuoteCreator: React.FC<QuoteCreatorProps> = ({ 
  existingQuote, projectId, customers, settings, onSave, onAddCustomer, onCancel 
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
  const [isVerifyingAddress, setIsVerifyingAddress] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  // Materials Library modal state
  const [showMaterialsLibrary, setShowMaterialsLibrary] = useState(false);
  const [librarySectionId, setLibrarySectionId] = useState<string | null>(null);
  
  // Migration logic for old flat quotes
  const getInitialData = (): Partial<Quote> => {
    if (!existingQuote) return {
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
      type: 'estimate',
      notes: settings.defaultQuoteNotes,
      displayOptions: { ...settings.defaultDisplayOptions }
    };

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
      return { ...prev, type: newType, notes: updatedNotes };
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

  const openLibraryForSection = (sectionId: string) => {
    setLibrarySectionId(sectionId);
    setShowMaterialsLibrary(true);
  };

  const handleAddFromLibrary = (material: DBMaterialLibraryItem) => {
    if (!librarySectionId) return;

    const sellPrice = material.sell_price ? Number(material.sell_price) : (material.cost_price ? Number(material.cost_price) : 0);

    const newItem: MaterialItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: material.name,
      description: material.description || (material.product_code ? `Code: ${material.product_code}` : ''),
      quantity: 1,
      unit: material.unit || 'pc',
      unitPrice: sellPrice,
      totalPrice: sellPrice,
    };

    setFormData(prev => ({
      ...prev,
      sections: prev.sections?.map(s => s.id === librarySectionId ? {
        ...s,
        items: [...s.items, newItem]
      } : s)
    }));

    setShowMaterialsLibrary(false);
    setLibrarySectionId(null);
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
    let labourHoursTotal = 0;

    sections.forEach(s => {
      materialsTotal += s.items.reduce((sum, i) => sum + i.totalPrice, 0);
      labourHoursTotal += s.labourHours;
    });

    const labourTotal = labourHoursTotal * (formData.labourRate || 0);
    const subtotal = materialsTotal + labourTotal;
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

  const handleVerifyAddress = async () => {
    if (!newCustomer.address) return;
    setIsVerifyingAddress(true);
    try {
      const formatted = await formatAddressAI(newCustomer.address);
      setNewCustomer(prev => ({ ...prev, address: formatted }));
    } catch (err) { setCustomerError("Address verification failed."); } finally { setIsVerifyingAddress(false); }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setCustomerError("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    setCustomerError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const address = await reverseGeocode(latitude, longitude);
          if (address) {
            setNewCustomer(prev => ({ ...prev, address }));
          } else {
            setCustomerError("Could not determine address from your location.");
          }
        } catch (err) {
          setCustomerError("Failed to geocode your location.");
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        setCustomerError("Location access denied or unavailable.");
      }
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-2 md:space-y-4 pb-20">
      {/* Header with actions */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => { hapticTap(); onCancel(); }}
          className="flex items-center gap-2 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-slate-900 transition-colors min-h-[44px] px-2"
        >
          <ArrowLeft size={18} />
          <span className="hidden sm:inline">Cancel</span>
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => { hapticTap(); onSave(formData as Quote); }}
            className="bg-white border-2 border-slate-100 text-slate-700 px-4 py-2.5 min-h-[44px] rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm active:scale-95"
          >
            <span className="hidden sm:inline">Save Draft</span>
            <span className="sm:hidden">Save</span>
          </button>
          <button
            onClick={() => { hapticSuccess(); onSave({...formData as Quote, status: 'sent'}); }}
            className="bg-amber-500 text-white px-4 sm:px-7 py-2.5 min-h-[44px] rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-amber-200 hover:bg-amber-600 transition-all active:scale-95"
          >
            <span className="hidden sm:inline">Finalize & Send</span>
            <span className="sm:hidden">Send</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-3 md:p-5 rounded-[32px] border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-1">
          <div className="flex justify-between items-center px-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Document Title</label>
            <button type="button" onClick={() => isListeningTitle ? titleRecognitionRef.current?.stop() : titleRecognitionRef.current?.start()} className={`p-1 rounded-md border ${isListeningTitle ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 bg-white shadow-sm'}`}><Mic size={12} /></button>
          </div>
          <input type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-amber-400 focus:bg-white transition-all text-slate-950" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Full House Refurbishment" />
        </div>
        
        <div className="space-y-1 relative" ref={dropdownRef}>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Assign Client</label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none text-slate-950 focus:border-amber-400 focus:bg-white transition-all" value={customerSearch} onFocus={() => setShowCustomerDropdown(true)} onChange={e => setCustomerSearch(e.target.value)} placeholder="Search clients..." />
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            </div>
            <button onClick={() => setIsAddingCustomer(true)} className="p-4 bg-slate-900 text-amber-500 rounded-2xl hover:bg-black transition-all shadow-sm" title="Add New Client"><UserPlus size={20} /></button>
          </div>
          {showCustomerDropdown && (
            <div className="absolute z-50 left-0 right-0 mt-2 bg-white border-2 border-slate-100 rounded-[24px] shadow-2xl max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2">
              {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).map(c => (
                <button key={c.id} onClick={() => { setFormData({ ...formData, customerId: c.id }); setCustomerSearch(c.name); setShowCustomerDropdown(false); }} className="w-full text-left p-4 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex flex-col">
                  <span className="text-sm font-black text-slate-900">{c.name}</span>
                  {c.company && <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest italic">{c.company}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Issue Date</label>
          <div className="relative">
            <input type="date" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none text-slate-950 focus:border-amber-400 focus:bg-white transition-all cursor-pointer" value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} />
            <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Document Category</label>
          <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none text-slate-950 focus:border-amber-400 focus:bg-white transition-all cursor-pointer" value={formData.type} onChange={e => handleTypeChange(e.target.value as any)}>
            <option value="estimate">Estimate</option>
            <option value="quotation">Quotation</option>
            <option value="invoice">Invoice</option>
          </select>
        </div>
      </div>

      {/* Register Client Modal */}
      {isAddingCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] p-4 md:p-10 max-w-xl w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
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
                <div className="md:col-span-2 space-y-0.5 relative">
                  <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5 italic px-1">
                    <MapPin size={10} className="md:w-3 md:h-3" /> Main Site Address
                  </label>
                  <div className="relative">
                    <textarea
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-1.5 md:px-4 md:py-4 pr-28 md:pr-32 text-slate-950 font-bold text-sm outline-none min-h-[50px] md:min-h-[100px] focus:bg-white focus:border-amber-500 transition-all"
                      placeholder="Street, Town, Postcode..."
                      value={newCustomer.address || ''}
                      onChange={e => setNewCustomer({...newCustomer, address: e.target.value})}
                    />
                    <div className="absolute right-1 top-1 flex gap-0.5">
                      <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        disabled={isLocating}
                        className="p-1 md:p-2 rounded-lg transition-all text-blue-500 hover:text-blue-700 disabled:opacity-30 bg-transparent"
                        title="Use current location"
                      >
                        {isLocating ? <Loader2 size={14} className="md:w-[18px] md:h-[18px] animate-spin" /> : <LocateFixed size={14} className="md:w-[18px] md:h-[18px]" />}
                      </button>
                      <button
                        type="button"
                        onClick={handleVerifyAddress}
                        disabled={!newCustomer.address || isVerifyingAddress}
                        className="p-1 md:p-2 rounded-lg transition-all text-amber-500 hover:text-amber-700 disabled:opacity-30 bg-transparent"
                        title="AI verify address"
                      >
                        {isVerifyingAddress ? <Loader2 size={14} className="md:w-[18px] md:h-[18px] animate-spin" /> : <MapPinned size={14} className="md:w-[18px] md:h-[18px]" />}
                      </button>
                    </div>
                  </div>
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
      <div className="bg-amber-500/5 border-2 border-amber-500/10 p-2 md:p-4 rounded-[24px] shadow-sm group">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 italic flex items-center gap-2"><Sparkles size={14} className="animate-pulse"/> AI Magic Item Builder</h3>
            <div className="h-4 w-px bg-amber-200 mx-2"></div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Targets:</span>
              <select className="bg-white border border-amber-100 rounded-lg text-[9px] font-black uppercase px-2 py-1 outline-none text-amber-600 cursor-pointer" value={targetSectionId || ''} onChange={e => setTargetSectionId(e.target.value)}>
                {(formData.sections || []).map((s, idx) => <option key={s.id} value={s.id}>{s.title || `Job ${idx+1}`}</option>)}
              </select>
            </div>
          </div>
          <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest opacity-60 hidden md:inline">Speech or Photos</span>
        </div>
        <div className="relative mb-2">
          <textarea className="w-full bg-white border-2 border-amber-100 rounded-[20px] p-3 md:p-4 min-h-[80px] text-sm font-bold text-slate-900 outline-none focus:border-amber-400 transition-all placeholder:text-amber-300/60 shadow-inner" placeholder="Describe items for the selected section..." value={aiInput} onChange={e => setAiInput(e.target.value)} />
          <button onClick={() => isListening ? recognitionRef.current?.stop() : recognitionRef.current?.start()} className={`absolute right-2 bottom-2 p-2 rounded-xl shadow-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = (e: any) => { const f = e.target.files[0]; if(f){ const r = new FileReader(); r.onload = (ev) => setAttachedImage(ev.target?.result as string); r.readAsDataURL(f); } }; i.click(); }} className="flex-1 bg-white border-2 border-amber-100 text-amber-600 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-50 transition-all shadow-sm flex items-center justify-center gap-2">
            <Camera size={14} /> {attachedImage ? 'Photo Attached' : 'Attach Photo'}
          </button>
          <button onClick={runAIAnalysis} disabled={loading || (!aiInput && !attachedImage)} className="flex-1 bg-slate-900 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-black disabled:opacity-30 flex items-center justify-center gap-2 transition-all">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Analyze Job Details
          </button>
        </div>
      </div>

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

              {/* Material Items inside Section */}
              <div className="space-y-3">
                <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                  <div className="col-span-6">Material / Description</div>
                  <div className="col-span-2 text-center">Quantity</div>
                  <div className="col-span-2 text-right">Unit Price (£)</div>
                  <div className="col-span-2 text-right pr-6">Total</div>
                </div>
                <div className="space-y-1.5">
                  {section.items.map((item) => (
                    <div key={item.id} className="group grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-2.5 rounded-xl border-2 border-slate-50 bg-white transition-all hover:border-slate-200">
                      <div className="md:col-span-6 flex items-start gap-3">
                        <div className="flex flex-col gap-0.5 flex-1">
                          <input type="text" className="w-full font-black text-sm bg-transparent text-slate-950 outline-none focus:text-amber-600 transition-colors" value={item.name} onChange={e => updateItem(section.id, item.id, { name: e.target.value })} placeholder="Item name..." />
                          <input type="text" className="w-full text-[10px] bg-transparent text-slate-400 italic outline-none" value={item.description} onChange={e => updateItem(section.id, item.id, { description: e.target.value })} placeholder="Details..." />
                        </div>
                      </div>
                      <div className="md:col-span-2 flex items-center justify-center">
                        <div className="flex items-center bg-slate-50 rounded-xl px-2 py-1 gap-1 border border-slate-100 w-full max-w-[100px]">
                          <input type="number" className="w-full text-center text-xs font-black bg-transparent text-slate-950 outline-none" value={item.quantity || ''} onChange={e => updateItem(section.id, item.id, { quantity: parseFloat(e.target.value) || 0 })} />
                          <input type="text" className="w-8 text-center text-[9px] font-black text-slate-400 uppercase bg-transparent outline-none" value={item.unit} onChange={e => updateItem(section.id, item.id, { unit: e.target.value })} placeholder="unit" />
                        </div>
                      </div>
                      <div className="md:col-span-2 flex items-center justify-end">
                        <div className="flex items-center gap-1 bg-slate-50 rounded-xl px-2 py-1.5 border border-slate-100 w-full max-w-[100px]">
                          <span className="text-[10px] font-black text-slate-400 italic">£</span>
                          <input type="number" className="w-full text-right text-xs font-black bg-transparent text-slate-950 outline-none" value={item.unitPrice || ''} onChange={e => updateItem(section.id, item.id, { unitPrice: parseFloat(e.target.value) || 0 })} />
                        </div>
                      </div>
                      <div className="md:col-span-2 flex items-center justify-between pl-4">
                        <span className="text-sm font-black text-slate-900">£{item.totalPrice.toFixed(2)}</span>
                        <button onClick={() => removeItem(section.id, item.id)} className="p-1.5 text-slate-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                   <button onClick={() => addMaterialToSection(section.id)} className="flex-1 py-3 border-2 border-dashed border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:border-amber-200 hover:text-amber-500 transition-all flex items-center justify-center gap-2"><Plus size={14}/> Add Item</button>
                   <button onClick={() => openLibraryForSection(section.id)} className="flex-1 py-3 border-2 border-slate-200 bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:border-amber-400 hover:bg-amber-50 hover:text-amber-600 transition-all flex items-center justify-center gap-2"><Library size={14}/> Add from Library</button>
                </div>
              </div>

              {/* Section Labour Estimate */}
              <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                   <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2 italic"><Clock size={12} className="text-amber-500" /> Labour Est (Hrs)</label>
                    <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 focus-within:border-amber-400 focus-within:bg-white transition-all">
                      <input type="number" className="bg-transparent border-none text-slate-950 font-black text-sm outline-none w-20" value={section.labourHours || ''} onChange={e => updateSectionLabour(section.id, parseFloat(e.target.value) || 0)} placeholder="0.0" />
                      <span className="text-[10px] font-black text-slate-300 uppercase">hrs</span>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100 text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Section Subtotal</p>
                  <p className="text-lg font-black text-slate-900">£{(section.items.reduce((s, i) => s + i.totalPrice, 0) + (section.labourHours * (formData.labourRate || 0))).toFixed(2)}</p>
                </div>
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

      {/* Materials Library Modal */}
      {showMaterialsLibrary && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] max-w-5xl w-full max-h-[90vh] overflow-auto shadow-2xl border border-slate-200">
            <div className="sticky top-0 bg-white border-b border-slate-100 p-3 md:p-4 flex justify-between items-center z-10">
              <div>
                <h3 className="text-lg font-black text-slate-900">Add from Materials Library</h3>
                <p className="text-xs text-slate-500">Select a material to add to your quote</p>
              </div>
              <button
                onClick={() => { setShowMaterialsLibrary(false); setLibrarySectionId(null); }}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-4">
              <MaterialsLibrary
                selectionMode={true}
                onSelectMaterial={handleAddFromLibrary}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
