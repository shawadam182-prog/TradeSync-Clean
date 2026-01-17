import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Plus, CheckCircle2, ArrowRightCircle,
  Trash2, ClipboardList, ChevronDown, ChevronUp
} from 'lucide-react';
import { hapticTap, hapticSuccess } from '../src/hooks/useHaptic';

interface FutureJob {
  id: string;
  name: string;
  notes: string;
  createdAt: string;
  isCompleted: boolean;
}

interface FutureJobsPageProps {
  onBack: () => void;
  onCreateJob?: () => void;
}

export const FutureJobsPage: React.FC<FutureJobsPageProps> = ({
  onBack,
  onCreateJob
}) => {
  const [futureJobs, setFutureJobs] = useState<FutureJob[]>([]);
  const [newFutureJobName, setNewFutureJobName] = useState('');
  const [newFutureJobNotes, setNewFutureJobNotes] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('bq_future_jobs');
      if (saved) setFutureJobs(JSON.parse(saved));
    } catch (e) {
      console.error('Failed to load future jobs:', e);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('bq_future_jobs', JSON.stringify(futureJobs));
  }, [futureJobs]);

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
    hapticTap();
  };

  const deleteFutureJob = (id: string) => {
    setFutureJobs(prev => prev.filter(job => job.id !== id));
    hapticTap();
  };

  const convertToJobPack = (job: FutureJob) => {
    localStorage.setItem('bq_prefill_job', JSON.stringify({
      title: job.name,
      notepad: job.notes
    }));
    deleteFutureJob(job.id);
    onCreateJob?.();
  };

  const activeJobs = futureJobs.filter(j => !j.isCompleted);
  const completedJobs = futureJobs.filter(j => j.isCompleted);

  return (
    <div className="max-w-2xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => { hapticTap(); onBack(); }}
          className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <ArrowLeft size={24} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">Future Jobs</h1>
          <p className="text-sm text-slate-500">Manage your enquiries and upcoming work</p>
        </div>
      </div>

      {/* Add Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm mb-4">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Add New Enquiry</h3>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Customer / Job name..."
              className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl p-3 font-bold text-sm text-slate-900 outline-none focus:border-amber-400 transition-all placeholder:text-slate-300"
              value={newFutureJobName}
              onChange={e => setNewFutureJobName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addFutureJob()}
            />
            <button
              onClick={() => { hapticTap(); addFutureJob(); }}
              disabled={!newFutureJobName.trim()}
              className="px-4 bg-amber-500 text-white rounded-xl shadow-lg active:scale-95 transition-transform disabled:opacity-30 disabled:active:scale-100"
            >
              <Plus size={20} />
            </button>
          </div>
          {newFutureJobName && (
            <textarea
              placeholder="Notes (optional)..."
              className="bg-slate-50 border-2 border-slate-100 rounded-xl p-3 font-medium text-sm text-slate-900 outline-none focus:border-amber-400 transition-all placeholder:text-slate-300 resize-none min-h-[80px]"
              value={newFutureJobNotes}
              onChange={e => setNewFutureJobNotes(e.target.value)}
            />
          )}
        </div>
      </div>

      {/* Active Jobs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">
            Active Enquiries ({activeJobs.length})
          </h3>
        </div>

        {activeJobs.length === 0 ? (
          <div className="py-12 text-center opacity-40">
            <ClipboardList size={48} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No enquiries queued</p>
            <p className="text-xs text-slate-400 mt-1">Add enquiries as they come in</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeJobs.map(job => (
              <div
                key={job.id}
                className="bg-slate-50 rounded-xl p-4 border border-slate-100 group hover:border-amber-200 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 text-base">{job.name}</p>
                    {job.notes && (
                      <p className="text-sm text-slate-500 mt-1">{job.notes}</p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">
                      Added {new Date(job.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => convertToJobPack(job)}
                      className="p-2.5 bg-amber-100 text-amber-600 rounded-lg hover:bg-amber-200 transition-colors"
                      title="Convert to Job Pack"
                    >
                      <ArrowRightCircle size={18} />
                    </button>
                    <button
                      onClick={() => toggleFutureJobComplete(job.id)}
                      className="p-2.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                      title="Mark as done"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                    <button
                      onClick={() => deleteFutureJob(job.id)}
                      className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors md:opacity-0 md:group-hover:opacity-100"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Jobs */}
      {completedJobs.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center justify-between w-full"
          >
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Completed ({completedJobs.length})
            </h3>
            {showCompleted ? (
              <ChevronUp size={18} className="text-slate-400" />
            ) : (
              <ChevronDown size={18} className="text-slate-400" />
            )}
          </button>

          {showCompleted && (
            <div className="space-y-2 mt-4">
              {completedJobs.map(job => (
                <div
                  key={job.id}
                  className="flex items-center justify-between py-2 px-3 bg-slate-50/50 rounded-lg opacity-60 group"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-slate-500 line-through truncate block">{job.name}</span>
                    <span className="text-[9px] text-slate-400">
                      {new Date(job.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => toggleFutureJobComplete(job.id)}
                      className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Restore"
                    >
                      <CheckCircle2 size={16} />
                    </button>
                    <button
                      onClick={() => deleteFutureJob(job.id)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
