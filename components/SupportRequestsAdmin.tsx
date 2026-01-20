import React, { useState, useEffect } from 'react';
import { supabase } from '../src/lib/supabase';
import { useAuth } from '../src/contexts/AuthContext';
import { isAdminUser } from '../src/lib/constants';
import { useToast } from '../src/contexts/ToastContext';
import { handleApiError } from '../src/utils/errorHandler';
import {
  MessageSquare, AlertCircle, Loader2, ChevronDown, ChevronUp,
  User, Mail, Building2, Clock, CheckCircle, XCircle,
  RefreshCw, Filter, Search, MessageCircle, ArrowLeft
} from 'lucide-react';

type SupportStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

interface SupportRequest {
  id: string;
  user_id: string;
  title: string;
  message: string;
  status: SupportStatus;
  admin_notes: string | null;
  user_email: string | null;
  user_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  resolved_at: string | null;
}

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-amber-100 text-amber-700', icon: MessageSquare },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  closed: { label: 'Closed', color: 'bg-slate-100 text-slate-600', icon: XCircle }
};

export const SupportRequestsAdmin: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  // Check if current user is admin
  if (!isAdminUser(user?.id)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <p className="text-lg font-bold">Access Denied</p>
        <p className="text-sm mt-2">You don't have permission to view this page.</p>
        {onBack && (
          <button onClick={onBack} className="mt-4 bg-slate-900 text-white px-4 py-2 rounded-lg font-bold">
            Go Back
          </button>
        )}
      </div>
    );
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);
    try {
      // Admin can see all requests via RLS policy
      const { data, error } = await supabase
        .from('support_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Cast status to our union type
      const typedData: SupportRequest[] = (data || []).map(req => ({
        ...req,
        status: req.status as SupportStatus
      }));
      setRequests(typedData);

      // Initialize admin notes
      const notes: Record<string, string> = {};
      typedData.forEach(req => {
        notes[req.id] = req.admin_notes || '';
      });
      setAdminNotes(notes);
    } catch (err: any) {
      console.error('Failed to load support requests:', err);
      toast.error('Load Failed', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(id: string, newStatus: SupportRequest['status']) {
    setUpdatingStatus(id);
    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('support_requests')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast.success('Status Updated', `Request marked as ${STATUS_CONFIG[newStatus].label}`);
      loadRequests();
    } catch (err: any) {
      const { message } = handleApiError(err);
      toast.error('Update Failed', message);
    } finally {
      setUpdatingStatus(null);
    }
  }

  async function handleSaveNotes(id: string) {
    setUpdatingStatus(id);
    try {
      const { error } = await supabase
        .from('support_requests')
        .update({
          admin_notes: adminNotes[id] || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Notes Saved', 'Admin notes have been updated');
    } catch (err: any) {
      const { message } = handleApiError(err);
      toast.error('Save Failed', message);
    } finally {
      setUpdatingStatus(null);
    }
  }

  // Filter and search
  const filteredRequests = requests.filter(req => {
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    const matchesSearch = searchQuery === '' ||
      req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.user_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Stats
  const stats = {
    total: requests.length,
    open: requests.filter(r => r.status === 'open').length,
    inProgress: requests.filter(r => r.status === 'in_progress').length,
    resolved: requests.filter(r => r.status === 'resolved').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-black text-slate-900">Support Requests</h1>
            <p className="text-sm text-slate-500 mt-1">Manage user support tickets and feedback</p>
          </div>
        </div>
        <button
          onClick={loadRequests}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-teal-600 hover:bg-slate-100 rounded-xl font-bold transition-colors"
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-amber-200 bg-amber-50">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Open</p>
          <p className="text-2xl font-black text-amber-700 mt-1">{stats.open}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-blue-200 bg-blue-50">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">In Progress</p>
          <p className="text-2xl font-black text-blue-700 mt-1">{stats.inProgress}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-emerald-200 bg-emerald-50">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Resolved</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{stats.resolved}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hidden sm:block" />
          <input
            type="text"
            placeholder="Search requests..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-4 sm:pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-slate-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
            <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
            <p className="font-bold">No support requests found</p>
            <p className="text-sm mt-1">
              {searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Users haven\'t submitted any requests yet'}
            </p>
          </div>
        ) : (
          filteredRequests.map((req) => {
            const StatusIcon = STATUS_CONFIG[req.status].icon;
            const isExpanded = expandedRow === req.id;

            return (
              <div key={req.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Main Row */}
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpandedRow(isExpanded ? null : req.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_CONFIG[req.status].color}`}>
                        {STATUS_CONFIG[req.status].label}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {req.created_at ? `${new Date(req.created_at).toLocaleDateString()} at ${new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Unknown date'}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 truncate">{req.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      {req.user_name && (
                        <span className="flex items-center gap-1">
                          <Building2 size={12} />
                          {req.user_name}
                        </span>
                      )}
                      {req.user_email && (
                        <span className="flex items-center gap-1">
                          <Mail size={12} />
                          {req.user_email}
                        </span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-200 p-4 bg-slate-50 space-y-4">
                    {/* Message */}
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">User Message</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{req.message}</p>
                    </div>

                    {/* Status Update */}
                    <div className="flex flex-wrap gap-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-full mb-1">Update Status</p>
                      {(['open', 'in_progress', 'resolved', 'closed'] as const).map(status => (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(req.id, status)}
                          disabled={updatingStatus === req.id || req.status === status}
                          className={`px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${
                            req.status === status
                              ? STATUS_CONFIG[status].color + ' ring-2 ring-offset-1 ring-slate-300'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {updatingStatus === req.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            STATUS_CONFIG[status].label
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Admin Notes */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin Notes (Internal)</p>
                      <textarea
                        className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 min-h-[100px]"
                        value={adminNotes[req.id] || ''}
                        onChange={e => setAdminNotes({ ...adminNotes, [req.id]: e.target.value })}
                        placeholder="Add internal notes about this request..."
                      />
                      <button
                        onClick={() => handleSaveNotes(req.id)}
                        disabled={updatingStatus === req.id}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-black transition-colors disabled:opacity-50"
                      >
                        {updatingStatus === req.id ? <Loader2 size={14} className="animate-spin" /> : 'Save Notes'}
                      </button>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap gap-4 text-[10px] text-slate-400 pt-2 border-t border-slate-200">
                      <span>User ID: {req.user_id.slice(0, 8)}...</span>
                      <span>Request ID: {req.id.slice(0, 8)}...</span>
                      {req.resolved_at && (
                        <span>Resolved: {new Date(req.resolved_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SupportRequestsAdmin;
