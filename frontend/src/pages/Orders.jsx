import { useState, useEffect } from 'react';
import { Eye, CheckCircle, Clock, Truck, Store, Package, AlertCircle } from 'lucide-react';
import api from '../api';

const statusColors = {
  new: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  reviewed: 'bg-brand/10 text-brand border-brand/20',
  quoted: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  completed: 'bg-green-500/10 text-green-400 border-green-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const statusLabels = {
  new: 'Pending',
  reviewed: 'In Progress',
  quoted: 'Quoted',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('');
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    const params = {};
    if (filter) params.status = filter;
    api.getQuotations(params).then(setOrders).catch(console.error);
  }, [filter]);

  const updateStatus = async (id, status) => {
    await api.updateQuotation(id, { status });
    setDetail(null);
    const params = {};
    if (filter) params.status = filter;
    api.getQuotations(params).then(setOrders).catch(console.error);
  };

  const tabs = [
    { key: '', label: 'All', icon: Package },
    { key: 'new', label: 'Pending', icon: Clock, count: orders.filter(o => o.status === 'new').length },
    { key: 'reviewed', label: 'In Progress', icon: Clock, count: orders.filter(o => o.status === 'reviewed').length },
    { key: 'completed', label: 'Completed', icon: CheckCircle },
  ];

  const currentTab = tabs.find(t => t.key === filter) || tabs[0];

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Orders</h2>
        <p className="text-mute-dark text-sm mt-0.5">Manage customer orders and quotations</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
              filter === t.key ? 'bg-brand text-surface-900 shadow-glow' : 'bg-white/[0.04] text-mute hover:bg-white/[0.08] hover:text-white'
            }`}>
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${filter === t.key ? 'bg-surface-900/20 text-surface-900' : 'bg-brand/10 text-brand'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {orders.map(o => (
          <div key={o.id} className="glass-card p-5 group">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-white/[0.04] flex-shrink-0">
                {o.notes?.toLowerCase().includes('delivery') ? (
                  <Truck className="w-5 h-5 text-brand" />
                ) : (
                  <Store className="w-5 h-5 text-mute-dark group-hover:text-brand transition-colors" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-xs text-mute-dark">#{o.id}</span>
                  <span className="font-semibold text-white text-sm">{o.product_name}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColors[o.status] || 'bg-white/5'}`}>
                    {statusLabels[o.status] || o.status}
                  </span>
                  {o.notes?.toLowerCase().includes('delivery') && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-brand/10 text-brand">Delivery</span>
                  )}
                  {o.notes?.toLowerCase().includes('pickup') && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/10 text-blue-400">Pickup</span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-mute-dark flex-wrap">
                  <span className="font-medium text-white">{o.customer_name || 'Unknown'}</span>
                  {o.customer_phone && <span>{o.customer_phone}</span>}
                  <span>Qty: {o.quantity}</span>
                  <span className="ml-auto">{new Date(o.created_at).toLocaleDateString()}</span>
                </div>
                {o.notes && (
                  <p className="text-xs text-mute mt-1.5 line-clamp-1">{o.notes.replace(/^Auto-detected:.*?\n?/, '')}</p>
                )}
              </div>
              <div className="flex gap-1 flex-shrink-0 flex-col items-end">
                {o.status === 'new' && (
                  <button onClick={() => updateStatus(o.id, 'reviewed')}
                    className="btn-primary inline-flex items-center gap-1.5 text-xs py-1.5 px-3 mb-1">
                    <Clock className="w-3 h-3" /> Start
                  </button>
                )}
                {(o.status === 'reviewed' || o.status === 'quoted') && (
                  <button onClick={() => updateStatus(o.id, 'completed')}
                    className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors mb-1" title="Mark Completed">
                    <CheckCircle className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setDetail(o)} className="p-2 text-mute-dark hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors" title="View">
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {orders.length === 0 && (
          <div className="text-center py-16">
            <Package className="w-8 h-8 text-mute-dark mx-auto mb-2 opacity-50" />
            <p className="text-mute-dark text-sm">No {currentTab.label.toLowerCase()} orders</p>
          </div>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setDetail(null)}>
          <div className="glass-panel w-full max-w-md p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between">
              <h3 className="font-semibold text-white text-lg">Order #{detail.id}</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColors[detail.status]}`}>
                {statusLabels[detail.status]}
              </span>
            </div>
            <div className="p-6 space-y-3 text-sm">
              {[
                ['Customer', detail.customer_name || 'Unknown'],
                ['Company', detail.customer_company || 'N/A'],
                ['Phone', detail.customer_phone],
                ['Product', detail.product_name],
                ['Quantity', detail.quantity],
                ['Method', detail.notes?.toLowerCase().includes('delivery') ? 'Delivery' : detail.notes?.toLowerCase().includes('pickup') ? 'Pickup' : 'N/A'],
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
                  <p className="mt-1.5 bg-white/[0.03] p-3 rounded-xl text-xs text-mute whitespace-pre-wrap">{detail.notes}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-white/[0.04] flex gap-2 justify-end flex-wrap">
              {detail.status === 'new' && (
                <button onClick={() => updateStatus(detail.id, 'reviewed')} className="btn-primary inline-flex items-center gap-1.5 text-sm py-2">
                  <Clock className="w-4 h-4" /> Start Order
                </button>
              )}
              {(detail.status === 'reviewed' || detail.status === 'quoted') && (
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
