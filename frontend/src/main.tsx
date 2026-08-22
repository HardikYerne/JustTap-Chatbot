import React, {
  useEffect,
  useRef,
  useState
} from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = (
  (import.meta as any).env?.VITE_API_URL ??
  ((import.meta as any).env?.DEV
    ? 'http://localhost:4000'
    : '')
).replace(/\/$/, '');

type Lang = 'en' | 'hi' | 'mr';

const LANGS: Record<Lang, string> = {
  en: 'English',
  hi: 'हिंदी',
  mr: 'मराठी'
};

const T: Record<Lang, any> = {
  en: {
    type: 'Type your question...',
    send: 'Send',
    yes: 'Yes',
    no: 'No',
    welcome: 'Welcome to Genie 👋',
    subtitle: 'How can we help you today?',
    ticket: 'Would you like to create a support ticket?',
    contact: 'Let our team contact you',
    submit: 'Submit request',
    name: 'Your name',
    phone: 'Phone number',
    location: 'Location',
    requirement: 'What do you need?',
    newChat: 'New chat'
  },
  hi: {
    type: 'अपना सवाल लिखें...',
    send: 'भेजें',
    yes: 'हाँ',
    no: 'नहीं',
    welcome: 'Genie में आपका स्वागत है 👋',
    subtitle: 'आज हम आपकी कैसे मदद कर सकते हैं?',
    ticket: 'क्या आप सपोर्ट टिकट बनाना चाहते हैं?',
    contact: 'हमारी टीम आपसे संपर्क करे',
    submit: 'अनुरोध भेजें',
    name: 'आपका नाम',
    phone: 'फोन नंबर',
    location: 'स्थान',
    requirement: 'आपको क्या चाहिए?',
    newChat: 'नई चैट'
  },
  mr: {
    type: 'तुमचा प्रश्न लिहा...',
    send: 'पाठवा',
    yes: 'होय',
    no: 'नाही',
    welcome: 'Genie मध्ये स्वागत आहे 👋',
    subtitle: 'आज आम्ही तुमची कशी मदत करू शकतो?',
    ticket: 'सपोर्ट तिकीट तयार करायचे का?',
    contact: 'आमच्या टीमकडून संपर्क हवा आहे',
    submit: 'विनंती पाठवा',
    name: 'तुमचे नाव',
    phone: 'फोन नंबर',
    location: 'स्थान',
    requirement: 'तुमची गरज',
    newChat: 'नवीन चॅट'
  }
};

function getSession(): string {
  const current =
    localStorage.getItem('justtap_session');

  if (current) return current;

  const next = crypto.randomUUID();
  localStorage.setItem('justtap_session', next);
  return next;
}

function resetSession(): string {
  const next = crypto.randomUUID();
  localStorage.setItem('justtap_session', next);
  return next;
}

function messagesKey(sessionId: string): string {
  return `justtap_messages_${sessionId}`;
}

function getStoredMessages(sessionId: string): any[] {
  try {
    const raw = localStorage.getItem(
      messagesKey(sessionId)
    );
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredMessages(
  sessionId: string,
  messages: any[]
) {
  try {
    localStorage.setItem(
      messagesKey(sessionId),
      JSON.stringify(messages)
    );
  } catch {
    // Storage full or unavailable - conversation still works,
    // it just won't survive a full close/reopen this time.
  }
}

function clearStoredMessages(sessionId: string) {
  localStorage.removeItem(
    messagesKey(sessionId)
  );
}

function Icon({
  name,
  size = 21
}: {
  name: string;
  size?: number;
}) {
  const p: any = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  };

  const x: any = {
    mic: (
      <>
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <path d="M12 18v4M8 22h8" />
      </>
    ),
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    message: (
      <path d="M20 15a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3z" />
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 21a7 7 0 0 1 14 0" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    grid: (
      <>
        <rect x="4" y="4" width="6" height="6" />
        <rect x="14" y="4" width="6" height="6" />
        <rect x="4" y="14" width="6" height="6" />
        <rect x="14" y="14" width="6" height="6" />
      </>
    )
  };

  return <svg {...p}>{x[name]}</svg>;
}

function Mascot({
  className = ''
}: {
  className?: string;
}) {
  return (
    <img
      className={`mascot ${className}`}
      src="/bot.png"
      alt="JustTap Genie"
    />
  );
}

function ChatbotPanel({
  onClose
}: {
  onClose: () => void;
}) {
  const [lang, setLang] =
    useState<Lang>(
      (localStorage.getItem(
        'justtap_language'
      ) as Lang) || 'en'
    );

  const [sessionId, setSessionId] =
    useState(getSession());

  const [messages, setMessages] =
    useState<any[]>(() =>
      getStoredMessages(sessionId)
    );

  const [input, setInput] =
    useState('');

  const [isAtBottom, setIsAtBottom] =
    useState(true);

  const messagesRef =
    useRef<HTMLDivElement>(null);

  const bottomRef =
    useRef<HTMLDivElement>(null);

  const [notice, setNotice] =
    useState('');

  const [lead, setLead] =
    useState(false);

  const [service, setService] =
    useState('');

  const [form, setForm] =
    useState({
      name: '',
      phone: '',
      location: '',
      requirement: ''
    });

  const [isListening, setIsListening] =
    useState(false);

  const [voiceStatus, setVoiceStatus] =
    useState('');

  const recognitionRef =
    useRef<any>(null);

  const t = T[lang];

  useEffect(() => {
    localStorage.setItem(
      'justtap_language',
      lang
    );

    if (!messages.length) {
      setMessages([
        {
          role: 'bot',
          text:
            `${t.welcome}\n${t.subtitle}`
        }
      ]);
    }
  }, [lang]);

  // Resume support: keep the conversation saved so closing and
  // reopening the widget shows the previous chat instead of a blank one.
  useEffect(() => {
    saveStoredMessages(sessionId, messages);
  }, [sessionId, messages]);

  // Only auto-scroll to the newest message when the user is already
  // at the bottom, so scrolling up to re-read history isn't interrupted.
  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({
        behavior: 'smooth'
      });
    }
  }, [messages, isAtBottom]);

  const handleMessagesScroll = () => {
    const el = messagesRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight -
      el.scrollTop -
      el.clientHeight;
    setIsAtBottom(distanceFromBottom < 40);
  };

  const scrollToLatest = () => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
    setIsAtBottom(true);
  };

  const newChat = () => {
    clearStoredMessages(sessionId);
    const next = resetSession();
    setSessionId(next);
    setMessages([]);
    setInput('');
    setNotice('');
    setLead(false);
    setIsAtBottom(true);
  };

  const ask = async (
    text = input
  ) => {
    const q = text.trim();

    if (!q) return;

    setInput('');

    setMessages(
      current => [
        ...current,
        {
          role: 'user',
          text: q
        }
      ]
    );

    try {
      const response =
        await fetch(
          `${API}/api/support/chat`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
              Accept:
                'application/json'
            },
            body: JSON.stringify({
              sessionId,
              message: q,
              language: lang,
              audience: 'customer'
            })
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
          'Chat request failed'
        );
      }

      setMessages(
        current => [
          ...current,
          {
            role: 'bot',
            text:
              data.answer ||
              'No response available.'
          }
        ]
      );

      setNotice(
        data.type ===
        'ticket_confirmation'
          ? 'ticket'
          : ''
      );

      if (data.type === 'lead_offer') {
        setService(
          data.service || ''
        );
        setLead(true);
      }

    } catch (error) {
      console.error(error);

      setMessages(
        current => [
          ...current,
          {
            role: 'bot',
            text:
              lang === 'hi'
                ? 'मैं अभी सहायता सेवा से कनेक्ट नहीं कर पा रहा हूँ। कृपया कुछ देर बाद प्रयास करें।'
                : lang === 'mr'
                  ? 'मी सध्या सपोर्ट सेवेशी कनेक्ट करू शकत नाही. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.'
                  : 'Support is temporarily unavailable. Please try again.'
          }
        ]
      );
    }
  };

  const confirm = async (
    yes: boolean
  ) => {
    setNotice('');

    await ask(
      yes ? 'yes' : 'no'
    );
  };

  const voice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceStatus(
        'Voice input is not supported in this browser.'
      );
      return;
    }

    const recognition =
      new SpeechRecognition();

    recognitionRef.current =
      recognition;

    recognition.lang =
      lang === 'hi'
        ? 'hi-IN'
        : lang === 'mr'
          ? 'mr-IN'
          : 'en-IN';

    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceStatus(
        lang === 'hi'
          ? 'मैं सुन रहा हूँ...'
          : lang === 'mr'
            ? 'मी ऐकत आहे...'
            : "I'm listening..."
      );
    };

    recognition.onresult =
      (event: any) => {
        let transcript = '';

        for (
          let i =
            event.resultIndex || 0;
          i < event.results.length;
          i++
        ) {
          transcript +=
            event.results[i][0]
              .transcript;
        }

        if (transcript.trim()) {
          setInput(
            transcript.trim()
          );
        }
      };

    recognition.onerror =
      (event: any) => {
        setIsListening(false);
        recognitionRef.current =
          null;

        setVoiceStatus(
          event?.error === 'no-speech'
            ? 'I could not hear you. Please try again.'
            : 'Voice input failed. Please try again.'
        );
      };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current =
        null;
      setVoiceStatus('');
    };

    recognition.start();
  };

  return (
    <div className="customer-panel">
      <header className="genie-header">
        <div className="genie-brand">
          <Mascot />

          <div>
            <strong>Genie</strong>
            <span>
              JustTap Support
            </span>
          </div>

          <button
            type="button"
            className="chat-close"
            aria-label="Close Genie"
            title="Cancel"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="language-bar">
          {(
            Object.keys(
              LANGS
            ) as Lang[]
          ).map(language => (
            <button
              type="button"
              key={language}
              className={
                lang === language
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setLang(language)
              }
            >
              {LANGS[language]}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="new-chat-link"
          onClick={newChat}
        >
          <Icon name="plus" size={14} />
          {t.newChat}
        </button>
      </header>

      <main className="chat-area">
        <div className="welcome-card">
          <Mascot className="welcome-mascot" />

          <div>
            <h1>
              {t.welcome}
            </h1>
            <p>
              {t.subtitle}
            </p>
          </div>
        </div>

        <div
          className="messages"
          ref={messagesRef}
          onScroll={handleMessagesScroll}
        >
          {messages.map(
            (message, index) => (
              <div
                key={index}
                className={
                  `bubble ${message.role}`
                }
              >
                {message.text}
              </div>
            )
          )}

          {notice === 'ticket' && (
            <div className="ticket-confirm">
              <p>{t.ticket}</p>

              <button
                type="button"
                onClick={() =>
                  void confirm(true)
                }
              >
                {t.yes}
              </button>

              <button
                type="button"
                onClick={() =>
                  void confirm(false)
                }
              >
                {t.no}
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {!isAtBottom && (
          <button
            type="button"
            className="scroll-latest"
            onClick={scrollToLatest}
          >
            <Icon name="clock" size={14} />
            {lang === 'hi'
              ? 'नया संदेश देखें'
              : lang === 'mr'
                ? 'नवीन संदेश पहा'
                : 'Back to latest'}
          </button>
        )}
      </main>

      <div className="composer">
        {voiceStatus && (
          <div
            className="voice-status"
            role="status"
          >
            {voiceStatus}
          </div>
        )}

        <input
          value={input}
          onChange={event =>
            setInput(
              event.target.value
            )
          }
          onKeyDown={event => {
            if (
              event.key === 'Enter'
            ) {
              void ask();
            }
          }}
          placeholder={t.type}
        />

        <button
          type="button"
          className={
            `mic ${
              isListening
                ? 'listening'
                : ''
            }`
          }
          onClick={voice}
          aria-label={
            isListening
              ? 'Stop listening'
              : 'Start voice input'
          }
        >
          <Icon name="mic" />
        </button>

        <button
          type="button"
          className="send"
          onClick={() => void ask()}
          aria-label={t.send}
        >
          <Icon name="send" />
        </button>
      </div>

      {lead && (
        <LeadModal
          t={t}
          service={service}
          form={form}
          setForm={setForm}
          close={() =>
            setLead(false)
          }
          submit={async (
            event: any
          ) => {
            event.preventDefault();

            const response =
              await fetch(
                `${API}/api/support/leads`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type':
                      'application/json'
                  },
                  body:
                    JSON.stringify({
                      sessionId,
                      ...form,
                      service
                    })
                }
              );

            if (response.ok) {
              setLead(false);

              setMessages(
                current => [
                  ...current,
                  {
                    role: 'bot',
                    text:
                      lang === 'hi'
                        ? 'धन्यवाद। आपका अनुरोध प्राप्त हो गया है और हमारी टीम आपसे संपर्क करेगी।'
                        : lang === 'mr'
                          ? 'धन्यवाद. तुमची विनंती प्राप्त झाली आहे आणि आमची टीम तुमच्याशी संपर्क करेल.'
                          : 'Thank you. Your request has been received and our team will contact you.'
                  }
                ]
              );
            }
          }}
        />
      )}
    </div>
  );
}

function LeadModal({
  t,
  service,
  form,
  setForm,
  close,
  submit
}: any) {
  return (
    <div className="modal">
      <form onSubmit={submit}>
        <button
          type="button"
          className="modal-x"
          onClick={close}
        >
          <Icon name="close" />
        </button>

        <h2>{t.contact}</h2>

        <p>
          Service:{' '}
          <b>
            {service ||
              'requested service'}
          </b>
        </p>

        <input
          required
          placeholder={t.name}
          value={form.name}
          onChange={event =>
            setForm({
              ...form,
              name:
                event.target.value
            })
          }
        />

        <input
          required
          placeholder={t.phone}
          value={form.phone}
          onChange={event =>
            setForm({
              ...form,
              phone:
                event.target.value
            })
          }
        />

        <input
          placeholder={t.location}
          value={form.location}
          onChange={event =>
            setForm({
              ...form,
              location:
                event.target.value
            })
          }
        />

        <textarea
          placeholder={
            t.requirement
          }
          value={
            form.requirement
          }
          onChange={event =>
            setForm({
              ...form,
              requirement:
                event.target.value
            })
          }
        />

        <button
          className="submit"
          type="submit"
        >
          {t.submit}
        </button>
      </form>
    </div>
  );
}

// Provider dashboard is preserved from the working project.
type SupportTicket = {
  id: string;
  sessionId: string;
  audience: string;
  question: string;
  status: string;
  createdAt: string;
  messages?: Array<{
    id: string;
    role: string;
    text: string;
    createdAt: string;
  }>;
};

function SupportProviderApp() {
  const [
    section,
    setSection
  ] = useState('Tickets');

  const sections = [
    ['Tickets', 'message'],
    ['My Tickets', 'user'],
    ['Unassigned', 'clock'],
    ['Customers', 'user'],
    ['Settings', 'grid']
  ];

  return (
    <div className="provider-app">
      <aside className="provider-sidebar">
        <div className="provider-brand">
          <Mascot />
          <span>Genie</span>
        </div>

        <div className="provider-label">
          CUSTOMER SUPPORT
        </div>

        {sections.map(
          ([name, icon]) => (
            <button
              type="button"
              key={name}
              className={
                section === name
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setSection(name)
              }
            >
              <Icon name={icon} />
              {name}
            </button>
          )
        )}

        <a
          className="back-customer"
          href="/"
        >
          <span>‹</span>
          Customer Chat
        </a>
      </aside>

      <main className="provider-main">
        <header className="provider-top">
          <div>
            <span className="eyebrow">
              PROVIDER DASHBOARD
            </span>
            <h1>{section}</h1>
          </div>

          <div className="provider-user">
            <span className="support-status">
              Customer Support
            </span>
            <Mascot className="provider-avatar" />
          </div>
        </header>

        {section === 'Tickets' && (
          <SupportTickets />
        )}

        {section === 'My Tickets' && (
          <SupportTickets filter="mine" />
        )}

        {section === 'Unassigned' && (
          <SupportTickets filter="unassigned" />
        )}

        {section === 'Customers' && (
          <SupportCustomers />
        )}

        {section === 'Settings' && (
          <SupportSettings />
        )}
      </main>
    </div>
  );
}

function useSupportApi() {
  const [
    tickets,
    setTickets
  ] = useState<SupportTicket[]>([]);

  const [error, setError] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const token =
    localStorage.getItem(
      'justtap_admin_token'
    ) || '';

  const request = async (
    url: string,
    options: RequestInit = {}
  ) => {
    const response =
      await fetch(
        `${API}${url}`,
        {
          ...options,
          headers: {
            Accept:
              'application/json',
            'Content-Type':
              'application/json',
            Authorization:
              `Bearer ${token}`,
            ...(options.headers || {})
          }
        }
      );

    const raw =
      await response.text();

    let data: any = null;

    try {
      data = raw
        ? JSON.parse(raw)
        : null;
    } catch {
      throw new Error(
        `Invalid server response (${response.status})`
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.error ||
        `Request failed (${response.status})`
      );
    }

    return data;
  };

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const data =
        await request(
          '/api/support/tickets'
        );

      setTickets(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (error: any) {
      setError(
        error?.message ||
        'Unable to load tickets.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const claim = async (
    id: string
  ) => {
    await request(
      `/api/support/tickets/${encodeURIComponent(id)}/claim`,
      { method: 'POST' }
    );
    await load();
  };

  const resolve = async (
    id: string
  ) => {
    await request(
      `/api/support/tickets/${encodeURIComponent(id)}/resolve`,
      { method: 'PATCH' }
    );
    await load();
  };

  const reply = async (
    id: string,
    text: string
  ) => {
    await request(
      `/api/support/tickets/${encodeURIComponent(id)}/reply`,
      {
        method: 'POST',
        body: JSON.stringify({ text })
      }
    );
    await load();
  };

  return {
    tickets,
    error,
    loading,
    load,
    claim,
    resolve,
    reply
  };
}

function TicketRow({
  ticket,
  onOpen,
  onClaim,
  onResolve
}: {
  ticket: SupportTicket;
  onOpen: () => void;
  onClaim?: () => void;
  onResolve?: () => void;
}) {
  return (
    <div className="support-ticket-row">
      <div className="support-ticket-main">
        <div className="support-ticket-id">
          {ticket.id}
        </div>

        <strong>
          {ticket.question}
        </strong>

        <small>
          {new Date(
            ticket.createdAt
          ).toLocaleString()}
        </small>
      </div>

      <span
        className={
          `ticket-status ${ticket.status}`
        }
      >
        {ticket.status.replace(
          '_',
          ' '
        )}
      </span>

      <div className="ticket-actions">
        <button
          type="button"
          onClick={onOpen}
        >
          Open
        </button>

        {ticket.status ===
          'unassigned' &&
          onClaim && (
            <button
              type="button"
              onClick={onClaim}
            >
              Claim
            </button>
          )}

        {ticket.status !==
          'resolved' &&
          onResolve && (
            <button
              type="button"
              onClick={onResolve}
            >
              Resolve
            </button>
          )}
      </div>
    </div>
  );
}

function SupportTickets({
  filter
}: {
  filter?: 'mine' | 'unassigned';
} = {}) {
  const {
    tickets,
    error,
    loading,
    load,
    claim,
    resolve,
    reply
  } = useSupportApi();

  const [
    selected,
    setSelected
  ] = useState<SupportTicket | null>(
    null
  );

  const [
    text,
    setText
  ] = useState('');

  const visible =
    tickets.filter(ticket =>
      filter === 'mine'
        ? ticket.status ===
          'in_progress'
        : filter === 'unassigned'
          ? ticket.status ===
            'unassigned'
          : true
    );

  const send = async () => {
    if (
      !selected ||
      !text.trim()
    ) return;

    await reply(
      selected.id,
      text.trim()
    );

    setText('');
    setSelected(null);
  };

  return (
    <div className="provider-content support-content">
      <div className="support-toolbar">
        <div>
          <p>
            Customer support
          </p>
          <h2>
            {filter === 'mine'
              ? 'My Tickets'
              : filter ===
                  'unassigned'
                ? 'Unassigned'
                : 'Resolve customer issues'}
          </h2>
        </div>

        <button
          className="support-refresh"
          type="button"
          onClick={() =>
            void load()
          }
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="support-error">
          {error}
          <small>
            Set ADMIN_TOKEN and save
            it in Provider → Settings.
          </small>
        </div>
      )}

      {loading && (
        <div className="provider-card">
          Loading tickets...
        </div>
      )}

      {!loading &&
        !visible.length && (
          <div className="provider-card empty-provider">
            <Icon
              name="message"
              size={42}
            />
            <h2>No tickets</h2>
            <p>
              Customer support tickets
              will appear here.
            </p>
          </div>
        )}

      <div className="support-ticket-list">
        {visible.map(ticket => (
          <TicketRow
            key={ticket.id}
            ticket={ticket}
            onOpen={() =>
              setSelected(ticket)
            }
            onClaim={() =>
              void claim(ticket.id)
            }
            onResolve={() =>
              void resolve(ticket.id)
            }
          />
        ))}
      </div>

      {selected && (
        <div className="ticket-detail-panel">
          <div className="ticket-detail-head">
            <div>
              <span>
                {selected.id}
              </span>
              <h3>
                {selected.question}
              </h3>
            </div>

            <button
              type="button"
              onClick={() =>
                setSelected(null)
              }
            >
              <Icon name="close" />
            </button>
          </div>

          <div className="ticket-thread">
            {(selected.messages ||
              []).map(message => (
                <div
                  key={message.id}
                  className={
                    `ticket-message ${message.role}`
                  }
                >
                  <small>
                    {message.role}
                  </small>
                  <p>
                    {message.text}
                  </p>
                </div>
              ))}
          </div>

          {selected.status !==
            'resolved' && (
            <div className="ticket-reply">
              <textarea
                value={text}
                onChange={event =>
                  setText(
                    event.target.value
                  )
                }
                placeholder="Reply to customer..."
              />

              <button
                type="button"
                onClick={() =>
                  void send()
                }
              >
                Send Reply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SupportCustomers() {
  const [
    customers,
    setCustomers
  ] = useState<any[]>([]);

  const [error, setError] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const token =
          localStorage.getItem(
            'justtap_admin_token'
          ) || '';

        const response =
          await fetch(
            `${API}/api/support/customers`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
                Accept:
                  'application/json'
              }
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
            'Unable to load customers'
          );
        }

        setCustomers(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (error: any) {
        setError(
          error?.message ||
          'Unable to load customers'
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="provider-content support-content">
      <div className="support-toolbar">
        <div>
          <p>
            Customer records
          </p>
          <h2>
            Customers
          </h2>
        </div>
      </div>

      {error && (
        <div className="support-error">
          {error}
        </div>
      )}

      {loading && (
        <div className="provider-card">
          Loading customers...
        </div>
      )}

      {!loading &&
        !customers.length &&
        !error && (
          <div className="provider-card empty-provider">
            <Icon
              name="user"
              size={42}
            />
            <h2>
              No customers with
              tickets
            </h2>
          </div>
        )}

      <div className="customer-list">
        {customers.map(customer => (
          <div
            className="customer-row"
            key={customer.sessionId}
          >
            <Icon name="user" />

            <div>
              <b>
                {customer.sessionId}
              </b>

              <small>
                {customer.tickets}{' '}
                ticket(s) · Last activity{' '}
                {new Date(
                  customer.lastActivity
                ).toLocaleString()}
              </small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SupportSettings() {
  const [
    token,
    setToken
  ] = useState(
    localStorage.getItem(
      'justtap_admin_token'
    ) || ''
  );

  return (
    <div className="provider-content support-content">
      <section className="provider-card">
        <h2>
          Support Settings
        </h2>

        <p className="muted">
          Configure the provider/admin
          API token.
        </p>

        <label className="settings-field">
          <span>
            Admin Token
          </span>

          <input
            type="password"
            value={token}
            onChange={event =>
              setToken(
                event.target.value
              )
            }
            placeholder="ADMIN_TOKEN"
          />
        </label>

        <button
          className="submit"
          type="button"
          onClick={() => {
            if (token.trim()) {
              localStorage.setItem(
                'justtap_admin_token',
                token.trim()
              );
            } else {
              localStorage.removeItem(
                'justtap_admin_token'
              );
            }
          }}
        >
          Save Settings
        </button>
      </section>
    </div>
  );
}

function CustomerHost() {
  const [
    open,
    setOpen
  ] = useState(false);

  return (
    <div className="app-host">
      {!open && (
        <button
          className="genie-launcher"
          aria-label="Open Genie chatbot"
          onClick={() =>
            setOpen(true)
          }
        >
          <img
            src="/genie-launcher.png"
            alt="Open Genie"
          />
          <span
            className="launcher-pulse"
            aria-hidden="true"
          />
        </button>
      )}

      {open && (
        <ChatbotPanel
          onClose={() =>
            setOpen(false)
          }
        />
      )}
    </div>
  );
}

function App() {
  return location.pathname.startsWith(
    '/provider'
  ) ? (
    <SupportProviderApp />
  ) : (
    <CustomerHost />
  );
}

createRoot(
  document.getElementById('root')!
).render(<App />);
