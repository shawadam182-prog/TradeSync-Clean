import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Users,
  Activity,
  TrendingUp,
  Clock,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Calendar,
  MousePointer,
  Layout,
  Smartphone,
  Monitor,
  Tablet,
} from 'lucide-react';
import {
  adminAnalyticsService,
  TrialUserAnalytics,
  AnalyticsSummary,
  UserActivityLog,
  UserSession,
} from '../src/services/adminAnalyticsService';

interface TrialUsersAdminProps {
  onBack: () => void;
}

export const TrialUsersAdmin: React.FC<TrialUsersAdminProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [users, setUsers] = useState<TrialUserAnalytics[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<TrialUserAnalytics[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<{
    activities: UserActivityLog[];
    sessions: UserSession[];
    features: { feature: string; count: number }[];
    pages: { page: string; count: number }[];
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'converted'>('all');
  const [sortBy, setSortBy] = useState<'engagement' | 'last_active' | 'days_remaining'>('engagement');

  // Load data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, usersData] = await Promise.all([
        adminAnalyticsService.getAnalyticsSummary(),
        adminAnalyticsService.getTrialUsersAnalytics(),
      ]);
      setSummary(summaryData);
      setUsers(usersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Apply filters and sorting
  useEffect(() => {
    let result = [...users];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(u =>
        (u.user_email?.toLowerCase().includes(term)) ||
        (u.company_name?.toLowerCase().includes(term)) ||
        (u.referral_code?.toLowerCase().includes(term))
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(u => u.trial_status === statusFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'engagement':
          return b.engagement_score - a.engagement_score;
        case 'last_active':
          if (!a.last_activity) return 1;
          if (!b.last_activity) return -1;
          return new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime();
        case 'days_remaining':
          if (a.days_remaining === null) return 1;
          if (b.days_remaining === null) return -1;
          return a.days_remaining - b.days_remaining;
        default:
          return 0;
      }
    });

    setFilteredUsers(result);
  }, [users, searchTerm, statusFilter, sortBy]);

  // Load user details when expanded
  const handleExpandUser = async (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      setUserDetails(null);
      return;
    }

    setExpandedUserId(userId);
    setLoadingDetails(true);
    try {
      const [activities, sessions, features, pages] = await Promise.all([
        adminAnalyticsService.getUserActivityLogs(userId, 20),
        adminAnalyticsService.getUserSessions(userId, 10),
        adminAnalyticsService.getUserFeatureUsage(userId),
        adminAnalyticsService.getUserPageViews(userId),
      ]);
      setUserDetails({ activities, sessions, features, pages });
    } catch (err) {
      console.error('Failed to load user details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Get engagement score color
  const getEngagementColor = (score: number): string => {
    if (score >= 70) return 'text-green-600 bg-green-100';
    if (score >= 40) return 'text-amber-600 bg-amber-100';
    return 'text-red-600 bg-red-100';
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>;
      case 'expired':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Expired</span>;
      case 'converted':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">Converted</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">Unknown</span>;
    }
  };

  // Format relative time
  const formatRelativeTime = (dateString: string | null): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Get device icon
  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone size={14} />;
      case 'tablet':
        return <Tablet size={14} />;
      default:
        return <Monitor size={14} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 font-medium">{error}</p>
          <button
            onClick={loadData}
            className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Trial Analytics</h1>
            <p className="text-sm text-slate-500">Monitor trial user activity and engagement</p>
          </div>
        </div>
        <button
          onClick={loadData}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Users size={16} />
              <span className="text-xs font-medium">Total Trials</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{summary.totalTrialUsers}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <Activity size={16} />
              <span className="text-xs font-medium">Active Today</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{summary.activeToday}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Calendar size={16} />
              <span className="text-xs font-medium">Active Week</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{summary.activeThisWeek}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-teal-600 mb-1">
              <TrendingUp size={16} />
              <span className="text-xs font-medium">Conversion</span>
            </div>
            <p className="text-2xl font-bold text-teal-600">{summary.conversionRate}%</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <MousePointer size={16} />
              <span className="text-xs font-medium">Avg Engagement</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">{summary.avgEngagement}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <Clock size={16} />
              <span className="text-xs font-medium">Expiring Soon</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{summary.expiringSoon}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by email or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="converted">Converted</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="engagement">Sort: Engagement</option>
          <option value="last_active">Sort: Last Active</option>
          <option value="days_remaining">Sort: Days Left</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="w-8 px-4 py-3"></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Engagement</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Last Active</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Days Left</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Usage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No trial users found matching your criteria
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <React.Fragment key={user.user_id}>
                    <tr
                      className={`cursor-pointer hover:bg-slate-50 transition-colors ${expandedUserId === user.user_id ? 'bg-slate-50' : ''}`}
                      onClick={() => handleExpandUser(user.user_id)}
                    >
                      <td className="px-4 py-3">
                        {expandedUserId === user.user_id ? (
                          <ChevronDown size={16} className="text-slate-400" />
                        ) : (
                          <ChevronRight size={16} className="text-slate-400" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {user.user_email || 'No email'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {user.company_name || 'No company'}
                          {user.referral_code && ` • Ref: ${user.referral_code}`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold ${getEngagementColor(user.engagement_score)}`}>
                          {user.engagement_score}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {formatRelativeTime(user.last_activity)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {user.days_remaining !== null ? (
                          <span className={`font-semibold ${user.days_remaining <= 3 ? 'text-red-600' : 'text-slate-700'}`}>
                            {user.days_remaining}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(user.trial_status)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 justify-center">
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium" title="Jobs">
                            {user.job_packs_count} jobs
                          </span>
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium" title="Quotes">
                            {user.quotes_count} quotes
                          </span>
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium" title="Invoices">
                            {user.invoices_count} inv
                          </span>
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium" title="Customers">
                            {user.customers_count} cust
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Details */}
                    {expandedUserId === user.user_id && (
                      <tr>
                        <td colSpan={7} className="px-4 py-4 bg-slate-50 border-t border-slate-200">
                          {loadingDetails ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
                            </div>
                          ) : userDetails ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              {/* Session Stats */}
                              <div className="bg-white rounded-lg p-4 border border-slate-200">
                                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                  <Clock size={16} className="text-teal-500" />
                                  Session Stats
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Total Sessions</span>
                                    <span className="font-medium">{user.total_logins}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Total Time</span>
                                    <span className="font-medium">{Math.round(user.total_session_minutes)}m</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Avg Session</span>
                                    <span className="font-medium">{Math.round(user.avg_session_minutes)}m</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">First Login</span>
                                    <span className="font-medium">{user.first_login ? new Date(user.first_login).toLocaleDateString() : 'N/A'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Recent Sessions */}
                              <div className="bg-white rounded-lg p-4 border border-slate-200">
                                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                  <Monitor size={16} className="text-teal-500" />
                                  Recent Sessions
                                </h4>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                  {userDetails.sessions.slice(0, 5).map((session) => (
                                    <div key={session.id} className="flex items-center gap-2 text-xs">
                                      {getDeviceIcon(session.device_type)}
                                      <span className="text-slate-600">
                                        {new Date(session.login_at).toLocaleString()}
                                      </span>
                                      {session.session_duration_seconds && (
                                        <span className="text-slate-400">
                                          ({Math.round(session.session_duration_seconds / 60)}m)
                                        </span>
                                      )}
                                      {session.is_pwa && (
                                        <span className="px-1 py-0.5 bg-teal-100 text-teal-700 rounded text-[10px]">PWA</span>
                                      )}
                                    </div>
                                  ))}
                                  {userDetails.sessions.length === 0 && (
                                    <p className="text-xs text-slate-400">No sessions recorded</p>
                                  )}
                                </div>
                              </div>

                              {/* Top Pages */}
                              <div className="bg-white rounded-lg p-4 border border-slate-200">
                                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                  <Layout size={16} className="text-teal-500" />
                                  Top Pages ({user.page_views} views)
                                </h4>
                                <div className="space-y-2">
                                  {userDetails.pages.slice(0, 5).map((page, idx) => (
                                    <div key={page.page} className="flex justify-between text-sm">
                                      <span className="text-slate-600 truncate">{page.page}</span>
                                      <span className="font-medium text-slate-900">{page.count}</span>
                                    </div>
                                  ))}
                                  {userDetails.pages.length === 0 && (
                                    <p className="text-xs text-slate-400">No page views recorded</p>
                                  )}
                                </div>
                              </div>

                              {/* Top Features */}
                              <div className="bg-white rounded-lg p-4 border border-slate-200">
                                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                  <MousePointer size={16} className="text-teal-500" />
                                  Top Features ({user.features_used})
                                </h4>
                                <div className="space-y-2">
                                  {userDetails.features.slice(0, 5).map((feature, idx) => (
                                    <div key={feature.feature} className="flex justify-between text-sm">
                                      <span className="text-slate-600 truncate">{feature.feature}</span>
                                      <span className="font-medium text-slate-900">{feature.count}</span>
                                    </div>
                                  ))}
                                  {userDetails.features.length === 0 && (
                                    <p className="text-xs text-slate-400">No feature usage recorded</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TrialUsersAdmin;
