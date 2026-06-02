import { useState, useEffect } from 'react';
import { MessageSquare, User, ChevronRight } from 'lucide-react';
import api from '../api';

export default function Conversations() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    api.getConversations().then(setConversations).catch(console.error);
  }, []);

  const viewConversation = async (conv) => {
    setSelected(conv);
    const data = await api.getConversation(conv.id);
    setMessages(data.messages || []);
  };

  const toggleStatus = async (conv) => {
    const newStatus = conv.status === 'active' ? 'closed' : 'active';
    await api.updateConversation(conv.id, { status: newStatus });
    api.getConversations().then(setConversations).catch(console.error);
    if (selected?.id === conv.id) setSelected({ ...selected, status: newStatus });
  };

  return (
    <div className="flex h-[calc(100vh-140px)] gap-4 animate-fade-in">
      {/* List */}
      <div className="w-80 lg:w-96 glass-panel flex flex-col flex-shrink-0 overflow-hidden">
        <div className="px-4 py-3.5 border-b border-white/[0.04]">
          <h3 className="font-semibold text-white text-sm">Conversations</h3>
          <p className="text-xs text-mute-dark mt-0.5">{conversations.length} total</p>
        </div>
        <div className="flex-1 overflow-auto">
          {conversations.map(c => (
            <button
              key={c.id}
              onClick={() => viewConversation(c)}
              className={`w-full text-left px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${
                selected?.id === c.id ? 'bg-brand/5 border-l-2 border-l-brand' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-mute-dark" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm text-white truncate">{c.customer_name || c.customer_phone || 'Unknown'}</p>
                    <span className="flex-shrink-0">
                      <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        c.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-mute-dark'
                      }`}>{c.status}</span>
                    </span>
                  </div>
                  <p className="text-xs text-mute-dark truncate mt-0.5">{c.customer_phone}</p>
                  {c.last_message && <p className="text-xs text-mute-dark truncate mt-1 opacity-60">{c.last_message}</p>}
                  <p className="text-[10px] text-mute-dark mt-1">{new Date(c.updated_at).toLocaleDateString()}</p>
                </div>
              </div>
            </button>
          ))}
          {conversations.length === 0 && (
            <p className="p-6 text-sm text-mute-dark text-center">No conversations yet</p>
          )}
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 glass-panel flex flex-col min-w-0 overflow-hidden">
        {selected ? (
          <>
            <div className="px-5 py-3.5 border-b border-white/[0.04] flex items-center justify-between flex-shrink-0">
              <div>
                <p className="font-semibold text-white text-sm">{selected.customer_name || 'Customer'}</p>
                <p className="text-xs text-mute-dark">{selected.customer_phone}</p>
              </div>
              <button onClick={() => toggleStatus(selected)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  selected.status === 'active'
                    ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                    : 'bg-white/[0.04] text-mute-dark hover:bg-white/[0.08]'
                }`}>
                {selected.status === 'active' ? 'Active — Click to close' : 'Closed — Click to reopen'}
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.direction === 'incoming' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.direction === 'incoming'
                      ? 'bg-white/[0.04] text-white'
                      : 'bg-brand text-surface-900 font-medium'
                  }`}>
                    <p>{m.content}</p>
                    <p className={`text-[10px] mt-1 ${m.direction === 'incoming' ? 'text-mute-dark' : 'text-surface-900/60'}`}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="text-center py-16">
                  <MessageSquare className="w-8 h-8 text-mute-dark mx-auto mb-2 opacity-40" />
                  <p className="text-mute-dark text-sm">No messages</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-mute-dark mx-auto mb-3 opacity-30" />
              <p className="text-mute-dark">Select a conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
