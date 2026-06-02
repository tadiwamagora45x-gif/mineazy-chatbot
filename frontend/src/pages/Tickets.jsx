import { useState, useEffect } from 'react';
import { Eye, CheckCircle, Ticket, AlertCircle } from 'lucide-react';
import api from '../api';

const statusC = {
  open: 'bg-red-500/10 text-red-400 border-red-500/20',
  in_progress: 'bg-brand/10 text-brand border-brand/20',
  resolved: 'bg-green-500/10 text-green-400 border-green-500/20',
  closed: 'bg-white/5 text-mute-dark border-white/5',
};

const priorityC = {
  low: 'bg-white/5 text-mute-dark',
  medium: 'bg-brand/10 text-brand',
  high: 'bg-red-500/10 text-red-400',
};

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState('');
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    const params = {};
    if (filter) params.status = filter;
    api.getTickets(params).then(setTickets).catch(console.error);
  }, [filter]);

  const updateStatus = async (id, status) => {
    await api.updateTicket(id, { status });
    setDetail(null);
    const params = {};
    if (filter) params.status = filter;
    api.getTickets(params).then(setTickets).catch(console.error);
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Support Tickets</h2>
        <p className="text-mute-dark text-sm mt-0.5">Manage customer support requests</p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'open', 'in_progress', 'resolved'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
              filter === s ? 'bg-brand text-surface-900 shadow-glow' : 'bg-white/[0.04] text-mute hover:bg-white/[0.08] hover:text-white'
            }`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {tickets.map(t => (
          <div key={t.id} className="glass-card p-5 group">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-white/[0.04] flex-shrink-0">
                <Ticket className="w-5 h-5 text-mute-dark group-hover:text-brand transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-xs text-mute-dark">#{t.id}</span>
                  <span className="font-semibold text-white text-sm">{t.subject || 'Support Request'}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusC[t.status] || statusC.open}`}>{t.status}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${priorityC[t.priority]}`}>{t.priority}</span>
                </div>
                <p className="text-sm text-mute line-clamp-2 mt-1">{t.description}</p>
                <div className="flex items-center gap-4 mt-2.5 text-xs text-mute-dark">
                  <span className="font-medium text-white">{t.customer_name || 'Unknown'}</span>
                  {t.customer_phone && <span>{t.customer_phone}</span>}
                  <span className="ml-auto">{new Date(t.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {t.status !== 'resolved' && (
                  <button onClick={() => updateStatus(t.id, 'resolved')}
                    className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors" title="Mark Resolved">
                    <CheckCircle className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setDetail(t)} className="p-2 text-mute-dark hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors" title="View">
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {tickets.length === 0 && (
          <div className="text-center py-16">
            <AlertCircle className="w-8 h-8 text-mute-dark mx-auto mb-2 opacity-50" />
            <p className="text-mute-dark text-sm">No tickets found</p>
          </div>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setDetail(null)}>
          <div className="glass-panel w-full max-w-md p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between">
              <h3 className="font-semibold text-white text-lg">Ticket #{detail.id}</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusC[detail.status]}`}>{detail.status}</span>
            </div>
            <div className="p-6 space-y-3 text-sm">
              {[
                ['Subject', detail.subject || 'N/A'],
                ['Customer', detail.customer_name || 'Unknown'],
                ['Phone', detail.customer_phone || 'N/A'],
                ['Priority', detail.priority],
                ['Created', new Date(detail.created_at).toLocaleString()],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between items-center py-1.5 border-b border-white/[0.03] last:border-0">
                  <span className="text-mute-dark text-xs uppercase tracking-wider font-semibold">{l}</span>
                  <span className="text-white font-medium">{v}</span>
                </div>
              ))}
              {detail.description && (
                <div className="pt-2">
                  <span className="text-xs text-mute-dark uppercase tracking-wider font-semibold">Description</span>
                  <p className="mt-1.5 bg-white/[0.03] p-3 rounded-xl text-xs text-mute whitespace-pre-wrap">{detail.description}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-white/[0.04] flex gap-2 justify-end">
              {detail.status !== 'resolved' && (
                <button onClick={() => updateStatus(detail.id, 'resolved')} className="btn-primary inline-flex items-center gap-1.5 text-sm py-2">
                  <CheckCircle className="w-4 h-4" /> Mark Resolved
                </button>
              )}
              <button onClick={() => setDetail(null)} className="btn-secondary text-sm py-2">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
