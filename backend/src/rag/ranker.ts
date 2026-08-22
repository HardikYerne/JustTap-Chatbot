import type { SupportedLanguage } from '../types.js';
import type { Candidate, RAGResult } from './types.js';
import { intentGroup } from './retriever.js';

function fallback(language: SupportedLanguage = 'en'): string {
  if (language === 'hi') return 'मुझे हमारे सपोर्ट डेटा में इसका विश्वसनीय उत्तर नहीं मिला।';
  if (language === 'mr') return 'मला आमच्या सपोर्ट डेटामध्ये याचे विश्वसनीय उत्तर सापडले नाही.';
  return "I couldn't find a reliable answer from our support information.";
}

function baseService(record: Candidate['record']): string {
  if (record.service.trim()) return record.service.trim();
  if (record.subService.trim()) return record.subService.trim();
  return record.category.trim();
}

function meaningfulEvidence(candidate: Candidate): number {
  return (
    candidate.questionHits +
    candidate.keywordHits +
    candidate.categoryHits +
    candidate.subServiceHits +
    (candidate.intentMatch ? 1 : 0) +
    Math.min(candidate.serviceEvidence, 2)
  );
}

export function rank(
  candidates: Candidate[],
  query = '',
  language: SupportedLanguage = 'en'
): RAGResult {
  if (!candidates.length) {
    return {
      matched: false,
      answer: fallback(language),
      score: 0,
      intent: 'unknown_query',
      service: '',
      candidates: 0,
      language,
    };
  }

  const normalizedQuery = query.trim().toLowerCase();

  const ranked = [...candidates].sort((a, b) => {
    const exactA = a.record.question.trim().toLowerCase() === normalizedQuery ? 1 : 0;
    const exactB = b.record.question.trim().toLowerCase() === normalizedQuery ? 1 : 0;

    if (exactA !== exactB) return exactB - exactA;

    const scoreDiff = b.score - a.score;
    if (Math.abs(scoreDiff) > 0.000001) return scoreDiff;

    const evidenceDiff = meaningfulEvidence(b) - meaningfulEvidence(a);
    if (evidenceDiff) return evidenceDiff;

    const specificityDiff =
      (b.record.subService ? 1 : 0) - (a.record.subService ? 1 : 0);
    if (specificityDiff) return specificityDiff;

    return a.record.id.localeCompare(b.record.id);
  });

  const best = ranked[0];
  const second = ranked[1];
  const evidence = meaningfulEvidence(best);
  const margin = second ? best.score - second.score : best.score;

  const q = query.toLowerCase();
  const serviceSearch =
    /\b(book|booking|reserve|reservation|schedule|hire|find|search|need|want)\b/i.test(q) &&
    !/\b(provider|professional|registration|commission|verification)\b/i.test(q);

  const exactMatch = best.record.question.trim().toLowerCase() === normalizedQuery;

  const genericDiscovery = intentGroup(best.record.intent) === 'find_service';

  // The generic service FAQ is intentionally service-agnostic. A query such
  // as "tell me about JustTap service" should not require a concrete
  // sub-service (pipe repair, tap repair, AC repair, etc.). The candidate was
  // already restricted to the find_service intent during retrieval, so use
  // general/query evidence here instead of requiring serviceEvidence.
  const genericDiscoveryReliable =
    genericDiscovery &&
    best.score >= 0.35 &&
    evidence >= 1 &&
    best.matchedTokens.some(t => !/^(book|booking|want|need|service|services|find|search|please|help|tell|about|just)$/i.test(t));

  const reliable =
    exactMatch ||
    genericDiscoveryReliable ||
    (
      best.score >= 0.55 &&
      evidence >= 2 &&
      (!serviceSearch || best.serviceEvidence > 0) &&
      best.matchedTokens.some(t =>
        !/^(book|booking|want|need|service|find|search|please|help)$/i.test(t)
      ) &&
      (best.score >= 0.75 || margin >= 0.02 || best.serviceEvidence >= 1)
    );

  console.log('[RANKER]', {
    bestId: best.record.id,
    bestScore: Number(best.score.toFixed(4)),
    secondScore: second ? Number(second.score.toFixed(4)) : null,
    margin: Number(margin.toFixed(4)),
    evidence,
    serviceEvidence: best.serviceEvidence,
    matchedTokens: best.matchedTokens,
    exactMatch,
    reliable,
  });

  if (!reliable) {
    return {
      matched: false,
      answer: fallback(language),
      score: Number(best.score.toFixed(4)),
      intent: 'unknown_query',
      service: '',
      faqId: best.record.id,
      candidates: ranked.length,
      language,
    };
  }

  return {
    matched: true,
    answer: best.record.answer,
    score: Number(best.score.toFixed(4)),
    intent: intentGroup(best.record.intent || 'unknown_query'),
    service: baseService(best.record),
    faqId: best.record.id,
    candidates: ranked.length,
    missingFields: [],
    language,
  };
}

export { baseService };
