
import React, { useState, useRef, useEffect } from 'react';
import { Customer } from '../types';
import {
  Search, UserPlus, Phone, Mail, MapPin, Trash2, Edit2, X,
  AlertCircle, CheckCircle2, Mic, MicOff, Sparkles, Loader2,
  Building, User as UserIcon, Pencil, Navigation
} from 'lucide-react';
import { parseCustomerVoiceInput } from '../src/services/geminiService';
import { useToast } from '../src/contexts/ToastContext';
import { validateCustomerData } from '../src/utils/inputValidation';
import { hapticTap, hapticSuccess } from '../src/hooks/useHaptic';
import { AddressAutocomplete } from './AddressAutocomplete';
import { PageHeader } from './common/PageHeader';

interface CustomerManagerProps {
  customers: Customer[];
  addCustomer: (customer: Omit<Customer, 'id'>) => Promise<Customer>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
}

export const CustomerManager: React.FC<CustomerManagerProps> = ({ customers, addCustomer: addCustomerProp, updateCustomer: updateCustomerProp, deleteCustomer: deleteCustomerProp }) => {
  const toast = useToast();
  // Explicitly type searchTerm as string to avoid unknown inference issues
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [customerForm, setCustomerForm] = useState<Partial<Customer>>({});
  const [error, setError] = useState<string | null>(null);
  
  const [isListeningGlobal, setIsListeningGlobal] = useState(false);
  const [activeFieldVoice, setActiveFieldVoice] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const isListeningGlobalRef = useRef(false);
  const activeFieldVoiceRef = useRef<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const [interimTranscript, setInterimTranscript] = useState('');

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true; // Keep listening through pauses
      recognition.interimResults = true; // Show what's being heard
      recognition.lang = 'en-GB';
      recognition.maxAlternatives = 1;

      let finalTranscript = '';
      let silenceTimeout: NodeJS.Timeout | null = null;

      recognition.onend = () => {
        // Process final transcript when recognition ends
        if (finalTranscript && isListeningGlobalRef.current) {
          handleParsedSpeech(finalTranscript);
        }
        setIsListeningGlobal(false);
        setActiveFieldVoice(null);
        setInterimTranscript('');
        isListeningGlobalRef.current = false;
        activeFieldVoiceRef.current = null;
        finalTranscript = '';
        if (silenceTimeout) clearTimeout(silenceTimeout);
      };

      recognition.onerror = (e: any) => {
        // Ignore no-speech errors, they're normal
        if (e.error !== 'no-speech') {
          console.error('Speech recognition error:', e.error);
        }
        setIsListeningGlobal(false);
        setActiveFieldVoice(null);
        setInterimTranscript('');
        isListeningGlobalRef.current = false;
        activeFieldVoiceRef.current = null;
        if (silenceTimeout) clearTimeout(silenceTimeout);
      };

      recognition.onresult = (event: any) => {
        let interim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interim += transcript;
          }
        }

        // Show interim results to user
        setInterimTranscript(finalTranscript + interim);

        // For single field voice input (not magic fill), update immediately
        const targetField = activeFieldVoiceRef.current;
        if (targetField && !isListeningGlobalRef.current) {
          setCustomerForm(prev => ({ ...prev, [targetField]: (finalTranscript + interim).trim() }));
        }

        // Reset silence timeout - stop after 2 seconds of silence
        if (silenceTimeout) clearTimeout(silenceTimeout);
        silenceTimeout = setTimeout(() => {
          recognition.stop();
        }, 2000);
      };

      recognitionRef.current = recognition;
    }
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const handleParsedSpeech = async (transcript: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const details = await parseCustomerVoiceInput(transcript);
      const filtered = Object.fromEntries(
        Object.entries(details).filter(([_, v]) => v !== null && v !== "" && v !== undefined)
      );
      setCustomerForm(prev => ({ ...prev, ...filtered }));
    } catch (err) {
      setError("Magic fill failed to parse. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const startGlobalListening = () => {
    if (isListeningGlobal) {
      recognitionRef.current?.stop();
      return;
    }
    isListeningGlobalRef.current = true;
    activeFieldVoiceRef.current = null;
    setIsListeningGlobal(true);
    setActiveFieldVoice(null);
    try { recognitionRef.current?.start(); } catch (e) {
      setIsListeningGlobal(false);
      isListeningGlobalRef.current = false;
    }
  };

  const startFieldListening = (fieldName: string) => {
    isListeningGlobalRef.current = false;
    activeFieldVoiceRef.current = fieldName;
    setIsListeningGlobal(false);
    setActiveFieldVoice(fieldName);
    try { recognitionRef.current?.start(); } catch (e) {
      setActiveFieldVoice(null);
      activeFieldVoiceRef.current = null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate and sanitize input
    const validation = validateCustomerData(customerForm);
    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      setError(firstError);
      return;
    }

    try {
      if (editingId === 'new') {
        await addCustomerProp({
          name: validation.sanitized.name,
          email: validation.sanitized.email,
          phone: validation.sanitized.phone,
          address: validation.sanitized.address,
          company: validation.sanitized.company || '',
        });
        toast.success('Contact Added', `${validation.sanitized.name} added to directory`);
      } else if (editingId) {
        await updateCustomerProp(editingId, {
          name: validation.sanitized.name,
          email: validation.sanitized.email,
          phone: validation.sanitized.phone,
          address: validation.sanitized.address,
          company: validation.sanitized.company || '',
        });
        toast.success('Contact Updated', 'Changes saved successfully');
      }

      setCustomerForm({});
      setEditingId(null);
      setError(null);
    } catch (error) {
      console.error('Failed to save customer:', error);
      toast.error('Save Failed', 'Could not save customer');
    }
  };

  const startEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setCustomerForm({ ...customer });
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteCustomer = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      try {
        await deleteCustomerProp(id);
        toast.success('Contact Deleted', `${name} removed from directory`);
      } catch (error) {
        console.error('Failed to delete customer:', error);
        toast.error('Delete Failed', `Could not remove ${name}`);
      }
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.company && c.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {!editingId && (
        <PageHeader
          title="Customer Directory"
          subtitle="Manage your active site clients and project owners."
          actions={
            <button
              onClick={() => { hapticTap(); setEditingId('new'); setCustomerForm({}); }}
              className="bg-slate-900 text-white px-5 py-3 min-h-[48px] rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 shadow-lg shadow-slate-200 active:scale-95"
            >
              <UserPlus size={20} />
              <span className="hidden sm:inline">New Contact</span>
              <span className="sm:hidden">Add</span>
            </button>
          }
        />
      )}

      {editingId ? (
        <>
          <div className="bg-white p-3 sm:p-4 md:p-8 rounded-xl sm:rounded-2xl md:rounded-3xl border border-slate-200 shadow-xl animate-in fade-in slide-in-from-bottom-4 pb-28 md:pb-8">
            <div className="flex justify-between items-center mb-3 sm:mb-4 md:mb-8">
              <h3 className="font-black text-sm md:text-xl text-slate-900 uppercase tracking-tight">
                {editingId === 'new' ? 'Register Client' : `Edit Client`}
              </h3>
              <button
                type="button"
                onClick={startGlobalListening}
                disabled={isProcessing}
                className={`flex items-center gap-1 px-3 py-1.5 md:px-6 md:py-3 rounded-xl font-black text-[9px] md:text-[10px] uppercase transition-all border ${
                  isListeningGlobal
                    ? 'bg-red-500 text-white border-red-600 animate-pulse'
                    : isProcessing
                    ? 'bg-teal-500 text-white border-teal-600'
                    : 'bg-white text-teal-600 border-teal-100 hover:bg-teal-50'
                }`}
              >
                {isProcessing ? <Loader2 size={10} className="md:w-3 md:h-3 animate-spin" /> : isListeningGlobal ? <MicOff size={10} className="md:w-3 md:h-3" /> : <Sparkles size={10} className="md:w-3 md:h-3" />}
                <span className="hidden sm:inline">{isProcessing ? 'Analyzing...' : isListeningGlobal ? 'Stop' : 'Voice'}</span>
              </button>
            </div>

          {/* Live transcript display */}
          {(isListeningGlobal || interimTranscript) && (
            <div className="bg-slate-800 rounded-lg p-2 md:p-4 border border-slate-700 mb-2 md:mb-4">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${isListeningGlobal ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                <p className="text-white text-xs flex-1 truncate">
                  {interimTranscript || 'Speak now...'}
                </p>
              </div>
            </div>
          )}

          <form id="customer-form" onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 md:gap-6">
              {/* Name Field */}
              <div className="space-y-0.5 sm:space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1 px-0.5">
                  <UserIcon size={12} className="md:w-3 md:h-3" /> Full Name *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    autoComplete="name"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-lg sm:rounded-xl px-3 py-2 sm:py-2.5 md:px-4 md:py-3 pr-10 md:pr-12 text-slate-950 font-bold text-sm outline-none focus:bg-white focus:border-teal-500 transition-all"
                    value={customerForm.name || ''}
                    placeholder="e.g. John Smith"
                    onChange={e => setCustomerForm({...customerForm, name: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => { hapticTap(); startFieldListening('name'); }}
                    className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 md:p-2 rounded-lg transition-all ${activeFieldVoice === 'name' ? 'bg-red-500 text-white' : 'text-slate-300 hover:text-teal-500 bg-transparent'}`}
                  >
                    <Mic size={14} className="md:w-[18px] md:h-[18px]" />
                  </button>
                </div>
              </div>

              {/* Company Field */}
              <div className="space-y-0.5">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1 px-0.5">
                  <Hammer size={12} className="md:w-3 md:h-3" /> Company Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    autoComplete="organization"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-1.5 md:px-4 md:py-4 pr-10 md:pr-12 text-slate-950 font-bold text-sm md:text-base outline-none focus:bg-white focus:border-teal-500 transition-all"
                    value={customerForm.company || ''}
                    placeholder="e.g. Smith & Co Roofing"
                    onChange={e => setCustomerForm({...customerForm, company: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => { hapticTap(); startFieldListening('company'); }}
                    className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 md:p-2 rounded-lg transition-all ${activeFieldVoice === 'company' ? 'bg-red-500 text-white' : 'text-slate-300 hover:text-teal-500 bg-transparent'}`}
                  >
                    <Mic size={14} className="md:w-[18px] md:h-[18px]" />
                  </button>
                </div>
              </div>

              {/* Email Field - with proper type for mobile keyboard */}
              <div className="space-y-0.5">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1 px-0.5">
                  <Mail size={12} className="md:w-3 md:h-3" /> Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-1.5 md:px-4 md:py-4 pr-10 md:pr-12 text-slate-950 font-bold text-sm md:text-base outline-none focus:bg-white focus:border-teal-500 transition-all"
                    value={customerForm.email || ''}
                    placeholder="john@example.com"
                    onChange={e => setCustomerForm({...customerForm, email: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => { hapticTap(); startFieldListening('email'); }}
                    className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 md:p-2 rounded-lg transition-all ${activeFieldVoice === 'email' ? 'bg-red-500 text-white' : 'text-slate-300 hover:text-teal-500 bg-transparent'}`}
                  >
                    <Mic size={14} className="md:w-[18px] md:h-[18px]" />
                  </button>
                </div>
              </div>

              {/* Phone Field - with proper type for mobile keyboard */}
              <div className="space-y-0.5">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1 px-0.5">
                  <Phone size={12} className="md:w-3 md:h-3" /> Phone Number
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-1.5 md:px-4 md:py-4 pr-10 md:pr-12 text-slate-950 font-bold text-sm md:text-base outline-none focus:bg-white focus:border-teal-500 transition-all"
                    value={customerForm.phone || ''}
                    placeholder="07123 456789"
                    onChange={e => setCustomerForm({...customerForm, phone: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => { hapticTap(); startFieldListening('phone'); }}
                    className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 md:p-2 rounded-lg transition-all ${activeFieldVoice === 'phone' ? 'bg-red-500 text-white' : 'text-slate-300 hover:text-teal-500 bg-transparent'}`}
                  >
                    <Mic size={14} className="md:w-[18px] md:h-[18px]" />
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <AddressAutocomplete
                  value={customerForm.address || ''}
                  onChange={(address) => setCustomerForm(prev => ({ ...prev, address }))}
                  placeholder="Start typing address or postcode..."
                  onVoiceStart={() => startFieldListening('address')}
                  onVoiceEnd={() => recognitionRef.current?.stop()}
                  isListening={activeFieldVoice === 'address'}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100">
                <AlertCircle size={18} />
                <p className="text-xs font-bold uppercase tracking-widest">{error}</p>
              </div>
            )}

            {/* Desktop buttons */}
            <div className="hidden md:flex gap-4 pt-4 border-t border-slate-50">
              <button type="submit" className="flex-1 bg-teal-500 text-white font-black py-5 rounded-[24px] hover:bg-teal-600 transition-all shadow-xl shadow-teal-200 uppercase tracking-widest text-xs">
                {editingId === 'new' ? 'Register Contact' : 'Update Credentials'}
              </button>
              <button type="button" onClick={() => { setEditingId(null); setError(null); }} className="px-12 bg-slate-50 text-slate-500 font-black py-5 rounded-[24px] hover:bg-slate-100 transition-all uppercase tracking-widest text-xs">Cancel</button>
            </div>
          </form>
        </div>

        {/* Mobile sticky buttons - OUTSIDE container for proper fixed positioning */}
        <div className="md:hidden fixed bottom-[60px] left-0 right-0 px-2 py-2 bg-gradient-to-t from-white via-white to-transparent z-[200]">
          <div className="flex gap-1.5">
            <button
              form="customer-form"
              type="submit"
              onClick={() => hapticTap()}
              className="flex-1 bg-teal-500 text-white font-black min-h-[44px] rounded-xl shadow-lg shadow-teal-200/50 uppercase tracking-wider text-[10px] active:scale-95 transition-transform"
            >
              {editingId === 'new' ? 'Register' : 'Update'}
            </button>
            <button
              type="button"
              onClick={() => { hapticTap(); setEditingId(null); setError(null); }}
              className="px-4 bg-slate-100 text-slate-500 font-black min-h-[44px] rounded-xl uppercase tracking-wider text-[10px] active:scale-95 transition-transform"
            >
              Cancel
            </button>
          </div>
        </div>
      </>
      ) : (
        <>
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="search"
              inputMode="search"
              placeholder="Search by name, email or company..."
              className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 min-h-[52px] font-bold text-base text-slate-900 focus:border-teal-200 outline-none shadow-sm transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCustomers.length === 0 ? (
              <div className="col-span-full py-24 text-center bg-white rounded-[32px] border-4 border-dashed border-slate-100 opacity-60">
                <UserIcon size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-400 font-black uppercase tracking-widest text-sm italic">No contacts found.</p>
              </div>
            ) : (
              filteredCustomers.map(customer => (
                <div key={customer.id} className="bg-white p-6 rounded-[32px] border-2 border-slate-100 hover:border-teal-500 transition-all group relative shadow-sm hover:shadow-xl hover:-translate-y-1">
                  <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => startEdit(customer)} 
                      className="p-2.5 bg-slate-900 text-teal-500 rounded-xl hover:bg-black transition-all shadow-md"
                      title="Edit Contact"
                    >
                      <Pencil size={16} />
                    </button>
                    <button 
                      onClick={() => deleteCustomer(customer.id, customer.name)} 
                      className="p-2.5 bg-white border border-slate-100 text-slate-300 hover:text-red-500 rounded-xl transition-all shadow-sm"
                      title="Delete Contact"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <div className="h-12 w-12 bg-slate-900 text-teal-500 rounded-2xl flex items-center justify-center font-black text-lg mb-4 shadow-lg group-hover:scale-110 transition-transform">
                    {customer.name.charAt(0)}
                  </div>

                  <h3 className="font-black text-slate-950 text-xl leading-tight mb-1">{customer.name}</h3>
                  {customer.company && <p className="text-xs font-black text-teal-600 uppercase tracking-widest italic">{customer.company}</p>}
                  
                  <div className="space-y-3 pt-6 mt-6 border-t border-slate-50">
                    <div className="flex items-center gap-3 text-slate-500 text-xs font-bold italic">
                      <Mail size={14} className="text-slate-300 shrink-0" /> 
                      <span className="truncate">{customer.email || 'No Email'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 text-xs font-bold italic">
                      <Phone size={14} className="text-slate-300 shrink-0" /> 
                      {customer.phone || 'No Phone'}
                    </div>
                    {customer.address ? (
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 text-teal-600 hover:text-teal-700 text-xs font-bold italic group/link transition-colors"
                      >
                        <Navigation size={14} className="text-teal-500 shrink-0 mt-0.5 group-hover/link:animate-bounce" />
                        <span className="leading-relaxed hover:underline decoration-teal-500/30 underline-offset-2">{customer.address}</span>
                      </a>
                    ) : (
                      <div className="flex items-start gap-3 text-slate-400 text-xs font-bold italic">
                        <MapPin size={14} className="text-slate-300 shrink-0 mt-0.5" /> 
                        <span className="leading-relaxed">No Address Logged</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};
