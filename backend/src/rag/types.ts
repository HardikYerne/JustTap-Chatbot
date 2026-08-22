import type { SupportedLanguage } from '../types.js';

export type Audience = 'customer' | 'provider';

export interface KnowledgeRecord {
  id: string;
  language: string;
  audience: Audience;
  intent: string;
  category: string;
  service: string;
  subService: string;
  urgency: string;
  question: string;
  keywords: string[];
  answer: string;
  answerTemplate: string;
  source: string;
  active: boolean;
}

export interface Candidate {
  record: KnowledgeRecord;
  score: number;
  matchedTokens: string[];
  questionHits: number;
  keywordHits: number;
  categoryHits: number;
  subServiceHits: number;
  intentMatch: boolean;
  serviceEvidence: number;
  specificityPenalty: number;
}

export interface RAGResult {
  matched: boolean;
  answer: string;
  score: number;
  intent: string;
  service: string;
  faqId?: string;
  candidates: number;
  missingFields?: string[];
  language?: SupportedLanguage;
}
