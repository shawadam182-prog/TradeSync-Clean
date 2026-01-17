
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ScheduleEntry, Customer, JobPack, Quote, AppSettings } from '../types';
import {
  Mic, Trash2, MapPin, Clock, Navigation,
  Bell, BellRing, Play, CheckCircle2,
  Calendar, ArrowRight, Sparkles, Timer,
  Loader2, MicOff, StickyNote, Eraser,
  Briefcase, FileText, Receipt, UserPlus,
  PoundSterling, FileWarning, AlertTriangle,
  ChevronDown, ChevronUp, BarChart3,
  TrendingUp, Camera, Eye, Phone, Plus,
  ClipboardList, ArrowRightCircle, X, FolderPlus
} from 'lucide-react';
import { parseReminderVoiceInput } from '../src/services/geminiService';
import { sitePhotosService } from '../src/services/dataService';
import { hapticTap, hapticSuccess } from '../src/hooks/useHaptic';
import { useToast } from '../src/contexts/ToastContext';
import { BusinessDashboard } from './BusinessDashboard';
import { FinancialOverview } from './FinancialOverview';

interface HomeProps {
  schedule: ScheduleEntry[];
  customers: Customer[];
  projects: JobPack[];
  quotes: Quote[];
  settings: AppSettings;
  onNavigateToSchedule: () => void;
  onNavigateToInvoices?: () => void;
  onNavigateToQuotes?: () => void;
  onNavigateToAccounting?: () => void;
  onCreateJob?: () => void;
  onCreateQuote?: () => void;
  onCreateInvoice?: () => void;
  onLogExpense?: () => void;
  onAddCustomer?: () => void;
  onTakePhoto?: (jobPackId?: string) => void;
  onViewJob?: (jobId: string) => void;
  onAddProject?: (project: Partial<JobPack>) => Promise<JobPack>;
  onRefresh?: () => Promise<void>;
  onNavigateToFutureJobs?: () => void;
}

interface Reminder {
  id: string;
  text: string;
  time: string;
  isCompleted: boolean;
  isAlarming?: boolean;
}

interface FutureJob {
  id: string;
  name: string;
  notes: string;
  createdAt: string;
  isCompleted: boolean;
}

export const Home: React.FC<HomeProps> = ({
  schedule,
  customers,
  projects,
  quotes,
  settings,
  onNavigateToSchedule,
  onNavigateToInvoices,
  onNavigateToQuotes,
  onNavigateToAccounting,
  onCreateJob,
  onCreateQuote,
  onCreateInvoice,
  onLogExpense,
  onAddCustomer,
  onTakePhoto,
  onViewJob,
  onAddProject,
  onRefresh,
  onNavigateToFutureJobs
}) => {
  const toast = useToast();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [quickNotes, setQuickNotes] = useState<string>('');
  const [futureJobs, setFutureJobs] = useState<FutureJob[]>([]);
  const [isListeningReminder, setIsListeningReminder] = useState(false);
  const [isListeningNote, setIsListeningNote] = useState(false);
  const [isProcessingReminder, setIsProcessingReminder] = useState(false);
  const [showPhotoJobPicker, setShowPhotoJobPicker] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<File | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [newJobName, setNewJobName] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [pendingNewJobName, setPendingNewJobName] = useState<string | null>(null);
  const [showDashboard, setShowDashboard] = useState<boolean>(() => {
    const saved = localStorage.getItem('bq_show_dashboard');
    return saved !== 'false'; // Default to true
  });

  const [newReminderText, setNewReminderText] = useState('');
  const [newReminderTime, setNewReminderTime] = useState('');
  const [newFutureJobName, setNewFutureJobName] = useState('');
  const [newFutureJobNotes, setNewFutureJobNotes] = useState('');

  const recognitionRef = useRef<any>(null);
  const noteRecognitionRef = useRef<any>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
    const savedReminders = localStorage.getItem('bq_home_reminders');
    const savedNotes = localStorage.getItem('bq_home_quick_notes');
    const savedFutureJobs = localStorage.getItem('bq_future_jobs');
    if (savedReminders) setReminders(JSON.parse(savedReminders));
    if (savedNotes) setQuickNotes(savedNotes);
    if (savedFutureJobs) setFutureJobs(JSON.parse(savedFutureJobs));
    } catch (e) { console.error("Failed to parse localStorage data:", e); }
  }, []);

  useEffect(() => {
    localStorage.setItem('bq_home_reminders', JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    localStorage.setItem('bq_home_quick_notes', quickNotes);
  }, [quickNotes]);

  useEffect(() => {
    localStorage.setItem('bq_future_jobs', JSON.stringify(futureJobs));
  }, [futureJobs]);

  useEffect(() => {
    localStorage.setItem('bq_show_dashboard', showDashboard.toString());
  }, [showDashboard]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentTimeStr = now.toTimeString().slice(0, 5); 
      
      setReminders(prev => prev.map(r => {
        if (!r.isCompleted && r.time === currentTimeStr && !r.isAlarming) {
          return { ...r, isAlarming: true };
        }
        return r;
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      // Setup for Reminders
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'en-GB';
      recognition.onstart = () => setIsListeningReminder(true);
      recognition.onend = () => setIsListeningReminder(false);
      recognition.onerror = () => setIsListeningReminder(false);
      recognition.onresult = async (event: any) => {
        if (event.results?.[0]?.[0]?.transcript) {
          handleVoiceReminder(event.results[0][0].transcript);
        }
      };
      recognitionRef.current = recognition;

      // Setup for Quick Notes
      const noteRecognition = new SpeechRecognition();
      noteRecognition.continuous = false;
      noteRecognition.lang = 'en-GB';
      noteRecognition.onstart = () => setIsListeningNote(true);
      noteRecognition.onend = () => setIsListeningNote(false);
      noteRecognition.onerror = () => setIsListeningNote(false);
      noteRecognition.onresult = (event: any) => {
        if (event.results?.[0]?.[0]?.transcript) {
          const transcript = event.results[0][0].transcript;
          setQuickNotes(prev => (prev ? `${prev}\n${transcript}` : transcript));
        }
      };
      noteRecognitionRef.current = noteRecognition;
    }
    return () => {
      recognitionRef.current?.abort();
      noteRecognitionRef.current?.abort();
    };
  }, []);

  const startVoiceReminder = () => {
    if (isListeningReminder) {
      recognitionRef.current?.stop();
      return;
    }
    try {
      recognitionRef.current?.start();
    } catch (e) {
      console.error("Mic start failed", e);
    }
  };

  const startVoiceNote = () => {
    if (isListeningNote) {
      noteRecognitionRef.current?.stop();
      return;
    }
    try {
      noteRecognitionRef.current?.start();
    } catch (e) {
      console.error("Note mic start failed", e);
    }
  };

  const handleVoiceReminder = async (transcript: string) => {
    setIsProcessingReminder(true);
    try {
      const parsed = await parseReminderVoiceInput(transcript);
      if (parsed.text && parsed.time) {
        const reminder: Reminder = {
          id: Math.random().toString(36).substr(2, 9),
          text: parsed.text,
          time: parsed.time,
          isCompleted: false
        };
        setReminders(prev => [...prev, reminder].sort((a, b) => a.time.localeCompare(b.time)));
      }
    } catch (err) {
      console.error("AI Reminder Error", err);
    } finally {
      setIsProcessingReminder(false);
    }
  };

  const addReminder = () => {
    if (!newReminderText || !newReminderTime) return;
    const reminder: Reminder = {
      id: Math.random().toString(36).substr(2, 9),
      text: newReminderText,
      time: newReminderTime,
      isCompleted: false
    };
    setReminders(prev => [...prev, reminder].sort((a, b) => a.time.localeCompare(b.time)));
    setNewReminderText('');
    setNewReminderTime('');
  };

  // Photo capture and upload handlers - NEW FLOW: Select job FIRST, then take photo

  // Step 1: Open the job picker modal
  const handleOpenPhotoPicker = () => {
    setShowPhotoJobPicker(true);
    setSelectedJobId(null);
    setPendingNewJobName(null);
    setNewJobName('');
  };

  // Step 2a: User selected an existing job - trigger camera
  const handleSelectJobForPhoto = (jobId: string) => {
    setSelectedJobId(jobId);
    setPendingNewJobName(null);
    setShowPhotoJobPicker(false);
    // Trigger camera after a small delay to let modal close
    setTimeout(() => {
      cameraInputRef.current?.click();
    }, 100);
  };

  // Step 2b: User wants to create new job - trigger camera
  const handleCreateJobForPhoto = () => {
    if (!newJobName.trim()) return;
    setPendingNewJobName(newJobName.trim());
    setSelectedJobId(null);
    setShowPhotoJobPicker(false);
    // Trigger camera after a small delay to let modal close
    setTimeout(() => {
      cameraInputRef.current?.click();
    }, 100);
  };

  // Step 3: Camera captured photo - upload to selected/new job
  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      // User cancelled camera - reset state
      setSelectedJobId(null);
      setPendingNewJobName(null);
      return;
    }

    const file = files[0];
    if (!file) {
      toast.error('Photo Error', 'Could not read photo file.');
      setSelectedJobId(null);
      setPendingNewJobName(null);
      return;
    }

    setIsUploadingPhoto(true);
    toast.success('Uploading...', 'Saving photo to job');

    try {
      let targetJobId = selectedJobId;

      // If creating a new job, do that first
      if (pendingNewJobName && onAddProject) {
        const newProject = await onAddProject({
          title: pendingNewJobName,
          status: 'active',
          notepad: '',
          notes: [],
          photos: [],
          drawings: [],
          documents: [],
          materials: [],
        });
        targetJobId = newProject.id;
      }

      if (!targetJobId) {
        toast.error('Error', 'No job selected for photo');
        return;
      }

      // Upload photo to the job
      await sitePhotosService.upload(
        targetJobId,
        file,
        'Site Photo',
        ['site'],
        false
      );

      if (onRefresh) {
        await onRefresh();
      }

      const jobTitle = pendingNewJobName || projects.find(p => p.id === targetJobId)?.title || 'job';
      toast.success('Photo Saved', `Added to "${jobTitle}"`);
      hapticSuccess();

    } catch (err: any) {
      console.error('Upload failed:', err);
      toast.error('Upload Failed', err.message || 'Could not save photo');
    } finally {
      setIsUploadingPhoto(false);
      setSelectedJobId(null);
      setPendingNewJobName(null);
      setNewJobName('');
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleCancelPhoto = () => {
    setShowPhotoJobPicker(false);
    setSelectedJobId(null);
    setPendingNewJobName(null);
    setNewJobName('');
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Future Jobs helpers
  const addFutureJob = () => {
    if (!newFutureJobName.trim()) return;
    const job: FutureJob = {
      id: Math.random().toString(36).substr(2, 9),
      name: newFutureJobName.trim(),
      notes: newFutureJobNotes.trim(),
      createdAt: new Date().toISOString(),
      isCompleted: false
    };
    setFutureJobs(prev => [job, ...prev]);
    setNewFutureJobName('');
    setNewFutureJobNotes('');
    hapticSuccess();
  };

  const toggleFutureJobComplete = (id: string) => {
    setFutureJobs(prev => prev.map(job =>
      job.id === id ? { ...job, isCompleted: !job.isCompleted } : job
    ));
  };

  const deleteFutureJob = (id: string) => {
    setFutureJobs(prev => prev.filter(job => job.id !== id));
  };

  const convertToJobPack = (job: FutureJob) => {
    // Store the job details temporarily for the job creation flow
    localStorage.setItem('bq_prefill_job', JSON.stringify({
      title: job.name,
      notepad: job.notes
    }));
    deleteFutureJob(job.id);
    onCreateJob?.();
  };

  // Calculate quote total helper
  const calculateQuoteTotal = (quote: Quote): number => {
    const sections = quote.sections || [];
    const materialsTotal = sections.reduce((sum, section) =>
      sum + (section.items || []).reduce((itemSum, item) => itemSum + (item.totalPrice || 0), 0), 0);
    const labourHoursTotal = sections.reduce((sum, section) => sum + (section.labourHours || 0), 0);
    const labourTotal = labourHoursTotal * (quote.labourRate || 0);
    const subtotal = materialsTotal + labourTotal;
    const markup = subtotal * ((quote.markupPercent || 0) / 100);
    const tax = (subtotal + markup) * ((quote.taxPercent || 0) / 100);
    return subtotal + markup + tax;
  };

  // Today's stats
  const todayStats = useMemo(() => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

    // Start of week (Monday)
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - diff);

    const jobsToday = schedule.filter(entry => {
      const start = new Date(entry.start);
      return start >= startOfToday && start < endOfToday;
    }).length;

    const weeklyRevenue = quotes
      .filter(q => q.type === 'invoice' && q.status === 'paid')
      .filter(q => {
        const updatedAt = new Date(q.updatedAt);
        return updatedAt >= startOfWeek && updatedAt <= today;
      })
      .reduce((sum, q) => sum + calculateQuoteTotal(q), 0);

    // Outstanding invoices (sent or accepted, not paid)
    const outstandingInvoicesList = quotes.filter(
      q => q.type === 'invoice' && q.status !== 'paid' && q.status !== 'draft'
    );
    const outstandingInvoices = outstandingInvoicesList.length;
    const outstandingTotal = outstandingInvoicesList.reduce((sum, q) => sum + calculateQuoteTotal(q), 0);

    // Overdue invoices (past due date)
    const overdueInvoicesList = outstandingInvoicesList.filter(invoice => {
      if (!invoice.dueDate) {
        // Fallback: consider overdue if sent > 14 days ago
        const invoiceDate = new Date(invoice.date);
        const dueDate = new Date(invoiceDate.getTime() + 14 * 24 * 60 * 60 * 1000);
        return today > dueDate;
      }
      return today > new Date(invoice.dueDate);
    });
    const overdueInvoices = overdueInvoicesList.length;
    const overdueTotal = overdueInvoicesList.reduce((sum, q) => sum + calculateQuoteTotal(q), 0);

    const pendingQuotes = quotes.filter(
      q => (q.type === 'estimate' || q.type === 'quotation') && q.status === 'sent'
    ).length;

    return {
      jobsToday,
      weeklyRevenue,
      outstandingInvoices,
      outstandingTotal,
      overdueInvoices,
      overdueTotal,
      pendingQuotes
    };
  }, [schedule, quotes]);

  // Week preview
  const weekPreview = useMemo(() => {
    const days: { date: Date; dayName: string; jobCount: number }[] = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const jobCount = schedule.filter(entry => {
        const start = new Date(entry.start);
        return start >= startOfDay && start < endOfDay;
      }).length;

      days.push({
        date,
        dayName: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-GB', { weekday: 'short' }),
        jobCount
      });
    }

    return days;
  }, [schedule]);

  // Alerts
  const alerts = useMemo(() => {
    const alertList: { id: string; type: string; title: string; description: string; severity: 'warning' | 'info' }[] = [];
    const now = new Date();

    // Overdue invoices (sent/accepted > 14 days old)
    quotes
      .filter(q => q.type === 'invoice' && (q.status === 'sent' || q.status === 'accepted'))
      .forEach(invoice => {
        const invoiceDate = new Date(invoice.date);
        const dueDate = new Date(invoiceDate.getTime() + 14 * 24 * 60 * 60 * 1000);
        if (now > dueDate) {
          const customer = customers.find(c => c.id === invoice.customerId);
          alertList.push({
            id: `overdue-${invoice.id}`,
            type: 'overdue',
            title: `Overdue: ${invoice.title}`,
            description: `${customer?.name || 'Unknown'} - Due ${dueDate.toLocaleDateString()}`,
            severity: 'warning'
          });
        }
      });

    // Pending quotes (sent > 7 days ago)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    quotes
      .filter(q => (q.type === 'estimate' || q.type === 'quotation') && q.status === 'sent')
      .filter(q => new Date(q.updatedAt) < sevenDaysAgo)
      .forEach(quote => {
        const customer = customers.find(c => c.id === quote.customerId);
        alertList.push({
          id: `pending-${quote.id}`,
          type: 'pending_quote',
          title: `Follow Up: ${quote.title}`,
          description: `Sent to ${customer?.name || 'Unknown'} - No response`,
          severity: 'info'
        });
      });

    // Upcoming jobs (within 24 hours)
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    schedule
      .filter(entry => {
        const start = new Date(entry.start);
        return start > now && start < tomorrow;
      })
      .forEach(job => {
        const customer = customers.find(c => c.id === job.customerId);
        alertList.push({
          id: `upcoming-${job.id}`,
          type: 'upcoming_job',
          title: job.title,
          description: `${new Date(job.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${customer?.name || 'Site visit'}`,
          severity: 'info'
        });
      });

    return alertList.slice(0, 5);
  }, [quotes, schedule, customers]);

  const nextJob = useMemo(() => {
    const now = new Date();
    return [...schedule]
      .filter(entry => new Date(entry.start) > now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];
  }, [schedule]);

  const nextJobCustomer = useMemo(() => 
    nextJob ? customers.find(c => c.id === nextJob.customerId) : null
  , [nextJob, customers]);

  const getTimeUntil = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - new Date().getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m until start`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m until start`;
  };

  return (
    <div className="space-y-4 md:space-y-8 pb-10 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 md:gap-4">
        <div>
          <h2 className="text-xl md:text-4xl font-black text-slate-900 tracking-tight">Daily Brief</h2>
          <p className="text-xs md:text-base text-slate-500 font-medium italic mt-0.5 md:mt-1">Ready for the site. Your immediate priorities at a glance.</p>
        </div>
        <div className="bg-white border-2 border-slate-100 rounded-xl md:rounded-2xl px-3 py-1.5 md:px-5 md:py-3 shadow-sm flex items-center gap-2 md:gap-3">
          <Clock size={14} className="md:w-5 md:h-5 text-amber-500" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className="font-black text-slate-900 text-sm md:text-lg">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-[10px] md:text-xs font-bold text-slate-500">
              {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS Section */}
      <div>
        <h3 className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest mb-2 md:mb-3 px-1">Quick Actions</h3>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:gap-3">
          <button
            onClick={() => { hapticTap(); onCreateJob?.(); }}
            className="flex flex-col items-center justify-center gap-1.5 md:gap-3 bg-blue-500 text-white p-2 sm:p-3 md:p-6 min-h-[64px] sm:min-h-[70px] md:min-h-[100px] rounded-2xl md:rounded-[28px] active:scale-95 transition-all shadow-lg md:shadow-xl shadow-blue-500/20 hover:shadow-2xl group"
          >
            <div className="p-2 md:p-3 bg-white/20 rounded-xl md:rounded-2xl group-active:scale-90 transition-transform">
              <Briefcase size={20} className="md:w-7 md:h-7" />
            </div>
            <span className="font-black text-[9px] sm:text-[10px] md:text-sm uppercase tracking-wide md:tracking-widest leading-none text-center">New Job</span>
          </button>
          <button
            onClick={() => { hapticTap(); onCreateQuote?.(); }}
            className="flex flex-col items-center justify-center gap-1.5 md:gap-3 bg-amber-500 text-white p-2 sm:p-3 md:p-6 min-h-[64px] sm:min-h-[70px] md:min-h-[100px] rounded-2xl md:rounded-[28px] active:scale-95 transition-all shadow-lg md:shadow-xl shadow-amber-500/20 hover:shadow-2xl group"
          >
            <div className="p-2 md:p-3 bg-white/20 rounded-xl md:rounded-2xl group-active:scale-90 transition-transform">
              <FileText size={20} className="md:w-7 md:h-7" />
            </div>
            <span className="font-black text-[9px] sm:text-[10px] md:text-sm uppercase tracking-wide md:tracking-widest leading-none text-center">Quote</span>
          </button>
          <button
            onClick={() => { hapticTap(); onCreateInvoice?.(); }}
            className="flex flex-col items-center justify-center gap-1.5 md:gap-3 bg-teal-500 text-white p-2 sm:p-3 md:p-6 min-h-[64px] sm:min-h-[70px] md:min-h-[100px] rounded-2xl md:rounded-[28px] active:scale-95 transition-all shadow-lg md:shadow-xl shadow-teal-500/20 hover:shadow-2xl group"
          >
            <div className="p-2 md:p-3 bg-white/20 rounded-xl md:rounded-2xl group-active:scale-90 transition-transform">
              <PoundSterling size={20} className="md:w-7 md:h-7" />
            </div>
            <span className="font-black text-[9px] sm:text-[10px] md:text-sm uppercase tracking-wide md:tracking-widest leading-none text-center">Invoice</span>
          </button>
          <button
            onClick={() => { hapticTap(); handleOpenPhotoPicker(); }}
            className="flex flex-col items-center justify-center gap-1.5 md:gap-3 bg-rose-500 text-white p-2 sm:p-3 md:p-6 min-h-[64px] sm:min-h-[70px] md:min-h-[100px] rounded-2xl md:rounded-[28px] active:scale-95 transition-all shadow-lg md:shadow-xl shadow-rose-500/20 hover:shadow-2xl group"
          >
            <div className="p-2 md:p-3 bg-white/20 rounded-xl md:rounded-2xl group-active:scale-90 transition-transform">
              <Camera size={20} className="md:w-7 md:h-7" />
            </div>
            <span className="font-black text-[9px] sm:text-[10px] md:text-sm uppercase tracking-wide md:tracking-widest leading-none text-center">Photo</span>
          </button>
          <button
            onClick={() => { hapticTap(); onLogExpense?.(); }}
            className="flex flex-col items-center justify-center gap-1.5 md:gap-3 bg-emerald-500 text-white p-2 sm:p-3 md:p-6 min-h-[64px] sm:min-h-[70px] md:min-h-[100px] rounded-2xl md:rounded-[28px] active:scale-95 transition-all shadow-lg md:shadow-xl shadow-emerald-500/20 hover:shadow-2xl group"
          >
            <div className="p-2 md:p-3 bg-white/20 rounded-xl md:rounded-2xl group-active:scale-90 transition-transform">
              <Receipt size={20} className="md:w-7 md:h-7" />
            </div>
            <span className="font-black text-[9px] sm:text-[10px] md:text-sm uppercase tracking-wide md:tracking-widest leading-none text-center">Expense</span>
          </button>
          <button
            onClick={() => { hapticTap(); onAddCustomer?.(); }}
            className="flex flex-col items-center justify-center gap-1.5 md:gap-3 bg-purple-500 text-white p-2 sm:p-3 md:p-6 min-h-[64px] sm:min-h-[70px] md:min-h-[100px] rounded-2xl md:rounded-[28px] active:scale-95 transition-all shadow-lg md:shadow-xl shadow-purple-500/20 hover:shadow-2xl group"
          >
            <div className="p-2 md:p-3 bg-white/20 rounded-xl md:rounded-2xl group-active:scale-90 transition-transform">
              <UserPlus size={20} className="md:w-7 md:h-7" />
            </div>
            <span className="font-black text-[9px] sm:text-[10px] md:text-sm uppercase tracking-wide md:tracking-widest leading-none text-center">Customer</span>
          </button>
        </div>
      </div>

      {/* Hidden camera input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraCapture}
        onClick={(e) => {
          // Reset value to ensure onChange fires even for same file
          (e.target as HTMLInputElement).value = '';
        }}
      />

      {/* Photo Job Picker Modal - Select job FIRST, then take photo */}
      {showPhotoJobPicker && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl md:rounded-[32px] p-4 md:p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-rose-500 flex items-center justify-center shrink-0">
                  <Camera size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-black text-slate-900">Take Photo</h3>
                  <p className="text-xs text-slate-500">Select a job first, then take photo</p>
                </div>
              </div>
              <button
                onClick={handleCancelPhoto}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {/* Create New Job Section */}
            <div className="mb-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Create New Job</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Job name..."
                  value={newJobName}
                  onChange={e => setNewJobName(e.target.value)}
                  className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl p-3 font-bold text-sm text-slate-900 outline-none focus:border-amber-400 transition-all placeholder:text-slate-300"
                />
                <button
                  onClick={handleCreateJobForPhoto}
                  disabled={!newJobName.trim()}
                  className="px-4 bg-amber-500 text-white rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-30 disabled:active:scale-100 flex items-center gap-2"
                >
                  <Camera size={18} />
                </button>
              </div>
            </div>

            {/* Existing Jobs List */}
            {projects.filter(p => p.status === 'active').length > 0 && (
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Add to Existing Job</p>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {projects.filter(p => p.status === 'active').map(project => (
                    <button
                      key={project.id}
                      onClick={() => handleSelectJobForPhoto(project.id)}
                      className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-left transition-colors flex items-center justify-between group"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">{project.title}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {customers.find(c => c.id === project.customerId)?.name || 'No customer'}
                        </p>
                      </div>
                      <div className="p-2 bg-slate-200 group-hover:bg-rose-500 group-hover:text-white rounded-lg transition-colors shrink-0 ml-2">
                        <Camera size={16} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Cancel Button */}
            <button
              onClick={handleCancelPhoto}
              className="w-full mt-4 p-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* TODAY'S SCHEDULE Section Header */}
      <div>
        <h3 className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest mb-2 md:mb-3 px-1">Today's Schedule</h3>

      {/* Today's Stats Card */}
      <div className="bg-white rounded-2xl md:rounded-[32px] border border-slate-200 p-3 md:p-6 shadow-sm mb-3 md:mb-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
          <div className="flex flex-col items-center justify-center gap-1 sm:gap-1.5 md:gap-3 p-2 sm:p-3 md:p-4 bg-blue-50 rounded-xl md:rounded-2xl text-center min-h-[80px]">
            <div className="p-1.5 md:p-3 bg-blue-500 text-white rounded-lg md:rounded-xl">
              <Calendar size={14} className="md:w-5 md:h-5" />
            </div>
            <p className="text-lg md:text-2xl font-black text-slate-900 leading-none">{todayStats.jobsToday}</p>
            <p className="text-[7px] sm:text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-wide leading-tight">Jobs Today</p>
          </div>
          <div className="flex flex-col items-center justify-center gap-1 sm:gap-1.5 md:gap-3 p-2 sm:p-3 md:p-4 bg-emerald-50 rounded-xl md:rounded-2xl text-center min-h-[80px]">
            <div className="p-1.5 md:p-3 bg-emerald-500 text-white rounded-lg md:rounded-xl">
              <PoundSterling size={14} className="md:w-5 md:h-5" />
            </div>
            <p className="text-sm sm:text-lg md:text-2xl font-black text-slate-900 leading-none truncate max-w-full">{todayStats.weeklyRevenue.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })}</p>
            <p className="text-[7px] sm:text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-wide leading-tight">This Week</p>
          </div>
          <div className="flex flex-col items-center justify-center gap-1 sm:gap-1.5 md:gap-3 p-2 sm:p-3 md:p-4 bg-amber-50 rounded-xl md:rounded-2xl text-center min-h-[80px]">
            <div className="p-1.5 md:p-3 bg-amber-500 text-white rounded-lg md:rounded-xl">
              <FileWarning size={14} className="md:w-5 md:h-5" />
            </div>
            <p className="text-lg md:text-2xl font-black text-slate-900 leading-none">{todayStats.outstandingInvoices}</p>
            <p className="text-[7px] sm:text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-wide leading-tight">Owed</p>
          </div>
          <div className="flex flex-col items-center justify-center gap-1 sm:gap-1.5 md:gap-3 p-2 sm:p-3 md:p-4 bg-purple-50 rounded-xl md:rounded-2xl text-center min-h-[80px]">
            <div className="p-1.5 md:p-3 bg-purple-500 text-white rounded-lg md:rounded-xl">
              <Clock size={14} className="md:w-5 md:h-5" />
            </div>
            <p className="text-lg md:text-2xl font-black text-slate-900 leading-none">{todayStats.pendingQuotes}</p>
            <p className="text-[7px] sm:text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-wide leading-tight">Pending</p>
          </div>
        </div>
      </div>

      <div className="relative group">
        {!nextJob ? (
          <div onClick={onNavigateToSchedule} className="bg-white border-4 border-dashed border-slate-100 rounded-2xl md:rounded-[48px] p-8 md:p-16 text-center cursor-pointer hover:border-amber-200 transition-all flex flex-col items-center">
            <Calendar size={40} className="md:w-[60px] md:h-[60px] text-slate-200 mb-2 md:mb-4" />
            <p className="text-slate-400 font-black uppercase tracking-widest text-xs md:text-base">No upcoming jobs found</p>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-2xl md:rounded-[48px] p-4 md:p-10 lg:p-12 text-white shadow-2xl overflow-hidden relative border-b-4 md:border-b-8 border-amber-600">
            <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 pointer-events-none">
              <Navigation size={200} />
            </div>
            
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 md:gap-10 relative z-10">
              <div className="space-y-3 md:space-y-6 flex-1">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="px-3 py-1 md:px-4 md:py-2 bg-amber-500 rounded-full text-slate-900 text-[9px] md:text-[10px] font-black uppercase tracking-widest animate-pulse">
                    Next Job
                  </div>
                  <div className="text-amber-500 font-black text-[10px] md:text-xs uppercase tracking-widest flex items-center gap-1 md:gap-2">
                    <Timer size={12} className="md:w-[14px] md:h-[14px]" /> {getTimeUntil(nextJob.start)}
                  </div>
                </div>

                <div className="space-y-1 md:space-y-2">
                  <h3 className="text-2xl md:text-4xl lg:text-5xl font-black tracking-tight leading-none">{nextJob.title}</h3>
                  <div className="flex items-center gap-3 md:gap-6">
                    <div className="flex items-center gap-1.5 md:gap-2 text-slate-400 font-bold text-sm md:text-lg italic">
                      <Clock size={16} className="md:w-5 md:h-5 text-amber-500" />
                      {new Date(nextJob.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(nextJob.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  {nextJobCustomer && (
                    <div className="flex items-center gap-3 bg-white/5 p-4 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors cursor-pointer">
                      <div className="w-10 h-10 bg-amber-500 rounded-2xl flex items-center justify-center text-slate-900 font-black">
                        {nextJobCustomer.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none">Client</p>
                        <p className="font-bold text-sm text-white mt-1">{nextJobCustomer.name}</p>
                      </div>
                    </div>
                  )}
                  
                  {nextJob.location && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nextJob.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-[200px] flex flex-col gap-2 bg-amber-500 p-5 rounded-3xl hover:bg-amber-400 transition-all text-slate-900 shadow-xl shadow-amber-500/20 group/nav"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-75">Navigate to Site</span>
                        <div className="h-8 w-8 bg-slate-900 rounded-xl flex items-center justify-center text-amber-500 shrink-0 group-hover/nav:scale-110 transition-transform">
                          <Navigation size={16} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <MapPin size={20} className="shrink-0" />
                        <span className="font-black text-sm truncate">{nextJob.location}</span>
                      </div>
                    </a>
                  )}
                </div>
              </div>

              <button
                onClick={() => { hapticTap(); onViewJob?.(nextJob.id); }}
                className="w-full md:w-auto h-auto md:h-64 bg-white/5 border border-white/10 rounded-[32px] p-8 flex flex-col justify-between hover:bg-white/10 transition-all group"
              >
                <div className="h-12 w-12 bg-amber-500 rounded-2xl flex items-center justify-center text-slate-900 group-hover:scale-110 transition-transform">
                  <Eye size={24} />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Job Details</p>
                  <p className="text-xl font-black text-white mt-1">View Job</p>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* FUTURE JOBS Section - Compact View */}
      <div>
        <div className="flex items-center justify-between mb-2 md:mb-3 px-1">
          <h3 className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest">Future Jobs</h3>
          {futureJobs.filter(j => !j.isCompleted).length > 0 && (
            <button
              onClick={() => { hapticTap(); onNavigateToFutureJobs?.(); }}
              className="text-[10px] md:text-xs font-bold text-amber-600 hover:text-amber-700 transition-colors"
            >
              See All ({futureJobs.filter(j => !j.isCompleted).length})
            </button>
          )}
        </div>
        <div className="bg-white rounded-2xl md:rounded-[32px] border border-slate-200 p-3 md:p-4 shadow-sm">
          {/* Quick Add Form */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="Add enquiry..."
              className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 font-bold text-sm text-slate-900 outline-none focus:border-amber-400 transition-all placeholder:text-slate-300"
              value={newFutureJobName}
              onChange={e => setNewFutureJobName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addFutureJob()}
            />
            <button
              onClick={() => { hapticTap(); addFutureJob(); }}
              disabled={!newFutureJobName.trim()}
              className="px-3 bg-amber-500 text-white rounded-xl shadow-lg active:scale-95 transition-transform disabled:opacity-30 disabled:active:scale-100"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Compact Jobs List - Show first 4 only */}
          {futureJobs.filter(j => !j.isCompleted).length === 0 ? (
            <div className="py-6 text-center opacity-40">
              <ClipboardList size={24} className="mx-auto text-slate-300 mb-1" />
              <p className="text-[9px] font-bold text-slate-400 uppercase">No enquiries queued</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {futureJobs.filter(j => !j.isCompleted).slice(0, 3).map(job => (
                <div
                  key={job.id}
                  className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 hover:border-amber-200 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate">{job.name}</p>
                    <p className="text-[9px] text-slate-400 font-medium">
                      {new Date(job.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <button
                    onClick={() => { hapticTap(); convertToJobPack(job); }}
                    className="p-1.5 bg-amber-100 text-amber-600 rounded-lg hover:bg-amber-200 transition-colors shrink-0"
                    title="Convert to Job Pack"
                  >
                    <ArrowRightCircle size={14} />
                  </button>
                </div>
              ))}
              {futureJobs.filter(j => !j.isCompleted).length > 3 && (
                <button
                  onClick={() => { hapticTap(); onNavigateToFutureJobs?.(); }}
                  className="w-full py-2 text-xs font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-all"
                >
                  +{futureJobs.filter(j => !j.isCompleted).length - 3} more
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Week Preview */}
      <div>
        <div className="bg-white rounded-xl md:rounded-[32px] border border-slate-200 p-3 md:p-6 shadow-sm">
          <h3 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-tight mb-2 md:mb-4">Week Ahead</h3>
          <div className="flex gap-1.5 md:gap-2 overflow-x-auto no-scrollbar pb-1">
            {weekPreview.map((day, idx) => (
              <button
                key={idx}
                onClick={onNavigateToSchedule}
                className={`flex-shrink-0 w-[52px] sm:w-14 md:w-16 p-1.5 sm:p-2 md:p-3 rounded-lg md:rounded-xl text-center transition-all ${
                  idx === 0 ? 'bg-amber-500 text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-900'
                }`}
              >
                <p className="text-[7px] sm:text-[8px] md:text-[9px] font-black uppercase truncate">{day.dayName}</p>
                <p className="text-base sm:text-lg md:text-xl font-black">{day.date.getDate()}</p>
                <div className={`text-[8px] sm:text-[9px] md:text-[10px] font-bold truncate ${day.jobCount > 0 ? '' : 'opacity-40'}`}>
                  {day.jobCount}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FINANCIAL SNAPSHOT Section */}
      <div>
        <h3 className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest mb-2 md:mb-3 px-1">Financial Snapshot</h3>

        {/* Revenue Overview with Period Selector */}
        <FinancialOverview quotes={quotes} settings={settings} />

        {/* Invoice Summary Card */}
        {(todayStats.outstandingInvoices > 0 || todayStats.overdueInvoices > 0) && (
          <div
            onClick={() => { hapticTap(); onNavigateToInvoices?.(); }}
            className="bg-white rounded-2xl md:rounded-[32px] border border-slate-200 p-4 md:p-6 shadow-sm mt-3 md:mt-4 cursor-pointer hover:shadow-lg transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className={`p-2 md:p-3 rounded-xl md:rounded-2xl ${todayStats.overdueInvoices > 0 ? 'bg-red-500' : 'bg-amber-500'} text-white`}>
                  {todayStats.overdueInvoices > 0 ? <AlertTriangle size={18} className="md:w-6 md:h-6" /> : <FileText size={18} className="md:w-6 md:h-6" />}
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm md:text-lg">Invoice Summary</h4>
                  <p className="text-[9px] md:text-xs text-slate-500 font-medium italic">
                    {todayStats.overdueInvoices > 0 ? 'Action required' : 'Awaiting payment'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-slate-400 group-hover:text-amber-500 transition-colors">
                <span className="text-xs font-bold hidden sm:inline">View All</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
              <div className="bg-amber-50 rounded-xl md:rounded-2xl p-2 sm:p-3 md:p-4">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                  <Clock size={12} className="sm:w-[14px] sm:h-[14px] md:w-4 md:h-4 text-amber-600 shrink-0" />
                  <span className="text-[8px] sm:text-[9px] md:text-[10px] font-black text-amber-600 uppercase truncate">Owed</span>
                </div>
                <p className="text-lg sm:text-xl md:text-3xl font-black text-slate-900 truncate">
                  {todayStats.outstandingTotal.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })}
                </p>
                <p className="text-[9px] sm:text-[10px] md:text-xs text-slate-500 font-bold mt-1 truncate">
                  {todayStats.outstandingInvoices} awaiting
                </p>
              </div>
              <div className={`rounded-xl md:rounded-2xl p-2 sm:p-3 md:p-4 ${todayStats.overdueInvoices > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                  <AlertTriangle size={12} className={`sm:w-[14px] sm:h-[14px] md:w-4 md:h-4 shrink-0 ${todayStats.overdueInvoices > 0 ? 'text-red-600' : 'text-slate-400'}`} />
                  <span className={`text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase truncate ${todayStats.overdueInvoices > 0 ? 'text-red-600' : 'text-slate-400'}`}>Overdue</span>
                </div>
                <p className={`text-lg sm:text-xl md:text-3xl font-black truncate ${todayStats.overdueInvoices > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                  {todayStats.overdueTotal.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })}
                </p>
                <p className={`text-[9px] sm:text-[10px] md:text-xs font-bold mt-1 truncate ${todayStats.overdueInvoices > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                  {todayStats.overdueInvoices > 0 ? `${todayStats.overdueInvoices} past due` : 'None'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-8">
        {/* Reminders Section */}
        <div className="bg-white rounded-2xl md:rounded-[40px] border border-slate-200 p-3 md:p-8 shadow-sm flex flex-col md:min-h-[500px]">
          <div className="flex items-center justify-between mb-2 md:mb-8">
            <div className="flex items-center gap-1.5 md:gap-3">
              <div className="p-1.5 md:p-4 bg-blue-50 text-blue-600 rounded-lg md:rounded-3xl">
                <Bell size={16} className="md:w-7 md:h-7" />
              </div>
              <div>
                <h3 className="text-sm md:text-2xl font-black text-slate-900 uppercase tracking-tight">Reminders</h3>
                <p className="text-[8px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest italic hidden sm:block">Time-sensitive site alarms</p>
              </div>
            </div>
            <button
              onClick={startVoiceReminder}
              disabled={isProcessingReminder}
              className={`h-10 w-10 md:h-16 md:w-16 rounded-lg md:rounded-[24px] flex items-center justify-center shadow-md md:shadow-2xl transition-all ${
                isListeningReminder
                  ? 'bg-red-500 text-white animate-pulse'
                  : isProcessingReminder
                    ? 'bg-amber-500 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isProcessingReminder ? <Loader2 size={16} className="md:w-6 md:h-6 animate-spin" /> : isListeningReminder ? <MicOff size={16} className="md:w-6 md:h-6" /> : <Mic size={16} className="md:w-6 md:h-6" />}
            </button>
          </div>

          <div className="flex flex-col gap-1.5 mb-2 md:mb-8">
            <div className="flex gap-1.5 md:gap-3">
              <input
                type="text"
                placeholder="What needs reminding?..."
                className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-lg md:rounded-[24px] p-2 md:p-4 min-h-[36px] md:min-h-[52px] font-bold text-sm md:text-base text-slate-900 outline-none focus:border-blue-400 transition-all"
                value={newReminderText}
                onChange={e => setNewReminderText(e.target.value)}
              />
              <button
                onClick={() => { hapticTap(); addReminder(); }}
                disabled={!newReminderText || !newReminderTime}
                className="bg-slate-900 text-white px-3 md:px-8 min-h-[36px] md:min-h-[52px] min-w-[50px] shrink-0 rounded-lg md:rounded-[24px] shadow-lg active:scale-95 transition-transform disabled:opacity-20 font-black uppercase text-[10px] md:text-xs tracking-widest"
              >
                Add
              </button>
            </div>
            <input
              type="time"
              className="w-full sm:w-auto sm:max-w-[140px] bg-slate-50 border-2 border-slate-100 rounded-lg md:rounded-[24px] p-2 md:p-4 min-h-[36px] md:min-h-[52px] font-bold text-sm md:text-base text-slate-900 outline-none focus:border-blue-400 transition-all cursor-pointer"
              value={newReminderTime}
              onChange={e => setNewReminderTime(e.target.value)}
            />
          </div>

          <div className="overflow-y-auto space-y-2 md:space-y-4 no-scrollbar pr-1">
            {reminders.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-slate-300 opacity-30 py-4 md:py-20">
                <BellRing size={32} className="md:w-16 md:h-16 mb-1 md:mb-4" />
                <p className="text-[10px] md:text-sm font-black uppercase tracking-widest">No active alarms</p>
              </div>
            ) : (
              reminders.map(reminder => (
                <div
                  key={reminder.id}
                  className={`p-3 md:p-6 rounded-xl md:rounded-[32px] border-2 transition-all flex items-center justify-between group ${
                    reminder.isAlarming
                      ? 'bg-amber-500 border-amber-600 text-slate-900 animate-pulse'
                      : reminder.isCompleted
                        ? 'bg-slate-50 border-transparent opacity-40'
                        : 'bg-white border-slate-100 hover:border-blue-200'
                  }`}
                >
                  <div className="flex items-center gap-3 md:gap-6 min-w-0">
                    <button
                      onClick={() => {
                        setReminders(prev => prev.map(r => r.id === reminder.id ? { ...r, isCompleted: !r.isCompleted, isAlarming: false } : r));
                      }}
                      className={`h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-[20px] flex items-center justify-center shrink-0 transition-all ${
                        reminder.isAlarming
                          ? 'bg-slate-900 text-white shadow-2xl'
                          : reminder.isCompleted ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-600'
                      }`}
                    >
                      {reminder.isCompleted ? <CheckCircle2 size={18} className="md:w-6 md:h-6" /> : reminder.isAlarming ? <BellRing size={18} className="md:w-6 md:h-6 animate-bounce" /> : <Play size={16} className="md:w-[22px] md:h-[22px]" />}
                    </button>
                    <div className="truncate">
                      <p className={`font-black text-sm md:text-lg truncate ${reminder.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        {reminder.text}
                      </p>
                      <p className={`text-[10px] md:text-[12px] font-black uppercase tracking-widest italic ${reminder.isAlarming ? 'text-slate-900' : 'text-slate-400'}`}>
                        {reminder.time}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setReminders(prev => prev.filter(r => r.id !== reminder.id))}
                    className={`p-2 md:p-3 transition-colors ${reminder.isAlarming ? 'text-slate-900' : 'text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100'}`}
                  >
                    <Trash2 size={18} className="md:w-6 md:h-6" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Notes Section */}
        <div className="bg-white rounded-2xl md:rounded-[40px] border border-slate-200 p-3 md:p-8 shadow-sm flex flex-col md:min-h-[500px]">
          <div className="flex items-center justify-between mb-2 md:mb-8">
            <div className="flex items-center gap-1.5 md:gap-3">
              <div className="p-1.5 md:p-4 bg-amber-50 text-amber-600 rounded-lg md:rounded-3xl">
                <StickyNote size={16} className="md:w-7 md:h-7" />
              </div>
              <div>
                <h3 className="text-sm md:text-2xl font-black text-slate-900 uppercase tracking-tight">Quick Notes</h3>
                <p className="text-[8px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest italic hidden sm:block">Daily site scratchpad</p>
              </div>
            </div>
            <div className="flex gap-1 md:gap-2">
              <button
                onClick={() => setQuickNotes('')}
                className="h-9 w-9 md:h-16 md:w-16 rounded-lg md:rounded-[24px] flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all shadow-sm"
                title="Clear Notes"
              >
                <Eraser size={16} className="md:w-6 md:h-6" />
              </button>
              <button
                onClick={startVoiceNote}
                className={`h-9 w-9 md:h-16 md:w-16 rounded-lg md:rounded-[24px] flex items-center justify-center shadow-md md:shadow-2xl transition-all ${
                  isListeningNote
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-amber-500 text-white hover:bg-amber-600'
                }`}
              >
                {isListeningNote ? <MicOff size={16} className="md:w-6 md:h-6" /> : <Mic size={16} className="md:w-6 md:h-6" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 md:gap-4">
            <textarea
              className="bg-slate-50 border-2 border-slate-100 rounded-lg md:rounded-[32px] p-3 md:p-8 font-medium text-slate-900 outline-none focus:border-amber-400 transition-all shadow-inner leading-relaxed text-sm md:text-lg resize-none placeholder:text-slate-300 placeholder:italic min-h-[120px] md:min-h-[300px]"
              placeholder="Jot down site measurements, material shortages, or general notes..."
              value={quickNotes}
              onChange={e => setQuickNotes(e.target.value)}
            />
            <div className="flex items-center gap-1 md:gap-2 px-1 md:px-2">
              <Sparkles size={10} className="md:w-[14px] md:h-[14px] text-amber-500" />
              <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Tap mic to dictate and append to your notes.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
