import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { createRAG } from './rag/engine.js';

import {
  getSession,
  leads,
  makeId,
  persist,
  tickets
} from './store.js';

import { generateResponse } from './response/generator.js';
import { generalResponse } from './general.js';
import { routeConversation } from './response/router.js';

import type { Lead, Message, Ticket, SupportedLanguage, Audience } from './types.js';
import { languageService } from './language/service.js';
import {
  confirmationChoice,
  genericPrompt,
  locationPrompt,
  namePrompt,
  phonePrompt,
  priceUnavailable,
  requestReceived,
  serviceConfirmationPrompt,
  ticketPrompt,
  ticketCreated,
  ticketCancelled,
  timePrompt,
  chooseYesNo,
  localizeRagResult,
  fallbackMessage,
  errorMessage
} from './language/responses.js';

const app = express();
const rag = createRAG();
const PORT = Number(process.env.PORT || 4000);
const ADMIN = process.env.ADMIN_TOKEN || '';

const origins = (process.env.CORS_ORIGIN ||
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost')
  .split(',')
  .map(x => x.trim())
  .filter(Boolean);

app.disable('x-powered-by');

app.use(helmet({
  crossOriginResourcePolicy: false
}));

app.use(cors({
  origin(origin, cb) {
    if (!origin || origins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS origin not allowed: ${origin}`));
  },
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
}));

app.use(express.json({ limit: '32kb' }));

app.use(rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false
}));

function id(prefix: string): string {
  return makeId(prefix);
}

function getParamString(value: string | string[]): string {
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
}

function push(
  session: ReturnType<typeof getSession>,
  role: 'user' | 'bot',
  text: string,
  intent?: string
): Message {
  const message: Message = {
    id: id('MSG'),
    role,
    text,
    createdAt: new Date().toISOString(),
    intent
  };

  session.messages.push(message);
  return message;
}

function normalizeChoice(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isYes(value: string): boolean {
  return [
    'yes', 'yeah', 'yep', 'sure', 'ok', 'okay',
    'create', 'create it', 'please create', 'do it',
    'हां', 'हाँ', 'होय'
  ].includes(normalizeChoice(value));
}

function isNo(value: string): boolean {
  return [
    'no', 'nope', 'not now', 'cancel', 'dont', 'do not',
    'नहीं', 'नाही'
  ].includes(normalizeChoice(value));
}

function auth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (!ADMIN) {
    return res.status(503).json({
      error: 'Provider/admin API is not configured'
    });
  }

  const token = req.headers.authorization
    ?.replace(/^Bearer\s+/i, '');

  if (!token || token !== ADMIN) {
    return res.status(401).json({
      error: 'Unauthorized'
    });
  }

  next();
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'justtap-genie',
    rag: 'vectorless-dataset',
    knowledgeCount: rag.count()
  });
});

app.get('/api/support/faqs/meta', (_req, res) => {
  res.json({
    count: rag.count()
  });
});

app.post('/api/support/reload-faqs', auth, (_req, res) => {
  try {
    rag.reload();

    res.json({
      ok: true,
      count: rag.count()
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'FAQ reload failed'
    });
  }
});


// ============================================================
// GENERAL RESPONSE API
//
// This endpoint is intentionally independent from the RAG dataset.
// Use it for greetings, thanks, goodbye, and small talk.
// ============================================================

app.post('/api/support/general', (req, res) => {
  const message = String(req.body?.message || '').trim();
  const language = languageService.normalize(
    String(req.body?.language || 'en')
  );

  if (!message || message.length > 2000) {
    return res.status(400).json({
      error: 'message is required and must be <= 2000 characters'
    });
  }

  const result = generalResponse(message, language);

  if (!result.matched) {
    return res.status(404).json({
      matched: false,
      intent: null,
      answer: ''
    });
  }

  return res.json({
    type: 'general',
    ...result,
    language
  });
});

// ============================================================
// CHAT
// ============================================================

app.post('/api/support/chat', (req, res) => {
  let language: SupportedLanguage = 'en';

  try {
    const sessionId =
      String(req.body?.sessionId || '').trim();

    const message =
      String(req.body?.message || '').trim();

    language =
      languageService.normalize(
        String(req.body?.language || 'en')
      );

    const audience: Audience =
      req.body?.audience === 'provider'
        ? 'provider'
        : 'customer';

    if (!sessionId || sessionId.length > 120) {
      return res.status(400).json({
        error: 'valid sessionId is required'
      });
    }

    if (!message || message.length > 2000) {
      return res.status(400).json({
        error: 'message is required and must be <= 2000 characters'
      });
    }

    const session = getSession(sessionId);

    session.language = language;
    session.audience = audience;

    push(session, 'user', message);

    // --------------------------------------------------------
    // Ticket confirmation
    // --------------------------------------------------------

    // --------------------------------------------------------
    // GENERAL CONVERSATION
    //
    // General chat is intentionally outside RAG. It does not depend on
    // the knowledge dataset and never creates a ticket or service state.
    // All JustTap/service questions continue to the dataset RAG below.
    // --------------------------------------------------------
    const general = generalResponse(message, language);

    if (general.matched) {
      push(session, 'bot', general.answer, general.intent ?? undefined);
      persist();

      return res.json({
        type: 'general',
        matched: true,
        intent: general.intent,
        answer: general.answer,
        language,
      });
    }

    if (session.awaitingTicketConfirmation && session.pendingQuestion.trim()) {
      if (isYes(message)) {
        const now = new Date().toISOString();

        const ticket: Ticket = {
          id: id('TKT'),
          sessionId,
          audience,
          question: session.pendingQuestion,
          status: 'unassigned',
          createdAt: now,
          messages: [
            {
              id: id('MSG'),
              role: 'user',
              text: session.pendingQuestion,
              createdAt: now
            }
          ]
        };

        tickets.set(ticket.id, ticket);

        session.awaitingTicketConfirmation = false;
        session.pendingQuestion = '';
        session.pendingRagQuestion = '';
        session.pendingMissingFields = [];
        session.pendingRequest = undefined;

        const answer =
          ticketCreated(ticket.id, language);

        push(session, 'bot', answer);
        persist();

        return res.json({
          type: 'ticket_created',
          ticket,
          ticketId: ticket.id,
          answer,
          language
        });
      }

      if (isNo(message)) {
        session.awaitingTicketConfirmation = false;
        session.pendingQuestion = '';

        const answer =
          ticketCancelled(language);

        push(session, 'bot', answer);
        persist();

        return res.json({
          type: 'chat',
          answer,
          language
        });
      }

      // A message that is not yes/no is a new user query.
      // Do not trap it inside ticket confirmation.
      session.awaitingTicketConfirmation = false;
      session.pendingQuestion = '';
      session.pendingRagQuestion = '';

      const followUpResult = rag.search(message, language, audience);
      if (followUpResult.matched) {
        const generated = generateResponse(followUpResult, {
          language,
          service: followUpResult.service,
          query: message,
          missingFields: []
        });
        const answer = followUpResult.answer?.trim() || generated.answer;
        push(session, 'bot', answer, followUpResult.intent);
        persist();
        return res.json({
          type: followUpResult.intent === 'service_search' ? 'service_search' : 'chat',
          ...followUpResult,
          answer,
          language,
          missingFields: []
        });
      }

      session.awaitingTicketConfirmation = true;
      session.pendingQuestion = message;
      const answer = `${fallbackMessage(language)}\n\n${ticketPrompt(language)}`;
      push(session, 'bot', answer, 'unknown_query');
      persist();
      return res.json({ type: 'ticket_confirmation', answer, language });
    }

    // A bare yes/no is only a ticket confirmation when there is an active
    // ticket confirmation with a stored pending question. A service-search
    // response never asks for confirmation, so a later "yes" must not create
    // or request a support ticket because of stale session state.
    if (isYes(message) || isNo(message)) {
      const answer = language === 'hi'
        ? 'ठीक है। आप अपना अगला सवाल पूछ सकते हैं।'
        : language === 'mr'
          ? 'ठीक आहे. तुम्ही तुमचा पुढचा प्रश्न विचारू शकता.'
          : 'Okay. You can continue chatting and ask another question.';

      push(session, 'bot', answer);
      persist();
      return res.json({
        type: 'chat',
        answer,
        language
      });
    }

    // --------------------------------------------------------
    // ALL NORMAL QUERIES -> DATASET RAG
    //
    // This chatbot is service discovery/support. It does not book
    // services, collect name/phone, or create leads in chat.
    // A new message always gets a chance to become an independent
    // knowledge query; stale workflow state never traps it.
    // --------------------------------------------------------
    const result = rag.search(message, language, audience);

    if (result.matched) {
      session.awaitingTicketConfirmation = false;
      session.pendingQuestion = '';
      session.pendingRagQuestion = '';
      session.pendingMissingFields = [];
      session.pendingRequest = undefined;

      const generated = generateResponse(result, {
        language,
        service: result.service,
        query: message,
        missingFields: []
      });

      const answer = result.answer?.trim() || generated.answer;
      push(session, 'bot', answer, result.intent);
      persist();

      return res.json({
        type: ['service_search', 'find_service'].includes(result.intent) ? 'service_search' : 'chat',
        ...result,
        answer,
        language,
        missingFields: []
      });
    }
    // --------------------------------------------------------
    // No reliable match -> ticket offer.
    // --------------------------------------------------------

    session.awaitingTicketConfirmation = true;
    session.pendingQuestion = message;
    session.pendingRagQuestion = '';
    session.pendingMissingFields = [];
    session.pendingRequest = undefined;

    const answer =
      `${fallbackMessage(language)}\n\n${ticketPrompt(language)}`;

    push(
      session,
      'bot',
      answer,
      result.intent
    );

    persist();

    return res.json({
      type: 'ticket_confirmation',
      ...result,
      answer,
      language
    });

  } catch (error) {
    console.error('Chat API error:', error);

    return res.status(500).json({
      type: 'error',
      error: 'Internal support service error',
      answer: errorMessage(language),
      language
    });
  }
});


// ============================================================
// SESSION MESSAGES
// ============================================================

app.get(
  '/api/support/messages/:sessionId',
  (req, res) => {
    const sessionId = getParamString(req.params.sessionId);
    res.json(getSession(sessionId).messages);
  }
);


// ============================================================
// LEADS
// ============================================================

app.post('/api/support/leads', (req, res) => {
  const lead: Lead = {
    id: id('LEAD'),
    sessionId: String(req.body?.sessionId || ''),
    name: String(req.body?.name || '').trim(),
    phone: String(req.body?.phone || '').trim(),
    service: String(req.body?.service || '').trim(),
    location: String(req.body?.location || '').trim(),
    requirement: String(req.body?.requirement || '').trim(),
    createdAt: new Date().toISOString(),
    status: 'new'
  };

  if (
    !lead.sessionId ||
    !lead.name ||
    !lead.phone ||
    !lead.service
  ) {
    return res.status(400).json({
      error:
        'sessionId, name, phone and service are required'
    });
  }

  leads.set(lead.id, lead);
  persist();

  return res.status(201).json(lead);
});


// ============================================================
// PROVIDER / ADMIN
// ============================================================

app.get('/api/support/tickets', auth, (_req, res) => {
  res.json([...tickets.values()]);
});

app.get('/api/support/leads', auth, (_req, res) => {
  res.json([...leads.values()]);
});

app.get('/api/support/customers', auth, (_req, res) => {
  const bySession = new Map<
    string,
    {
      sessionId: string;
      tickets: number;
      lastActivity: string;
    }
  >();

  for (const ticket of tickets.values()) {
    const existing = bySession.get(ticket.sessionId);

    if (!existing) {
      bySession.set(ticket.sessionId, {
        sessionId: ticket.sessionId,
        tickets: 1,
        lastActivity: ticket.createdAt
      });
    } else {
      existing.tickets++;

      if (
        ticket.createdAt >
        existing.lastActivity
      ) {
        existing.lastActivity = ticket.createdAt;
      }
    }
  }

  res.json(
    [...bySession.values()]
      .sort((a, b) =>
        b.lastActivity.localeCompare(a.lastActivity)
      )
  );
});

app.post('/api/support/tickets', auth, (req, res) => {
  const question = String(
    req.body?.question || ''
  ).trim();

  if (!question) {
    return res.status(400).json({
      error: 'question is required'
    });
  }

  const ticket: Ticket = {
    id: id('TKT'),
    sessionId: String(
      req.body?.sessionId || ''
    ),
    audience:
      req.body?.audience === 'provider'
        ? 'provider'
        : 'customer',
    question,
    status: 'unassigned',
    createdAt: new Date().toISOString(),
    messages: []
  };

  tickets.set(ticket.id, ticket);
  persist();

  return res.status(201).json(ticket);
});

app.post(
  '/api/support/tickets/:id/claim',
  auth,
  (req, res) => {
    const ticketId = String(req.params.id);

    const ticket = tickets.get(ticketId);

    if (!ticket) {
      return res.status(404).json({
        error: 'ticket not found'
      });
    }

    ticket.status = 'in_progress';
    persist();

    return res.json(ticket);
  }
);

app.post(
  '/api/support/tickets/:id/reply',
  auth,
  (req, res) => {
    const ticketId = String(req.params.id);

    const ticket = tickets.get(ticketId);
    const text =
      String(req.body?.text || '').trim();

    if (!ticket) {
      return res.status(404).json({
        error: 'ticket not found'
      });
    }

    if (!text || text.length > 4000) {
      return res.status(400).json({
        error: 'valid text is required'
      });
    }

    ticket.status = 'in_progress';

    ticket.messages.push({
      id: id('MSG'),
      role: 'bot',
      text,
      createdAt: new Date().toISOString()
    });

    persist();

    return res.json(ticket);
  }
);

app.patch(
  '/api/support/tickets/:id/resolve',
  auth,
  (req, res) => {
    const ticketId = String(req.params.id);

    const ticket = tickets.get(ticketId);

    if (!ticket) {
      return res.status(404).json({
        error: 'ticket not found'
      });
    }

    ticket.status = 'resolved';
    persist();

    return res.json(ticket);
  }
);


// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
  (
    error: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (
      String(error?.message || '')
        .startsWith('CORS origin not allowed')
    ) {
      return res.status(403).json({
        error: 'CORS origin not allowed'
      });
    }

    console.error(error);

    return res.status(500).json({
      error: 'Internal server error'
    });
  }
);

const server = app.listen(PORT, () => {
  console.log(
    `JustTap Genie API listening on http://localhost:${PORT}`
  );
});

const shutdown = () => {
  try {
    persist();
  } finally {
    server.close(() => process.exit(0));
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
