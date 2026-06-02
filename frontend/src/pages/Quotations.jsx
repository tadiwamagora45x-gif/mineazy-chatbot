import { useState, useEffect } from 'react';
import { Eye, CheckCircle, FileText } from 'lucide-react';
import api from '../api';

const statusColors = {
  new: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  reviewed: 'bg-brand/10 text-brand border-brand/20',
  quoted: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  completed: 'bg-green-500/10 text-green-400 border-green-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export default function Quotations() {
  const [quotations, setQuotations] = useState([]);
  const [filter, setFilter] = useState('');
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    const params = {};
    if (filter) params.status = filter;
    api.getQuotations(params).then(setQuotations).catch(console.error);
  }, [filter]);

  const updateStatus = async (id, status) => {
    await api.updateQuotation(id, { status });
    setDetail(null);
    const params = {};
    if (filter) params.status = filter;
    api.getQuotations(params).then(setQuotations).catch(console.error);
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Quotations</h2>
        <p className="text-mute-dark text-sm mt-0.5">Track and manage quotation requests</p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'new', 'reviewed', 'quoted', 'completed'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
              filter === s ? 'bg-brand text-surface-900 shadow-glow' : 'bg-white/[0.04] text-mute hover:bg-white/[0.08] hover:text-white'
            }`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.04] bg-white/[0.01]">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-mute-dark uppercase tracking-wider">ID</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-mute-dark uppercase tracking-wider">Customer</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-mute-dark uppercase tracking-wider">Product</th>
                <th className="text-center px-5 py-3.5 text-xs font-semibold text-mute-dark uppercase tracking-wider">Qty</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-mute-dark uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-mute-dark uppercase tracking-wider">Date</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-mute-dark uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {quotations.map(q => (
                <tr key={q.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5 text-sm font-mono text-mute-dark">#{q.id}</td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-sm text-white">{q.customer_name || 'Unknown'}</div>
                    <div className="text-xs text-mute-dark">{q.customer_company}</div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-mute max-w-[200px] truncate">{q.product_name}</td>
                  <td className="px-5 py-3.5 text-sm text-center font-semibold text-white">{q.quantity}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColors[q.status] || 'bg-white/5 text-mute-dark border-white/5'}`}>{q.status}</span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-mute-dark">{new Date(q.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => setDetail(q)} className="p-2 text-mute-dark hover:text-brand hover:bg-brand/10 rounded-lg transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {quotations.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-16 text-center">
                  <FileText className="w-8 h-8 text-mute-dark mx-auto mb-2 opacity-50" />
                  <p className="text-mute-dark text-sm">No quotations found</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setDetail(null)}>
          <div className="glass-panel w-full max-w-md p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between">
              <h3 className="font-semibold text-white text-lg">Quotation #{detail.id}</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColors[detail.status]}`}>{detail.status}</span>
            </div>
            <div className="p-6 space-y-3 text-sm">
              {[
                ['Customer', detail.customer_name || 'Unknown'],
                ['Company', detail.customer_company || 'N/A'],
                ['Phone', detail.customer_phone],
                ['Product', detail.product_name],
                ['Quantity', detail.quantity],
                ['Created', new Date(detail.created_at).toLocaleString()],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between items-center py-1.5 border-b border-white/[0.03] last:border-0">
                  <span className="text-mute-dark text-xs uppercase tracking-wider font-semibold">{l}</span>
                  <span className="text-white font-medium">{v}</span>
                </div>
              ))}
              {detail.notes && (
                <div className="pt-2">
                  <span className="text-xs text-mute-dark uppercase tracking-wider font-semibold">Notes</span>
                  <p className="mt-1.5 bg-white/[0.03] p-3 rounded-xl text-xs text-mute">{detail.notes}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-white/[0.04] flex gap-2 justify-end">
              {detail.status !== 'completed' && (
                <button onClick={() => updateStatus(detail.id, 'completed')} className="btn-primary inline-flex items-center gap-1.5 text-sm py-2">
                  <CheckCircle className="w-4 h-4" /> Mark Completed
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
