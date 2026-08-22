import { createRAG } from './rag/engine.js';
import type { Audience } from './rag/types.js';
import type { SupportedLanguage } from './types.js';

const rag = createRAG();

export function loadFaqs(): void {
  rag.reload();
}

export function getFaqs() {
  return [];
}

export function detectService(
  question: string,
  language: SupportedLanguage = 'en',
  audience: Audience = 'customer'
): string {
  return rag.search(question, language, audience).service;
}

export function findBestAnswer(
  question: string,
  language: SupportedLanguage = 'en',
  audience: Audience = 'customer'
) {
  return rag.search(question, language, audience);
}

export function getKnowledgeCount(): number {
  return rag.count();
}
