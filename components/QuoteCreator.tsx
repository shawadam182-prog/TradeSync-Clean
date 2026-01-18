
import React, { useState, useRef, useEffect } from 'react';
import { Quote, Customer, AppSettings, MaterialItem, QuoteSection, QuoteDisplayOptions, LabourItem, DBMaterialLibraryItem } from '../types';
import {
  analyzeJobRequirements,
  parseVoiceCommandForItems,
  parseCustomerVoiceInput
} from '../src/services/geminiService';
import {
  ArrowLeft, Mic, Sparkles, Plus, Minus,
  Trash2, Loader2, Camera,
  UserPlus, ChevronDown, X, MicOff, AlertCircle,
  HardHat, PoundSterling, Percent, Package, FileText, ShieldCheck,
  Calendar, GripVertical, Copy, Layers, Clock, BookmarkPlus, Type, Tag,
  User, Hammer, Mail, Phone, MapPin, Banknote
} from 'lucide-react';
import { AddressAutocomplete } from './AddressAutocomplete';
import { hapticTap, hapticSuccess } from '../src/hooks/useHaptic';
import { MaterialsLibrary } from './MaterialsLibrary';
import { useData } from '../src/contexts/DataContext';
import { useToast } from '../src/contexts/ToastContext';

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
  const { services } = useData();
  const toast = useToast();

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

  // Materials Library modal
  const [showMaterialsLibrary, setShowMaterialsLibrary] = useState(false);
  const [targetSectionForMaterial, setTargetSectionForMaterial] = useState<string | null>(null);

  // Discount modal
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  // Part Payment modal
  const [showPartPaymentModal, setShowPartPaymentModal] = useState(false);

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

  // Labour items functions
  const addLabourItem = (sectionId: string) => {
    const newLabourItem: LabourItem = {
      id: Math.random().toString(36).substr(2, 9),
      description: '',
      hours: 1,
    };
    setFormData(prev => ({
      ...prev,
      sections: prev.sections?.map(s => s.id === sectionId ? {
        ...s,
        labourItems: [...(s.labourItems || []), newLabourItem]
      } : s)
    }));
  };

  const updateLabourItem = (sectionId: string, itemId: string, updates: Partial<LabourItem>) => {
    setFormData(prev => ({
      ...prev,
      sections: prev.sections?.map(s => s.id === sectionId ? {
        ...s,
        labourItems: s.labourItems?.map(item => item.id === itemId ? { ...item, ...updates } : item)
      } : s)
    }));
  };

  const removeLabourItem = (sectionId: string, itemId: string) => {
    setFormData(prev => ({
      ...prev,
      sections: prev.sections?.map(s => s.id === sectionId ? {
        ...s,
        labourItems: s.labourItems?.filter(i => i.id !== itemId)
      } : s)
    }));
  };

  // Calculate labour totals for a section
  const calculateSectionLabour = (section: QuoteSection) => {
    const defaultRate = section.labourRate || formData.labourRate || settings.defaultLabourRate;
    if (section.labourItems && section.labourItems.length > 0) {
      return section.labourItems.reduce((sum, item) => {
        const rate = item.rate || defaultRate;
        return sum + (item.hours * rate);
      }, 0);
    }
    // Fallback to labourCost if no itemized labour
    return section.labourCost || 0;
  };

  const getTotalLabourHours = (section: QuoteSection) => {
    if (section.labourItems && section.labourItems.length > 0) {
      return section.labourItems.reduce((sum, item) => sum + item.hours, 0);
    }
    return section.labourHours || 0;
  };

  // Add heading/divider to section
  const addHeadingToSection = (sectionId: string) => {
    const newItem: MaterialItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      description: '',
      quantity: 0,
      unit: '',
      unitPrice: 0,
      totalPrice: 0,
      isHeading: true
    };
    setFormData(prev => ({
      ...prev,
      sections: prev.sections?.map(s => s.id === sectionId ? {
        ...s,
        items: [...s.items, newItem]
      } : s)
    }));
  };

  // Add material from library
  const addMaterialFromLibrary = (sectionId: string, material: DBMaterialLibraryItem) => {
    const newItem: MaterialItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: material.name,
      description: material.description || '',
      quantity: 1,
      unit: material.unit || 'pc',
      unitPrice: material.sell_price || material.cost_price || 0,
      totalPrice: material.sell_price || material.cost_price || 0,
    };
    setFormData(prev => ({
      ...prev,
      sections: prev.sections?.map(s => s.id === sectionId ? {
        ...s,
        items: [...s.items, newItem]
      } : s)
    }));
    setShowMaterialsLibrary(false);
    hapticSuccess();
  };

  // Save item to materials library
  const saveItemToLibrary = async (item: MaterialItem) => {
    try {
      await services.materialsLibrary.create({
        name: item.name,
        description: item.description,
        unit: item.unit,
        sell_price: item.unitPrice,
      });
      toast.success('Saved', `${item.name} added to price list`);
      hapticSuccess();
    } catch (err) {
      toast.error('Failed', 'Could not save to price list');
    }
  };

  // Quantity increment/decrement
  const incrementQuantity = (sectionId: string, itemId: string) => {
    setFormData(prev => ({
      ...prev,
      sections: prev.sections?.map(s => s.id === sectionId ? {
        ...s,
        items: s.items.map(item => item.id === itemId ? {
          ...item,
          quantity: item.quantity + 1,
          totalPrice: (item.quantity + 1) * item.unitPrice
        } : item)
      } : s)
    }));
  };

  const decrementQuantity = (sectionId: string, itemId: string) => {
    setFormData(prev => ({
      ...prev,
      sections: prev.sections?.map(s => s.id === sectionId ? {
        ...s,
        items: s.items.map(item => item.id === itemId ? {
          ...item,
          quantity: Math.max(0, item.quantity - 1),
          totalPrice: Math.max(0, item.quantity - 1) * item.unitPrice
        } : item)
      } : s)
    }));
  };

  // Labour hours increment/decrement
  const incrementLabourHours = (sectionId: string, itemId: string) => {
    updateLabourItem(sectionId, itemId, { hours: ((formData.sections?.find(s => s.id === sectionId)?.labourItems?.find(i => i.id === itemId)?.hours || 0) + 0.5) });
  };

  const decrementLabourHours = (sectionId: string, itemId: string) => {
    const current = formData.sections?.find(s => s.id === sectionId)?.labourItems?.find(i => i.id === itemId)?.hours || 0;
    updateLabourItem(sectionId, itemId, { hours: Math.max(0, current - 0.5) });
  };

  // Calculate discount
  const calculateDiscount = () => {
    if (!formData.discountValue) return 0;
    const subtotal = totals.subtotal + totals.markup;
    if (formData.discountType === 'percentage') {
      return subtotal * (formData.discountValue / 100);
    }
    return formData.discountValue;
  };

  const totals = (() => {
    const sections = formData.sections || [];
    let materialsTotal = 0;
    let labourTotal = 0;
    let sectionsTotal = 0;

    sections.forEach(s => {
      const sectionMaterials = s.items.filter(i => !i.isHeading).reduce((sum, i) => sum + i.totalPrice, 0);
      // Use labourItems if present, otherwise fall back to labourCost
      const sectionLabour = calculateSectionLabour(s);
      const sectionPrice = s.subsectionPrice !== undefined ? s.subsectionPrice : (sectionMaterials + sectionLabour);

      materialsTotal += sectionMaterials;
      labourTotal += sectionLabour;
      sectionsTotal += sectionPrice;
    });

    const subtotal = sectionsTotal;
    const markup = subtotal * ((formData.markupPercent || 0) / 100);
    const clientSubtotal = subtotal + markup;

    // Calculate discount
    let discountAmount = 0;
    if (formData.discountValue) {
      if (formData.discountType === 'percentage') {
        discountAmount = clientSubtotal * (formData.discountValue / 100);
      } else {
        discountAmount = formData.discountValue;
      }
    }

    const afterDiscount = clientSubtotal - discountAmount;
    const tax = afterDiscount * ((formData.taxPercent || 0) / 100);
    const cis = labourTotal * ((formData.cisPercent || 0) / 100);

    return { materialsTotal, labourTotal, subtotal, markup, discount: discountAmount, tax, cis, total: (afterDiscount + tax) - cis };
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
    <div className="max-w-4xl mx-auto pb-40 md:pb-32 bg-slate-50 min-h-screen">
      {/* Unified Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => { hapticTap(); onCancel(); }} className="p-2 -ml-2 text-slate-400 hover:text-slate-700">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            {existingQuote
              ? `Edit ${formData.type === 'invoice' ? 'Invoice' : formData.type === 'quotation' ? 'Quotation' : 'Estimate'}`
              : `New ${formData.type === 'invoice' ? 'Invoice' : formData.type === 'quotation' ? 'Quotation' : 'Estimate'}`}
          </h1>
        </div>
        <div className="flex gap-2">
           <button
             onClick={() => {
               hapticTap();
               // If it's a new invoice, change status from 'draft' to 'sent'
               const quoteToSave = !existingQuote && formData.type === 'invoice' && formData.status === 'draft'
                 ? { ...formData, status: 'sent' } as Quote
                 : formData as Quote;
               onSave(quoteToSave);
             }}
             className="text-teal-600 font-bold text-sm px-3 py-1.5 bg-teal-50 rounded-lg"
           >
             Save
           </button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
             <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Project Title</label>
                <input type="text" className="w-full text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 outline-none focus:border-teal-500 transition-colors placeholder:text-slate-300" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Enter title..." />
             </div>

             {/* Document Type Selector */}
             <div className="col-span-1 md:col-span-2">
               <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Document Type</label>
               <div className="flex gap-1.5 sm:gap-2">
                 <button
                   type="button"
                   onClick={() => { hapticTap(); handleTypeChange('estimate'); }}
                   className={`flex-1 py-2 sm:py-3 px-2 sm:px-4 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm transition-all ${
                     formData.type === 'estimate'
                       ? 'bg-teal-500 text-white shadow-lg'
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
                       ? 'bg-slate-900 text-white shadow-lg'
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
             <div className="col-span-1 md:col-span-2 mt-2">
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
               <div className="col-span-1 md:col-span-2 mt-2 p-4 bg-slate-100 rounded-xl border border-slate-200">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      <div className="space-y-3 md:space-y-4">
        {(formData.sections || []).map((section, sectionIdx) => (
          <div key={section.id} className="bg-white rounded-xl border border-slate-200 shadow-sm relative overflow-hidden transition-all group/section hover:shadow-xl">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-900 transition-all group-hover/section:bg-teal-500"></div>

            <div className="p-1.5 md:p-2 space-y-1.5 md:space-y-2">
              <div className="flex justify-between items-center gap-2">
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 bg-slate-100 rounded-lg flex items-center justify-center font-black text-[10px] text-slate-500">{sectionIdx + 1}</div>
                    <input
                      type="text"
                      className="bg-transparent text-xs md:text-base font-black text-slate-900 outline-none focus:text-teal-600 transition-colors w-full leading-tight py-0.5"
                      value={section.title}
                      onChange={e => updateSectionTitle(section.id, e.target.value)}
                      placeholder="Job Section Title (e.g. Rewire Kitchen)"
                    />
                  </div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic ml-8">Work Specifications & Labour</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => removeSection(section.id)}
                    disabled={formData.sections?.length === 1}
                    className="p-1.5 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-10"
                    title="Remove Job Section"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Material Items - Amazing List Style */}
              <div className="space-y-1">
                {section.items.map((item) => (
                  item.isHeading ? (
                    // Heading/Divider rendering
                    <div key={item.id} className="bg-slate-100 px-2 py-0.5 rounded my-0.5 flex items-center gap-1">
                      <Type size={10} className="text-slate-400" />
                      <input
                        type="text"
                        className="bg-transparent text-[9px] font-black uppercase tracking-widest text-slate-500 flex-1 outline-none placeholder:text-slate-300 leading-tight py-0.5"
                        value={item.name}
                        onChange={e => updateItem(section.id, item.id, { name: e.target.value })}
                        placeholder="SECTION HEADING"
                      />
                      <button onClick={() => removeItem(section.id, item.id)} className="p-0.5 text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 size={10}/>
                      </button>
                    </div>
                  ) : (
                    // Normal material item
                    <div key={item.id} className="bg-white p-0.5 rounded-md shadow-sm border border-slate-100 relative group overflow-hidden">
                      <div className="flex justify-between items-center gap-1 mb-0.5">
                         <div className="flex-1 min-w-0">
                            <input type="text" className="w-full h-4 font-bold text-[10px] text-slate-900 outline-none placeholder:text-slate-300 bg-transparent leading-none p-0 m-0" value={item.name} onChange={e => updateItem(section.id, item.id, { name: e.target.value })} placeholder="Item Name" />
                            <input type="text" className="w-full h-3 text-[8px] text-slate-500 outline-none placeholder:text-slate-300 bg-transparent leading-none p-0 m-0 mt-0.5" value={item.description} onChange={e => updateItem(section.id, item.id, { description: e.target.value })} placeholder="Description (optional)" />
                         </div>
                         <div className="flex gap-0.5 shrink-0">
                           {/* Save to Price List */}
                           {item.name && (
                             <button
                               onClick={() => saveItemToLibrary(item)}
                               className="p-1 bg-slate-50 text-slate-300 rounded hover:bg-teal-50 hover:text-teal-500 transition-colors touch-manipulation"
                               title="Save to price list"
                             >
                               <BookmarkPlus size={10}/>
                             </button>
                           )}
                           <button onClick={() => removeItem(section.id, item.id)} className="p-1 bg-slate-50 text-slate-300 rounded hover:bg-red-50 hover:text-red-500 transition-colors touch-manipulation">
                             <Trash2 size={10}/>
                           </button>
                         </div>
                      </div>

                      <div className="flex gap-0.5 bg-slate-50 p-0.5 rounded">
                         {/* Quantity with +/- buttons */}
                         <div className="flex-1">
                            <label className="text-[6px] font-bold text-slate-400 uppercase tracking-wider block leading-none mb-0.5">Qty</label>
                            <div className="flex items-center bg-white rounded shadow-sm border border-slate-100 h-6">
                              <button
                                type="button"
                                onClick={() => decrementQuantity(section.id, item.id)}
                                className="px-1.5 h-full hover:bg-slate-50 rounded-l transition-colors touch-manipulation active:bg-slate-100"
                              >
                                <Minus size={10} className="text-slate-400" />
                              </button>
                              <input
                                type="number"
                                className="w-10 h-full bg-transparent text-sm font-black text-center outline-none text-slate-900"
                                value={item.quantity || ''}
                                onChange={e => updateItem(section.id, item.id, { quantity: parseFloat(e.target.value) || 0 })}
                                placeholder="0"
                              />
                              <button
                                type="button"
                                onClick={() => incrementQuantity(section.id, item.id)}
                                className="px-1.5 h-full hover:bg-slate-50 rounded-r transition-colors touch-manipulation active:bg-slate-100"
                              >
                                <Plus size={10} className="text-slate-400" />
                              </button>
                            </div>
                         </div>
                         <div className="flex-1">
                            <label className="text-[6px] font-bold text-slate-400 uppercase tracking-wider block leading-none mb-0.5">Price (£)</label>
                            <input type="number" className="w-full h-6 bg-white rounded text-[10px] font-bold px-0.5 text-center shadow-sm outline-none focus:ring-1 focus:ring-teal-100 border border-slate-100" value={item.unitPrice || ''} onChange={e => updateItem(section.id, item.id, { unitPrice: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
                         </div>
                         <div className="flex-1 flex flex-col justify-end">
                            <div className="w-full h-6 bg-slate-900 rounded px-0.5 text-center flex items-center justify-center">
                               <span className="text-white text-[10px] font-bold leading-none">£{item.totalPrice.toFixed(2)}</span>
                            </div>
                         </div>
                      </div>
                    </div>
                  )
                ))}

                {/* Action buttons for materials */}
                <div className="flex gap-1 pt-1">
                   <button onClick={() => addMaterialToSection(section.id)} className="flex-1 flex items-center justify-center gap-1 py-1 bg-white border border-slate-200 rounded text-slate-600 font-bold text-[9px] uppercase tracking-wider shadow-sm hover:bg-slate-50 active:scale-95 transition-all">
                      <Plus size={12} className="text-teal-500"/> Add Item
                   </button>
                   <button
                     onClick={() => {
                       setTargetSectionForMaterial(section.id);
                       setShowMaterialsLibrary(true);
                     }}
                     className="flex-1 flex items-center justify-center gap-1 py-1 bg-teal-50 border border-teal-200 rounded text-teal-600 font-bold text-[9px] uppercase tracking-wider shadow-sm hover:bg-teal-100 active:scale-95 transition-all"
                   >
                     <Package size={12}/> Price List
                   </button>
                   <button
                     onClick={() => addHeadingToSection(section.id)}
                     className="flex items-center justify-center gap-0.5 py-1 px-2 bg-slate-50 border border-slate-200 rounded text-slate-500 font-bold text-[9px] uppercase tracking-wider shadow-sm hover:bg-slate-100 active:scale-95 transition-all"
                   >
                     <Type size={10}/>
                   </button>
                </div>
              </div>

              {/* Labour Items Section */}
              <div className="pt-1 mt-1 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <HardHat size={12} className="text-blue-500" />
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Labour</span>
                  </div>
                  <div className="text-[9px] text-slate-400">
                    Rate: £{section.labourRate || formData.labourRate || settings.defaultLabourRate}/hr
                  </div>
                </div>

                {/* Labour Items List */}
                {(section.labourItems || []).map((labourItem) => (
                  <div key={labourItem.id} className="bg-blue-50 p-0.5 rounded mb-1">
                    {/* Top row: Description and delete button */}
                    <div className="flex items-center gap-1 mb-0.5">
                      <input
                        type="text"
                        placeholder="Labour description..."
                        value={labourItem.description}
                        onChange={e => updateLabourItem(section.id, labourItem.id, { description: e.target.value })}
                        className="flex-1 bg-transparent text-[10px] font-medium text-slate-900 outline-none placeholder:text-blue-300 leading-tight py-0.5"
                      />
                      <button
                        onClick={() => removeLabourItem(section.id, labourItem.id)}
                        className="p-0.5 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                    {/* Bottom row: Hours controls and price */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-0.5 bg-white rounded px-1 py-0.5 border border-blue-200 h-6">
                        <button
                          type="button"
                          onClick={() => decrementLabourHours(section.id, labourItem.id)}
                          className="px-1 h-full hover:bg-blue-50 rounded transition-colors touch-manipulation active:bg-blue-100"
                        >
                          <Minus size={10} className="text-blue-500" />
                        </button>
                        <input
                          type="number"
                          value={labourItem.hours}
                          onChange={e => updateLabourItem(section.id, labourItem.id, { hours: parseFloat(e.target.value) || 0 })}
                          className="w-12 h-full text-center font-black text-xs bg-transparent outline-none text-slate-900"
                          step="0.5"
                        />
                        <span className="text-[8px] text-slate-400 font-bold">hrs</span>
                        <button
                          type="button"
                          onClick={() => incrementLabourHours(section.id, labourItem.id)}
                          className="px-1 h-full hover:bg-blue-50 rounded transition-colors touch-manipulation active:bg-blue-100"
                        >
                          <Plus size={10} className="text-blue-500" />
                        </button>
                      </div>
                      <span className="font-bold text-blue-600 text-[11px]">
                        £{(labourItem.hours * (labourItem.rate || section.labourRate || formData.labourRate || settings.defaultLabourRate)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Add Labour Item Button */}
                <button
                  onClick={() => addLabourItem(section.id)}
                  className="w-full flex items-center justify-center gap-1 py-1 bg-blue-50 border border-blue-200 rounded text-blue-600 font-bold text-[9px] uppercase tracking-wider hover:bg-blue-100 active:scale-95 transition-all mt-1"
                >
                  <Plus size={10} /> Add Labour Item
                </button>

                {/* Labour Summary */}
                {(section.labourItems && section.labourItems.length > 0) && (
                  <div className="flex justify-between items-center mt-1 pt-1 border-t border-blue-100">
                    <span className="text-[9px] text-slate-500">
                      Total: {getTotalLabourHours(section)} hours × £{section.labourRate || formData.labourRate || settings.defaultLabourRate}
                    </span>
                    <span className="font-black text-blue-600 text-[11px]">
                      £{calculateSectionLabour(section).toFixed(2)}
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
                  </div>
                )}
              </div>

              {/* Section Totals Summary */}
              <div className="pt-2 mt-2 border-t border-slate-100">
                <div className="grid grid-cols-3 gap-2">
                  {/* Materials Total */}
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-0.5 flex items-center gap-0.5">
                      <Package size={10} className="text-slate-500" /> Materials
                    </label>
                    <div className="bg-slate-100 rounded-lg px-2 py-1.5 text-center">
                      <span className="text-xs font-black text-slate-600">£{section.items.filter(i => !i.isHeading).reduce((s, i) => s + i.totalPrice, 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Labour Total */}
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-0.5 flex items-center gap-0.5">
                      <HardHat size={10} className="text-blue-500" /> Labour
                    </label>
                    <div className="bg-blue-50 rounded-lg px-2 py-1.5 text-center">
                      <span className="text-xs font-black text-blue-600">£{calculateSectionLabour(section).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Section Total (editable override) */}
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-0.5 flex items-center gap-0.5">
                      <PoundSterling size={10} className="text-emerald-500" /> Section
                    </label>
                    <div className="flex items-center bg-emerald-50 border-2 border-emerald-200 rounded-lg px-1 py-1.5 focus-within:border-emerald-400 transition-all">
                      <span className="text-emerald-600 text-[10px] font-bold mr-0.5">£</span>
                      <input
                        type="number"
                        className="bg-transparent border-none text-emerald-700 font-black text-[10px] outline-none w-full"
                        value={section.subsectionPrice !== undefined ? section.subsectionPrice : (section.items.filter(i => !i.isHeading).reduce((s, i) => s + i.totalPrice, 0) + calculateSectionLabour(section)).toFixed(2)}
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
                <p className="text-[8px] text-slate-400 text-center italic mt-1">Edit section total to override calculated value</p>
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
          <div className="h-10 w-10 bg-slate-900 text-teal-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"><FileText size={20} /></div>
          <div><h3 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-widest">Document Terms & Document-wide Rates</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Apply to all sections</p></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2 italic"><PoundSterling size={12} className="text-teal-500" /> Default Hourly Rate</label><input type="number" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 text-slate-950 font-black text-sm outline-none focus:border-teal-400 transition-all" value={formData.labourRate || ''} onChange={e => setFormData({...formData, labourRate: parseFloat(e.target.value) || 0})} placeholder="65.00" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-teal-600 uppercase tracking-widest px-1 flex items-center gap-2 italic"><Percent size={12} className="text-teal-500" /> Global Markup %</label><input type="number" className="w-full bg-teal-50 border-2 border-teal-100 rounded-xl p-3 text-teal-900 font-black text-sm outline-none focus:border-teal-400 transition-all" value={formData.markupPercent || ''} onChange={e => setFormData({...formData, markupPercent: parseFloat(e.target.value) || 0})} placeholder="15" /></div>
        </div>
        <div className="pt-2 space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2 italic"><FileText size={14} className="text-teal-500" /> Document Footer / Terms</label><textarea className="w-full bg-slate-50 border-2 border-slate-100 rounded-[20px] p-3 md:p-4 text-slate-900 font-medium text-sm outline-none focus:border-teal-400 transition-all min-h-[100px]" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Final notes, bank details etc..." /></div>
      </div>

      {/* Discount Section */}
      <div className="bg-white p-4 rounded-[24px] border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-emerald-500" />
            <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Discount</span>
          </div>
          {formData.discountValue ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-emerald-600 font-bold">
                -{formData.discountType === 'percentage' ? `${formData.discountValue}%` : `£${formData.discountValue.toFixed(2)}`}
                {formData.discountDescription && <span className="text-slate-400 ml-1">({formData.discountDescription})</span>}
              </span>
              <button
                onClick={() => setFormData(prev => ({ ...prev, discountType: undefined, discountValue: undefined, discountDescription: undefined }))}
                className="p-1 text-slate-300 hover:text-red-500 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDiscountModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
            >
              <Plus size={14} /> Add Discount
            </button>
          )}
        </div>
      </div>

      {/* Part Payment Section - Only for Invoices */}
      {formData.type === 'invoice' && (
        <div className="bg-white p-4 rounded-[24px] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Banknote size={16} className="text-blue-500" />
              <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Part Payment</span>
            </div>
            <div className="flex items-center gap-3">
              {formData.partPaymentEnabled && formData.partPaymentValue && (
                <span className="text-sm text-blue-600 font-bold">
                  {formData.partPaymentType === 'percentage'
                    ? `${formData.partPaymentValue}%`
                    : `£${formData.partPaymentValue.toFixed(2)}`}
                  {formData.partPaymentLabel && <span className="text-slate-400 ml-1">({formData.partPaymentLabel})</span>}
                </span>
              )}
              <button
                onClick={() => {
                  if (formData.partPaymentEnabled) {
                    setFormData(prev => ({
                      ...prev,
                      partPaymentEnabled: false,
                      partPaymentType: undefined,
                      partPaymentValue: undefined,
                      partPaymentLabel: undefined
                    }));
                  } else {
                    setShowPartPaymentModal(true);
                  }
                }}
                className={`w-14 h-8 rounded-full relative transition-all duration-300 ${
                  formData.partPaymentEnabled
                    ? 'bg-blue-500 shadow-lg shadow-blue-200'
                    : 'bg-slate-300'
                }`}
              >
                <div className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full shadow transition-transform duration-300 ${
                  formData.partPaymentEnabled ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Totals Summary */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 md:p-5 rounded-2xl shadow-xl border border-slate-700">
        <div className="flex justify-between items-center gap-4 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-400"></div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Document Total</span>
          </div>
          <span className="text-2xl md:text-3xl font-black tracking-tight">£{totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="space-y-1 text-[10px] font-medium">
          <div className="flex justify-between gap-4 py-1 border-b border-slate-700/50"><span className="text-slate-400">Materials</span><span className="text-slate-200">£{totals.materialsTotal.toFixed(2)}</span></div>
          <div className="flex justify-between gap-4 py-1 border-b border-slate-700/50"><span className="text-slate-400">Labour</span><span className="text-slate-200">£{totals.labourTotal.toFixed(2)}</span></div>
          <div className="flex justify-between gap-4 py-1 border-b border-slate-700/50"><span className="text-slate-400">Subtotal</span><span className="text-slate-200">£{totals.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between gap-4 py-1 border-b border-slate-700/50"><span className="text-teal-400">Markup</span><span className="text-teal-300">£{totals.markup.toFixed(2)}</span></div>
          {totals.discount > 0 && <div className="flex justify-between gap-4 py-1 border-b border-slate-700/50"><span className="text-emerald-400">Discount</span><span className="text-emerald-300">-£{totals.discount.toFixed(2)}</span></div>}
          {settings.enableVat && <div className="flex justify-between gap-4 py-1 border-b border-slate-700/50"><span className="text-blue-400">VAT</span><span className="text-blue-300">£{totals.tax.toFixed(2)}</span></div>}
          {settings.enableCis && <div className="flex justify-between gap-4 py-1"><span className="text-red-400">CIS</span><span className="text-red-300">-£{totals.cis.toFixed(2)}</span></div>}
        </div>
      </div>
      </div>

      {/* Sticky Totals Bar */}
      <div className="fixed bottom-[50px] md:bottom-0 left-0 right-0 bg-slate-900 text-white p-4 flex justify-between items-center shadow-2xl z-40 border-t border-slate-800">
        <div>
          <span className="text-[10px] text-slate-400 uppercase tracking-widest">Document Total</span>
          <p className="text-2xl font-black">£{totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <button
          onClick={() => {
            hapticSuccess();
            // If it's a new invoice, change status from 'draft' to 'sent'
            const quoteToSave = !existingQuote && formData.type === 'invoice' && formData.status === 'draft'
              ? { ...formData, status: 'sent' } as Quote
              : formData as Quote;
            onSave(quoteToSave);
          }}
          className="bg-teal-500 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-teal-400 transition-colors shadow-lg"
        >
          Save {formData.type}
        </button>
      </div>

      {/* Materials Library Modal */}
      {showMaterialsLibrary && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-black text-lg text-slate-900">Select from Price List</h3>
              <button
                onClick={() => setShowMaterialsLibrary(false)}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="overflow-auto max-h-[calc(85vh-60px)]">
              <MaterialsLibrary
                selectionMode={true}
                onSelectMaterial={(material) => {
                  if (targetSectionForMaterial) {
                    addMaterialFromLibrary(targetSectionForMaterial, material);
                  }
                }}
                onBack={() => setShowMaterialsLibrary(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Discount Modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-lg text-slate-900">Add Discount</h3>
              <button
                onClick={() => setShowDiscountModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Discount Type */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Discount Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, discountType: 'percentage' }))}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                      formData.discountType === 'percentage'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    <Percent size={16} className="inline mr-2" /> Percentage
                  </button>
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, discountType: 'fixed' }))}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                      formData.discountType === 'fixed'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    <PoundSterling size={16} className="inline mr-2" /> Fixed Amount
                  </button>
                </div>
              </div>

              {/* Discount Value */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  {formData.discountType === 'percentage' ? 'Percentage Off' : 'Amount Off (£)'}
                </label>
                <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-xl px-4 focus-within:border-emerald-400 transition-all">
                  {formData.discountType === 'fixed' && <span className="text-slate-400 font-bold mr-2">£</span>}
                  <input
                    type="number"
                    className="w-full bg-transparent py-4 outline-none text-slate-900 font-bold text-lg"
                    value={formData.discountValue || ''}
                    onChange={e => setFormData(prev => ({ ...prev, discountValue: parseFloat(e.target.value) || 0 }))}
                    placeholder={formData.discountType === 'percentage' ? '10' : '50.00'}
                  />
                  {formData.discountType === 'percentage' && <span className="text-slate-400 font-bold">%</span>}
                </div>
              </div>

              {/* Discount Description */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Reason (Optional)</label>
                <input
                  type="text"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 outline-none text-slate-900 font-medium focus:border-emerald-400 transition-all"
                  value={formData.discountDescription || ''}
                  onChange={e => setFormData(prev => ({ ...prev, discountDescription: e.target.value }))}
                  placeholder="e.g. Early payment, Returning customer"
                />
              </div>

              {/* Preview */}
              {formData.discountValue && formData.discountType && (
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                  <p className="text-sm text-emerald-700">
                    Discount: <span className="font-bold">-£{(formData.discountType === 'percentage' ? (totals.subtotal + totals.markup) * (formData.discountValue / 100) : formData.discountValue).toFixed(2)}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDiscountModal(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowDiscountModal(false)}
                disabled={!formData.discountValue || !formData.discountType}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                Apply Discount
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Part Payment Modal */}
      {showPartPaymentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-lg text-slate-900">Request Part Payment</h3>
              <button
                onClick={() => setShowPartPaymentModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Payment Type */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Payment Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, partPaymentType: 'percentage' }))}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                      formData.partPaymentType === 'percentage'
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    <Percent size={16} className="inline mr-2" /> Percentage
                  </button>
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, partPaymentType: 'fixed' }))}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                      formData.partPaymentType === 'fixed'
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    <PoundSterling size={16} className="inline mr-2" /> Fixed Amount
                  </button>
                </div>
              </div>

              {/* Payment Value */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  {formData.partPaymentType === 'percentage' ? 'Percentage Required' : 'Amount Required (£)'}
                </label>
                <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-xl px-4 focus-within:border-blue-400 transition-all">
                  {formData.partPaymentType === 'fixed' && <span className="text-slate-400 font-bold mr-2">£</span>}
                  <input
                    type="number"
                    className="w-full bg-transparent py-4 outline-none text-slate-900 font-bold text-lg"
                    value={formData.partPaymentValue || ''}
                    onChange={e => setFormData(prev => ({ ...prev, partPaymentValue: parseFloat(e.target.value) || 0 }))}
                    placeholder={formData.partPaymentType === 'percentage' ? '50' : '500.00'}
                  />
                  {formData.partPaymentType === 'percentage' && <span className="text-slate-400 font-bold">%</span>}
                </div>
              </div>

              {/* Payment Label */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Payment Label</label>
                <select
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 outline-none text-slate-900 font-medium focus:border-blue-400 transition-all"
                  value={formData.partPaymentLabel || ''}
                  onChange={e => setFormData(prev => ({ ...prev, partPaymentLabel: e.target.value }))}
                >
                  <option value="">Select a label...</option>
                  <option value="Deposit">Deposit</option>
                  <option value="Stage 1 Payment">Stage 1 Payment</option>
                  <option value="50% Upfront">50% Upfront</option>
                  <option value="First Fix Payment">First Fix Payment</option>
                </select>
              </div>

              {/* Custom Label Input */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Or Custom Label</label>
                <input
                  type="text"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 outline-none text-slate-900 font-medium focus:border-blue-400 transition-all"
                  value={formData.partPaymentLabel && !['Deposit', 'Stage 1 Payment', '50% Upfront', 'First Fix Payment'].includes(formData.partPaymentLabel) ? formData.partPaymentLabel : ''}
                  onChange={e => setFormData(prev => ({ ...prev, partPaymentLabel: e.target.value }))}
                  placeholder="e.g. Materials Deposit"
                />
              </div>

              {/* Preview */}
              {formData.partPaymentValue && formData.partPaymentType && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <p className="text-sm text-blue-700">
                    Amount Due Now: <span className="font-bold">
                      £{(formData.partPaymentType === 'percentage'
                        ? totals.total * (formData.partPaymentValue / 100)
                        : formData.partPaymentValue
                      ).toFixed(2)}
                    </span>
                    {formData.partPaymentLabel && (
                      <span className="text-blue-500 ml-1">({formData.partPaymentLabel})</span>
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPartPaymentModal(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setFormData(prev => ({ ...prev, partPaymentEnabled: true }));
                  setShowPartPaymentModal(false);
                }}
                disabled={!formData.partPaymentValue || !formData.partPaymentType || !formData.partPaymentLabel}
                className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
