
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Customer } from '../types';
import { 
  Search, UserPlus, Phone, Mail, MapPin, Trash2, Edit2, X, 
  AlertCircle, CheckCircle2, Mic, MicOff, Sparkles, Loader2, MapPinned,
  Building, User as UserIcon, Pencil, Navigation, LocateFixed
} from 'lucide-react';
import { parseCustomerVoiceInput, formatAddressAI, reverseGeocode } from '../src/services/geminiService';

interface CustomerManagerProps {
  customers: Customer[];
  setCustomers: (customers: Customer[]) => void;
}

export const CustomerManager: React.FC<CustomerManagerProps> = ({ customers, setCustomers }) => {
  // Explicitly type searchTerm as string to avoid unknown inference issues
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [customerForm, setCustomerForm] = useState<Partial<Customer>>({});
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  
  // Autocomplete
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [addressSearchTerm, setAddressSearchTerm] = useState('');

  const [isListeningGlobal, setIsListeningGlobal] = useState(false);
  const [activeFieldVoice, setActiveFieldVoice] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifyingAddress, setIsVerifyingAddress] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const isListeningGlobalRef = useRef(false);
  const activeFieldVoiceRef = useRef<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-GB';

      recognition.onend = () => {
        setIsListeningGlobal(false);
        setActiveFieldVoice(null);
        isListeningGlobalRef.current = false;
        activeFieldVoiceRef.current = null;
      };
      recognition.onerror = () => {
        setIsListeningGlobal(false);
        setActiveFieldVoice(null);
        isListeningGlobalRef.current = false;
        activeFieldVoiceRef.current = null;
      };

      recognition.onresult = async (event: any) => {
        if (!event.results?.[0]?.[0]?.transcript) return;
        const transcript = event.results[0][0].transcript;
        const wasGlobal = isListeningGlobalRef.current;
        const targetField = activeFieldVoiceRef.current;

        if (wasGlobal) {
          await handleParsedSpeech(transcript);
        } else if (targetField) {
          setCustomerForm(prev => ({ ...prev, [targetField]: transcript }));
        }
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

  const handleVerifyAddress = async () => {
    if (!customerForm.address) return;
    setIsVerifyingAddress(true);
    try {
      const formatted = await formatAddressAI(customerForm.address);
      setCustomerForm(prev => ({ ...prev, address: formatted }));
    } catch (err) {
      setError("Address verification failed.");
    } finally {
      setIsVerifyingAddress(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const address = await reverseGeocode(latitude, longitude);
          if (address) {
            setCustomerForm(prev => ({ ...prev, address }));
            setAddressSearchTerm(address);
          } else {
            setError("Could not determine address from your location.");
          }
        } catch (err) {
          setError("Failed to geocode your location.");
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        setError("Location access denied or unavailable.");
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForm.name?.trim()) {
      setError("Customer name is required.");
      return;
    }

    if (editingId === 'new') {
      const customer: Customer = {
        id: Math.random().toString(36).substr(2, 9),
        name: customerForm.name.trim(),
        email: customerForm.email || '',
        phone: customerForm.phone || '',
        address: customerForm.address || '',
        company: customerForm.company || '',
      };
      setCustomers([...customers, customer]);
      setShowSuccess("Contact Added Successfully!");
    } else if (editingId) {
      setCustomers(customers.map(c => c.id === editingId ? { ...c, ...customerForm } as Customer : c));
      setShowSuccess("Contact Updated!");
    }

    setCustomerForm({});
    setEditingId(null);
    setError(null);
    setTimeout(() => setShowSuccess(null), 3000);
  };

  const startEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setCustomerForm({ ...customer });
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteCustomer = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      setCustomers(customers.filter(c => c.id !== id));
      setShowSuccess("Contact Deleted");
      setTimeout(() => setShowSuccess(null), 3000);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.company && c.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Filtered addresses for autocomplete
  const filteredAddresses = useMemo(() => {
    if (!addressSearchTerm || addressSearchTerm.length < 2) return [];
    const search = addressSearchTerm.toLowerCase();
    // Explicitly type allAddresses as string[] to ensure toLowerCase exists on elements during filter
    const allAddresses = Array.from(new Set(customers.map(c => c.address).filter(Boolean))) as string[];
    return allAddresses.filter(addr => addr.toLowerCase().includes(search)).slice(0, 5);
  }, [customers, addressSearchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Customer Directory</h2>
          <p className="text-sm text-slate-500 font-medium italic">Manage your active site clients and project owners.</p>
        </div>
        <div className="flex items-center gap-3">
          {showSuccess && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-green-100 animate-in fade-in slide-in-from-right-4">
              <CheckCircle2 size={16} /> {showSuccess}
            </div>
          )}
          {!editingId && (
            <button 
              onClick={() => { setEditingId('new'); setCustomerForm({}); }} 
              className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
            >
              <UserPlus size={18} /> New Contact
            </button>
          )}
        </div>
      </div>

      {editingId ? (
        <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-xl animate-in fade-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-200">
                {editingId === 'new' ? <UserPlus size={24} /> : <Pencil size={24} />}
              </div>
              <div>
                <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight">
                  {editingId === 'new' ? 'Register New Client' : `Editing Client Record`}
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Update credentials and site information</p>
              </div>
            </div>
            
            <button 
              type="button"
              onClick={startGlobalListening} 
              disabled={isProcessing}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase transition-all border shadow-sm ${
                isListeningGlobal 
                  ? 'bg-red-500 text-white border-red-600 animate-pulse' 
                  : isProcessing
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-white text-amber-600 border-amber-100 hover:bg-amber-50'
              }`}
            >
              {isProcessing ? <Loader2 size={14} className="animate-spin" /> : isListeningGlobal ? <MicOff size={14} /> : <Sparkles size={14} />}
              {isProcessing ? 'Analyzing...' : isListeningGlobal ? 'Listening' : 'Magic Fill (Voice)'}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { id: 'name', label: 'Full Name *', icon: UserIcon, placeholder: 'e.g. John Smith' },
                { id: 'company', label: 'Company Name', icon: Building, placeholder: 'e.g. Smith & Co Roofing' },
                { id: 'email', label: 'Email Address', icon: Mail, placeholder: 'john@example.com' },
                { id: 'phone', label: 'Phone Number', icon: Phone, placeholder: '07123 456789' }
              ].map(field => (
                <div key={field.id} className="space-y-1">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 italic">
                      <field.icon size={12} /> {field.label}
                    </label>
                    <button 
                      type="button" 
                      onClick={() => startFieldListening(field.id)} 
                      className={`p-1.5 rounded-lg border transition-all ${activeFieldVoice === field.id ? 'bg-red-500 text-white' : 'text-slate-300 hover:text-amber-500 hover:border-amber-400 bg-white shadow-sm'}`}
                    >
                      <Mic size={14} />
                    </button>
                  </div>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-slate-950 font-bold text-sm outline-none focus:bg-white focus:border-amber-500 transition-all" 
                    value={(customerForm as any)[field.id] || ''} 
                    placeholder={field.placeholder} 
                    onChange={e => setCustomerForm({...customerForm, [field.id]: e.target.value})} 
                  />
                </div>
              ))}

              <div className="md:col-span-2 space-y-1 relative">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5 italic"><MapPin size={12} /> Main Site Address</label>
                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      onClick={() => startFieldListening('address')} 
                      className={`p-1.5 rounded-lg border transition-all ${activeFieldVoice === 'address' ? 'bg-red-500 text-white' : 'text-slate-300 hover:text-amber-500 hover:border-amber-400 bg-white shadow-sm'}`}
                    >
                      <Mic size={14} />
                    </button>
                    <button 
                      type="button" 
                      onClick={handleUseCurrentLocation}
                      disabled={isLocating}
                      className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-700 flex items-center gap-1 px-3 py-1 disabled:opacity-30"
                    >
                      {isLocating ? <Loader2 size={10} className="animate-spin" /> : <LocateFixed size={14} />}
                      Use Location
                    </button>
                    <button 
                      type="button" 
                      onClick={handleVerifyAddress} 
                      disabled={!customerForm.address || isVerifyingAddress} 
                      className="text-[10px] font-black uppercase text-amber-600 hover:text-amber-700 flex items-center gap-1 px-3 py-1 disabled:opacity-30"
                    >
                      {isVerifyingAddress ? <Loader2 size={10} className="animate-spin" /> : <MapPinned size={14} />}
                      AI Verify
                    </button>
                  </div>
                </div>
                <textarea 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-slate-950 font-bold text-sm outline-none min-h-[100px] focus:bg-white focus:border-amber-500 transition-all" 
                  placeholder="Street, Town, Postcode..." 
                  value={customerForm.address || ''} 
                  onChange={e => {
                    const val = e.target.value;
                    setCustomerForm({...customerForm, address: val});
                    setAddressSearchTerm(val);
                    setShowAddressSuggestions(true);
                  }} 
                  onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 200)}
                />
                {showAddressSuggestions && filteredAddresses.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-2 bg-white border-2 border-slate-100 rounded-[24px] shadow-2xl animate-in slide-in-from-top-2 overflow-hidden">
                    {filteredAddresses.map((addr, i) => (
                      <button 
                        key={i} 
                        type="button"
                        onClick={() => {
                          setCustomerForm(prev => ({ ...prev, address: addr }));
                          setShowAddressSuggestions(false);
                          setAddressSearchTerm('');
                        }}
                        className="w-full text-left p-4 hover:bg-amber-50 text-sm font-bold text-slate-900 border-b border-slate-50 last:border-0 flex items-center gap-3 transition-colors"
                      >
                        <MapPin size={14} className="text-amber-500" />
                        <span className="truncate">{addr}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100">
                <AlertCircle size={18} />
                <p className="text-xs font-bold uppercase tracking-widest">{error}</p>
              </div>
            )}

            <div className="flex gap-4 pt-4 border-t border-slate-50">
              <button type="submit" className="flex-1 bg-amber-500 text-white font-black py-5 rounded-[24px] hover:bg-amber-600 transition-all shadow-xl shadow-amber-200 uppercase tracking-widest text-xs">
                {editingId === 'new' ? 'Register Contact' : 'Update Credentials'}
              </button>
              <button type="button" onClick={() => { setEditingId(null); setError(null); }} className="px-12 bg-slate-50 text-slate-500 font-black py-5 rounded-[24px] hover:bg-slate-100 transition-all uppercase tracking-widest text-xs">Cancel</button>
            </div>
          </form>
        </div>
      ) : (
        <>
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Search directory by name, email or company..." 
              className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-900 focus:border-amber-200 outline-none shadow-sm transition-all" 
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
                <div key={customer.id} className="bg-white p-6 rounded-[32px] border-2 border-slate-100 hover:border-amber-500 transition-all group relative shadow-sm hover:shadow-xl hover:-translate-y-1">
                  <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => startEdit(customer)} 
                      className="p-2.5 bg-slate-900 text-amber-500 rounded-xl hover:bg-black transition-all shadow-md"
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
                  
                  <div className="h-12 w-12 bg-slate-900 text-amber-500 rounded-2xl flex items-center justify-center font-black text-lg mb-4 shadow-lg group-hover:scale-110 transition-transform">
                    {customer.name.charAt(0)}
                  </div>

                  <h3 className="font-black text-slate-950 text-xl leading-tight mb-1">{customer.name}</h3>
                  {customer.company && <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest italic">{customer.company}</p>}
                  
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
                        className="flex items-start gap-3 text-amber-600 hover:text-amber-700 text-xs font-bold italic group/link transition-colors"
                      >
                        <Navigation size={14} className="text-amber-500 shrink-0 mt-0.5 group-hover/link:animate-bounce" /> 
                        <span className="leading-relaxed hover:underline decoration-amber-500/30 underline-offset-2">{customer.address}</span>
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
