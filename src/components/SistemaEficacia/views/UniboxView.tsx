import React, { useState, useEffect, useRef } from 'react';
import {
  Inbox,
  Search,
  Send,
  AlertCircle,
  Loader2,
  RefreshCw,
  Circle,
  ArrowLeft,
} from 'lucide-react';
import {
  eficaciaFetch,
  EficaciaThread,
  EficaciaMessage,
  EficaciaApiError,
} from '../../../lib/eficaciaApi';

// ─── Thread list item ─────────────────────────────────────────────────────────
const ThreadItem: React.FC<{
  thread: EficaciaThread;
  isActive: boolean;
  onClick: () => void;
}> = ({ thread, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={[
      'w-full text-left px-4 py-3.5 border-b border-slate-800/60 transition-colors',
      isActive
        ? 'bg-cyan-500/10 border-l-2 border-l-cyan-500'
        : 'hover:bg-slate-800/40 border-l-2 border-l-transparent',
    ].join(' ')}
  >
    <div className="flex items-start gap-3">
      {/* Avatar */}
      <div className="relative shrink-0">
        {thread.contact_avatar ? (
          <img
            src={thread.contact_avatar}
            alt={thread.contact_name}
            className="w-9 h-9 rounded-full object-cover"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center
                          text-slate-300 text-sm font-bold">
            {thread.contact_name.charAt(0).toUpperCase()}
          </div>
        )}
        {thread.unread_count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-cyan-500 rounded-full
                           text-[10px] text-white flex items-center justify-center font-bold">
            {thread.unread_count > 9 ? '9+' : thread.unread_count}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-sm font-medium truncate ${thread.unread_count > 0 ? 'text-white' : 'text-slate-300'}`}>
            {thread.contact_name}
          </span>
          <span className="text-[11px] text-slate-600 shrink-0 ml-2">
            {new Date(thread.last_message_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
          </span>
        </div>
        <p className="text-xs text-slate-500 truncate">{thread.last_message}</p>
        {thread.campaign_name && (
          <span className="inline-block mt-1 text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded-full">
            {thread.campaign_name}
          </span>
        )}
      </div>
    </div>
  </button>
);

// ─── Message bubble ───────────────────────────────────────────────────────────
const MessageBubble: React.FC<{ message: EficaciaMessage }> = ({ message }) => (
  <div className={`flex mb-3 ${message.is_outbound ? 'justify-end' : 'justify-start'}`}>
    <div
      className={[
        'max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
        message.is_outbound
          ? 'bg-cyan-600 text-white rounded-br-sm'
          : 'bg-slate-800 text-slate-200 rounded-bl-sm',
      ].join(' ')}
    >
      <p className="whitespace-pre-wrap break-words">{message.content}</p>
      <p className={`text-[10px] mt-1 ${message.is_outbound ? 'text-cyan-200/70' : 'text-slate-500'}`}>
        {new Date(message.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const UniboxView: React.FC = () => {
  const [threads, setThreads]           = useState<EficaciaThread[]>([]);
  const [messages, setMessages]         = useState<EficaciaMessage[]>([]);
  const [activeThread, setActiveThread] = useState<EficaciaThread | null>(null);
  const [loading, setLoading]           = useState(false);
  const [msgLoading, setMsgLoading]     = useState(false);
  const [sending, setSending]           = useState(false);
  const [reply, setReply]               = useState('');
  const [search, setSearch]             = useState('');
  const [error, setError]               = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch all threads
  const fetchThreads = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await eficaciaFetch<EficaciaThread[]>('/api/linkedin/messages/threads');
      setThreads(data);
    } catch (err) {
      setError(err instanceof EficaciaApiError ? err.message : 'Error al cargar mensajes.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages for selected thread
  const openThread = async (thread: EficaciaThread) => {
    setActiveThread(thread);
    setMsgLoading(true);
    try {
      const data = await eficaciaFetch<EficaciaMessage[]>(
        `/api/linkedin/messages/threads/${thread.id}`,
      );
      setMessages(data);
    } catch (err) {
      setError(err instanceof EficaciaApiError ? err.message : 'Error al cargar conversación.');
    } finally {
      setMsgLoading(false);
    }
  };

  // Send reply
  const handleSend = async () => {
    if (!reply.trim() || !activeThread) return;
    setSending(true);
    try {
      const sent = await eficaciaFetch<EficaciaMessage>(
        `/api/linkedin/messages/threads/${activeThread.id}/reply`,
        { method: 'POST', body: { content: reply.trim() } },
      );
      setMessages((prev) => [...prev, sent]);
      setReply('');
    } catch (err) {
      setError(err instanceof EficaciaApiError ? err.message : 'Error al enviar mensaje.');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filteredThreads = threads.filter((t) =>
    t.contact_name.toLowerCase().includes(search.toLowerCase()) ||
    t.last_message.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex h-[calc(100vh-240px)] min-h-[500px] border border-slate-800 rounded-2xl overflow-hidden">

      {/* ── Thread list ────────────────────────────────────────────────────── */}
      <div className={`flex flex-col border-r border-slate-800 bg-slate-900/30 ${activeThread ? 'hidden md:flex w-80' : 'w-full md:w-80'}`}>
        {/* Search bar */}
        <div className="p-3 border-b border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversación…"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2
                         text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <span className="text-sm font-semibold text-white">
            Unibox <span className="text-slate-500 font-normal">({filteredThreads.length})</span>
          </span>
          <button
            onClick={fetchThreads}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
            </div>
          )}
          {!loading && filteredThreads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <Inbox className="h-8 w-8 text-slate-700 mb-2" />
              <p className="text-slate-500 text-sm">Sin conversaciones</p>
            </div>
          )}
          {filteredThreads.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              isActive={activeThread?.id === thread.id}
              onClick={() => openThread(thread)}
            />
          ))}
        </div>
      </div>

      {/* ── Conversation panel ─────────────────────────────────────────────── */}
      <div className={`flex flex-col flex-1 ${!activeThread ? 'hidden md:flex' : 'flex'}`}>
        {!activeThread ? (
          /* Placeholder when nothing is selected */
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <Inbox className="h-12 w-12 text-slate-700 mb-4" />
            <p className="text-slate-500 font-medium">Selecciona una conversación</p>
            <p className="text-slate-600 text-sm mt-1">Elige un contacto de la lista izquierda.</p>
          </div>
        ) : (
          <>
            {/* Conversation header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-800 bg-slate-900/50">
              <button
                onClick={() => setActiveThread(null)}
                className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {activeThread.contact_avatar ? (
                  <img
                    src={activeThread.contact_avatar}
                    alt={activeThread.contact_name}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold">
                    {activeThread.contact_name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{activeThread.contact_name}</p>
                  {activeThread.campaign_name && (
                    <p className="text-xs text-cyan-400">{activeThread.campaign_name}</p>
                  )}
                </div>
              </div>
              <Circle className="h-2.5 w-2.5 text-emerald-400 fill-emerald-400 shrink-0" />
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5">
              {msgLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
                </div>
              ) : (
                messages.map((m) => <MessageBubble key={m.id} message={m} />)
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Error inline */}
            {error && (
              <div className="mx-4 mb-2 flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            {/* Reply bar */}
            <div className="p-3 border-t border-slate-800 flex items-end gap-2.5">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                placeholder="Escribe un mensaje… (Enter para enviar)"
                className="flex-1 resize-none bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5
                           text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500
                           transition-colors max-h-32 overflow-y-auto"
                style={{ lineHeight: '1.5' }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !reply.trim()}
                className="shrink-0 p-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700
                           disabled:text-slate-500 text-white rounded-xl transition-colors"
              >
                {sending
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <Send    className="h-5 w-5" />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UniboxView;
