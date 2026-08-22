export type Audience = 'customer' | 'provider';

export type SupportedLanguage = 'en' | 'hi' | 'mr';

export interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  createdAt: string;
  intent?: string;
}

export interface Ticket {
  id: string;
  sessionId: string;
  audience: Audience;
  question: string;
  status: 'unassigned' | 'in_progress' | 'resolved';
  createdAt: string;
  messages: Message[];
}

export interface Lead {
  id: string;
  sessionId: string;
  name: string;
  phone: string;
  service: string;
  location: string;
  requirement: string;
  createdAt: string;
  status: 'new' | 'contacted' | 'closed';
}

export interface PendingRequest {
  intent: string;
  service: string;
  location?: string;
  requestedTime?: string;
  name?: string;
  phone?: string;
  missingFields: string[];
  language: SupportedLanguage;
  audience: Audience;
  originalQuestion: string;
}

export interface Session {
  id: string;
  messages: Message[];
  awaitingTicketConfirmation: boolean;
  pendingQuestion: string;
  pendingRagQuestion: string;
  pendingMissingFields: string[];
  pendingRequest?: PendingRequest;
  language?: SupportedLanguage;
  audience?: Audience;
}
