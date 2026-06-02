import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare, FileText, Ticket, Users, Package, TrendingUp,
  ArrowUpRight, ArrowDownRight, Clock,
} from 'lucide-react';
import api from '../api';

function StatCard({ icon: Icon, label, value, trend, trendLabel, link }) {
  return (
    <Link to={link} className="glass-card p-5 group cursor-pointer">
      <div className="flex items-start justify-between mb-4">
        <div className="p-2.5 rounded-xl bg-brand/10 border border-brand/10 group-hover:bg-brand/20 group-hover:border-brand/20 transition-all duration-300">
          <Icon className="w-5 h-5 text-brand" />
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
            trend > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-sm text-mute font-medium">{label}</p>
      <p className="text-3xl font-bold text-white mt-1 tracking-tight">{value}</p>
    </Link>
  );
}

function ActivityItem({ icon: Icon, title, subtitle, time, status, statusColor, href }) {
  return (
    <Link to={href} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group">
      <div className="p-1.5 rounded-lg bg-white/[0.04] group-hover:bg-brand/10 transition-colors">
        <Icon className="w-3.5 h-3.5 text-mute group-hover:text-brand transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{title}</p>
        <p className="text-xs text-mute-dark truncate">{subtitle}</p>
      </div>
      {status && (
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${statusColor}`}>{status}</span>
      )}
      <span className="text-[10px] text-mute-dark flex-shrink-0">{time}</span>
    </Link>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.getDashboard().then(setData).catch(console.error);
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-mute-dark">
          <div className="w-5 h-5 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
          Loading dashboard...
        </div>
      </div>
    );
  }

  const { stats, recentConversations, recentQuotations, recentTickets } = data;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
        <div>
          <h2 className="text-xl font-bold text-white">Dashboard</h2>
          <p className="text-mute-dark text-sm mt-0.5">Overview of your WhatsApp business operations</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-mute-dark">
            <Clock className="w-3.5 h-3.5" />
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard icon={MessageSquare} label="Total Conversations" value={stats.totalConversations} trend={12} link="/conversations" />
        <StatCard icon={FileText} label="New Quotations" value={stats.newQuotations} trend={stats.newQuotations > 0 ? 8 : -3} link="/quotations" />
        <StatCard icon={Ticket} label="Open Tickets" value={stats.openTickets} trend={stats.openTickets > 0 ? 5 : 0} link="/tickets" />
        <StatCard icon={Users} label="Customers" value={stats.totalCustomers} link="/conversations" />
        <StatCard icon={Package} label="Products" value={stats.totalProducts} link="/products" />
        <StatCard icon={TrendingUp} label="Active Chats" value={stats.activeConversations} link="/conversations" />
      </div>

      {/* Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-panel overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white text-sm">Recent Conversations</h3>
              <p className="text-xs text-mute-dark mt-0.5">Latest customer interactions</p>
            </div>
            <Link to="/conversations" className="text-xs font-medium text-brand hover:text-brand-400 transition-colors">View all</Link>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {recentConversations.length === 0 ? (
              <p className="p-6 text-center text-sm text-mute-dark">No conversations yet</p>
            ) : (
              recentConversations.map(c => (
                <ActivityItem
                  key={c.id}
                  icon={MessageSquare}
                  title={c.customer_name || c.customer_phone || 'Unknown'}
                  subtitle={c.phone}
                  time={new Date(c.updated_at).toLocaleDateString()}
                  status={c.status}
                  statusColor={c.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-mute-dark'}
                  href="/conversations"
                />
              ))
            )}
          </div>
        </div>

        <div className="glass-panel overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white text-sm">Support Tickets</h3>
              <p className="text-xs text-mute-dark mt-0.5">Open requests from customers</p>
            </div>
            <Link to="/tickets" className="text-xs font-medium text-brand hover:text-brand-400 transition-colors">View all</Link>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {recentTickets.length === 0 ? (
              <p className="p-6 text-center text-sm text-mute-dark">No open tickets</p>
            ) : (
              recentTickets.map(t => (
                <ActivityItem
                  key={t.id}
                  icon={Ticket}
                  title={t.subject || 'Support Request'}
                  subtitle={t.customer_name || 'Unknown'}
                  time={new Date(t.created_at).toLocaleDateString()}
                  status={t.priority}
                  statusColor={t.priority === 'high' ? 'bg-red-500/10 text-red-400' : 'bg-brand/10 text-brand'}
                  href="/tickets"
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
