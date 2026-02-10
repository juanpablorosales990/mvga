import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { faqDatabase } from '../lib/faqDatabase';
import { findBestMatch, findTopMatches } from '../lib/faqMatcher';
import { track, AnalyticsEvents } from '../lib/analytics';

interface Message {
  id: number;
  sender: 'user' | 'bot';
  text: string;
  faqId?: string;
  type?: 'text' | 'escalation' | 'helpful' | 'quickActions';
}

let msgId = 0;

export default function SupportChat() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  const addMessage = useCallback(
    (sender: 'user' | 'bot', text: string, extra?: Partial<Message>) => {
      setMessages((prev) => [...prev, { id: ++msgId, sender, text, ...extra }]);
    },
    []
  );

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Initialize with greeting when first opened
  useEffect(() => {
    if (open && !initialized.current) {
      initialized.current = true;
      addMessage('bot', t('support.greeting'), { type: 'text' });
      // Add quick actions after greeting
      setTimeout(() => {
        addMessage('bot', '', { type: 'quickActions' });
      }, 300);
    }
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, addMessage, t]);

  const handleOpen = () => {
    setOpen(true);
    track(AnalyticsEvents.SUPPORT_CHAT_OPENED);
  };

  const handleSend = () => {
    const query = input.trim();
    if (!query) return;

    addMessage('user', query);
    setInput('');

    // Match against FAQ
    setTimeout(() => {
      const result = findBestMatch(query, faqDatabase);

      if (result) {
        addMessage('bot', t(result.faq.answer), { faqId: result.faq.id });
        // Show "was this helpful?" after answer
        setTimeout(() => {
          addMessage('bot', '', { type: 'helpful' });
        }, 500);

        // Show related questions
        if (result.faq.relatedIds?.length) {
          setTimeout(() => {
            const related = faqDatabase.filter((f) => result.faq.relatedIds?.includes(f.id));
            if (related.length > 0) {
              const relatedText = related.map((f) => `• ${t(f.question)}`).join('\n');
              addMessage('bot', `${t('support.relatedTitle')}:\n${relatedText}`);
            }
          }, 800);
        }
      } else {
        // No match — try showing top partial matches
        const partial = findTopMatches(query, faqDatabase, 2);
        if (partial.length > 0) {
          const suggestions = partial.map((r) => `• ${t(r.faq.question)}`).join('\n');
          addMessage('bot', `${t('support.didYouMean')}:\n${suggestions}`);
          setTimeout(() => {
            addMessage('bot', '', { type: 'helpful' });
          }, 500);
        } else {
          addMessage('bot', t('support.noMatch'));
          setTimeout(() => {
            addMessage('bot', '', { type: 'escalation' });
          }, 300);
        }
      }
    }, 400); // Simulate brief "thinking" delay
  };

  const handleQuickAction = (query: string) => {
    setInput('');
    addMessage('user', query);

    setTimeout(() => {
      const result = findBestMatch(query, faqDatabase);
      if (result) {
        addMessage('bot', t(result.faq.answer), { faqId: result.faq.id });
        setTimeout(() => addMessage('bot', '', { type: 'helpful' }), 500);
      }
    }, 400);
  };

  const handleEscalate = (channel: 'email' | 'telegram') => {
    track(AnalyticsEvents.SUPPORT_ESCALATED, { channel });
    if (channel === 'email') {
      const lastUserMsg = [...messages].reverse().find((m) => m.sender === 'user');
      const subject = encodeURIComponent(
        lastUserMsg ? `MVGA Support: ${lastUserMsg.text.slice(0, 100)}` : 'MVGA Support Request'
      );
      window.open(`mailto:support@mvga.io?subject=${subject}`, '_blank');
    } else {
      window.open('https://t.me/mvgacommunity', '_blank');
    }
    addMessage('bot', t('support.escalated'));
  };

  const handleHelpful = (yes: boolean) => {
    if (yes) {
      addMessage('bot', t('support.gladHelped'));
    } else {
      addMessage('bot', t('support.noMatch'));
      setTimeout(() => addMessage('bot', '', { type: 'escalation' }), 300);
    }
  };

  const renderMessage = (msg: Message) => {
    if (msg.type === 'quickActions') {
      return (
        <div key={msg.id} className="flex flex-wrap gap-2 mb-3">
          {[
            { label: t('support.quickDeposit'), query: t('support.queryDeposit') },
            { label: t('support.quickPassword'), query: t('support.queryPassword') },
            { label: t('support.quickFees'), query: t('support.queryFees') },
            { label: t('support.quickP2P'), query: t('support.queryP2P') },
          ].map((qa) => (
            <button
              key={qa.label}
              onClick={() => handleQuickAction(qa.query)}
              className="text-xs px-3 py-1.5 border border-gold-500/30 text-gold-500 hover:bg-gold-500/10 transition"
            >
              {qa.label}
            </button>
          ))}
        </div>
      );
    }

    if (msg.type === 'escalation') {
      return (
        <div key={msg.id} className="space-y-2 mb-3">
          <p className="text-xs text-white/40">{t('support.escalateTitle')}</p>
          <button
            onClick={() => handleEscalate('email')}
            className="w-full text-left text-xs px-3 py-2 bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition flex items-center gap-2"
          >
            <span className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 text-[10px]">
              @
            </span>
            {t('support.escalateEmail')}
          </button>
          <button
            onClick={() => handleEscalate('telegram')}
            className="w-full text-left text-xs px-3 py-2 bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition flex items-center gap-2"
          >
            <span className="w-5 h-5 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 text-[10px]">
              T
            </span>
            {t('support.escalateTelegram')}
          </button>
        </div>
      );
    }

    if (msg.type === 'helpful') {
      return (
        <div key={msg.id} className="flex items-center gap-2 mb-3">
          <span className="text-xs text-white/30">{t('support.helpful')}</span>
          <button
            onClick={() => handleHelpful(true)}
            className="text-xs px-2 py-1 border border-white/10 text-white/50 hover:border-emerald-500/50 hover:text-emerald-400 transition"
          >
            {t('support.yes')}
          </button>
          <button
            onClick={() => handleHelpful(false)}
            className="text-xs px-2 py-1 border border-white/10 text-white/50 hover:border-red-500/50 hover:text-red-400 transition"
          >
            {t('support.no')}
          </button>
        </div>
      );
    }

    return (
      <div
        key={msg.id}
        className={`mb-3 max-w-[85%] ${msg.sender === 'user' ? 'ml-auto' : 'mr-auto'}`}
      >
        <div
          className={`px-3 py-2 text-sm whitespace-pre-line ${
            msg.sender === 'user'
              ? 'bg-gold-500/20 text-gold-500 border border-gold-500/30'
              : 'bg-white/5 text-white/70 border border-white/10'
          }`}
        >
          {msg.text}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={handleOpen}
          className="fixed bottom-24 right-4 z-40 w-12 h-12 bg-gold-500 text-black font-bold text-lg flex items-center justify-center shadow-lg shadow-gold-500/20 hover:bg-gold-400 transition animate-[pulse_3s_ease-in-out_3]"
          aria-label={t('support.title')}
        >
          ?
        </button>
      )}

      {/* Chat drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />

          {/* Chat panel */}
          <div
            className="relative bg-[#0a0a0a] border-t border-white/10 w-full max-w-lg flex flex-col"
            style={{ maxHeight: '70vh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div>
                <h3 className="text-sm font-bold">{t('support.title')}</h3>
                <p className="text-[10px] text-white/30 font-mono">{t('support.disclaimer')}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/40 hover:text-white text-xl px-2"
              >
                &times;
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
              {messages.map(renderMessage)}
            </div>

            {/* Input */}
            <div className="border-t border-white/10 px-4 py-3 flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={t('support.placeholder')}
                className="flex-1 bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-gold-500"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="px-4 py-2 bg-gold-500 text-black text-sm font-bold disabled:opacity-30 hover:bg-gold-400 transition"
              >
                &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
