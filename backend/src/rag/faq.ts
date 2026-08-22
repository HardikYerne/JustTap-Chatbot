import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

import type { Audience, RAGResult } from './types.js';
import type { SupportedLanguage } from '../types.js';

export interface FAQ {
  id: string;
  language: string;
  audience: Audience;
  intent: string;
  category: string;
  subService: string;
  urgency: string;
  query: string;
  keywords: string[];
  answer: string;
  answerTemplate: string;
  source: string;
  active: boolean;
}

const DATA_ROOT = path.resolve(
  process.env.JUSTTAP_KNOWLEDGE_DIR || path.join(process.cwd(), 'data', 'knowledge'),
);

let faqs: FAQ[] = [];

export const normalize = (value: string): string =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function stem(token: string): string {
  const t = normalize(token);
  if (t.length <= 4) return t;
  return t
    .replace(/(?:ing|ers|er|ed|es|s)$/i, '')
    .replace(/(.)\1$/, '$1');
}

function tokenSet(value: string): Set<string> {
  return new Set(
    normalize(value)
      .split(' ')
      .filter(Boolean)
      .map(stem),
  );
}

function overlap(query: Set<string>, candidate: Set<string>): number {
  if (!query.size || !candidate.size) return 0;
  let hits = 0;
  for (const token of query) if (candidate.has(token)) hits += 1;
  return hits;
}

function editDistance(a: string, b: string): number {
  const aa = normalize(a);
  const bb = normalize(b);
  const row = Array.from({ length: bb.length + 1 }, (_, i) => i);
  for (let i = 1; i <= aa.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= bb.length; j += 1) {
      const old = row[j];
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = old;
    }
  }
  return row[bb.length];
}

function stringValue(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function keywordList(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keywordList);
  return String(value ?? '')
    .split(/[|;,\n]/)
    .map(normalize)
    .filter(Boolean);
}

function normalizeRow(row: Record<string, unknown>, file: string, rowNumber: number): FAQ {
  const id = stringValue(row, 'id', 'faq_id', 'question_id') || `${path.basename(file)}-${rowNumber}`;
  const query = stringValue(row, 'question', 'query', 'text', 'canonical_question', 'user_query', 'utterance');
  const answer = stringValue(row, 'answer', 'response', 'response_text', 'solution');
  if (!query || !answer) {
    throw new Error(`Knowledge file ${path.basename(file)} row ${rowNumber}: missing question/answer`);
  }

  const audienceRaw = normalize(stringValue(row, 'audience', 'user_type') || 'customer');
  const audience: Audience = audienceRaw === 'provider' ? 'provider' : 'customer';

  return {
    id,
    language: normalize(stringValue(row, 'language', 'lang') || 'en') || 'en',
    audience,
    intent: stringValue(row, 'intent', 'intent_name') || 'unknown_query',
    category: stringValue(
      row,
      'category',
      'service_category',
      'serviceCategory',
      'service_type',
      'serviceType',
    ),
    subService: stringValue(
      row,
      'sub_service',
      'subService',
      'subservice',
      'service',
      'service_name',
      'serviceName',
      'provider_service',
    ),
    urgency: stringValue(row, 'urgency'),
    query,
    keywords: keywordList(row.keywords),
    answer,
    answerTemplate: stringValue(row, 'answer_template', 'answerTemplate'),
    source: stringValue(row, 'source') || path.basename(file),
    active: !['false', '0', 'no', 'inactive', 'disabled'].includes(
      normalize(stringValue(row, 'active', 'is_active') || 'true'),
    ),
  };
}

function dataFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'runtime') out.push(...dataFiles(full));
    else if (entry.isFile() && /\.(csv|json|jsonl)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function loadFile(file: string): FAQ[] {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.csv') {
    const rows = parse(fs.readFileSync(file, 'utf8'), {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      relax_quotes: true,
      relax_column_count: true,
      trim: true,
    }) as Record<string, unknown>[];
    return rows.map((row, i) => normalizeRow(row, file, i + 2));
  }

  if (ext === '.jsonl') {
    return fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map(x => x.trim())
      .filter(Boolean)
      .map((x, i) => normalizeRow(JSON.parse(x), file, i + 1));
  }

  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  const rows = Array.isArray(raw)
    ? raw
    : (raw && typeof raw === 'object' && Array.isArray((raw as any).faqs))
      ? (raw as any).faqs
      : [];
  return rows.map((row: Record<string, unknown>, i: number) => normalizeRow(row, file, i + 1));
}

export function loadFaqs(): void {
  const files = dataFiles(DATA_ROOT);
  const loaded: FAQ[] = [];
  for (const file of files) {
    try {
      loaded.push(...loadFile(file));
    } catch (error) {
      console.error(`[RAG] Failed to load ${file}:`, error);
    }
  }
  faqs = loaded.filter(x => x.active);
  console.log(`[RAG] Loaded ${faqs.length} knowledge records`);
}

export function getKnowledgeCount(): number {
  return faqs.length;
}

function serviceTerms(faq: FAQ): Set<string> {
  const generic = new Set([
    'book', 'booking', 'want', 'need', 'find', 'hire',
    'service', 'services', 'please', 'help', 'provide',
    'provides', 'provide', 'looking', 'for',
  ]);

  const values = [
    faq.category,
    faq.subService,
    faq.query,
    ...faq.keywords,
  ];

  const terms = new Set<string>();
  for (const value of values) {
    for (const token of tokenSet(value)) {
      if (token.length >= 3 && !generic.has(token)) terms.add(token);
    }
  }
  return terms;
}

/** Dataset-driven service detection. No service or city names are hardcoded. */
export function detectService(question: string): string {
  const q = tokenSet(question);
  if (!q.size) return '';

  const generic = new Set([
    'book', 'booking', 'want', 'need', 'find', 'hire',
    'service', 'services', 'please', 'help', 'provide',
    'provides', 'looking', 'for',
  ]);

  const scores = new Map<string, number>();

  for (const faq of faqs) {
    const label = normalize(faq.subService || faq.category);
    if (!label) continue;

    const terms = serviceTerms(faq);
    const exact = [...q].filter(t => !generic.has(t) && terms.has(t)).length;

    if (exact > 0) {
      // Prefer direct sub-service/category evidence. Query/keyword evidence
      // is included in terms so datasets that store service only in the
      // question or keywords still work.
      const labelTerms = new Set([
        ...tokenSet(faq.subService),
        ...tokenSet(faq.category),
      ]);
      const labelExact = [...q].filter(t => !generic.has(t) && labelTerms.has(t)).length;
      scores.set(label, (scores.get(label) || 0) + exact + labelExact * 1.5);
    }

    // Dataset-derived typo tolerance.
    for (const qt of q) {
      if (generic.has(qt) || qt.length < 4) continue;
      for (const st of terms) {
        if (st.length < 4) continue;
        const limit = st.length >= 7 ? 2 : 1;
        if (Math.abs(qt.length - st.length) <= limit && editDistance(qt, st) <= limit) {
          scores.set(label, (scores.get(label) || 0) + 0.75);
        }
      }
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0]?.[0] || '';
}

function intentFamily(intent: string): string {
  const i = normalize(intent).replace(/_/g, ' ');
  if (/\b(greeting|hello|welcome)\b/.test(i)) return 'greeting';
  if (/\b(price|pricing|cost|charge|fee|rate)\b/.test(i)) return 'price';
  if (/\b(availability|available|slot)\b/.test(i)) return 'availability';
  if (/\b(book|booking|schedule|hire|reserve|find|search)\b/.test(i)) return 'service_search';
  return i || 'unknown_query';
}

function queryIntent(question: string): string {
  const q = normalize(question);
  if (/^(hi|hello|hey|hiya|good morning|good afternoon|good evening)$/.test(q)) return 'greeting';
  if (/\b(price|pricing|cost|charge|fee|rate|how much)\b/.test(q)) return 'price';
  if (/\b(available|availability|slot|when can)\b/.test(q)) return 'availability';
  if (/\b(book|booking|schedule|hire|reserve|find|search|looking for|need a|want a)\b/.test(q)) return 'service_search';
  return 'unknown_query';
}

function candidateScore(question: string, faq: FAQ, requestedService: string, requestedIntent: string): number {
  const q = tokenSet(question);
  const questionTokens = tokenSet(faq.query);
  const keywordTokens = new Set(faq.keywords.flatMap(x => [...tokenSet(x)]));
  const categoryTokens = tokenSet(faq.category);
  const subServiceTokens = tokenSet(faq.subService);

  const qHits = overlap(q, questionTokens);
  const keywordHits = overlap(q, keywordTokens);
  const categoryHits = overlap(q, categoryTokens);
  const subHits = overlap(q, subServiceTokens);

  // Service evidence must come from the dataset itself.
  // `plumber` and `plumbing`, for example, normalize to the same stem.
  // This prevents generic words such as "book" from selecting an unrelated
  // dataset record.
  const serviceEvidence = subHits + categoryHits;

  let score =
    qHits * 0.42 +
    keywordHits * 0.30 +
    categoryHits * 0.16 +
    subHits * 0.22;

  const candidateIntent = intentFamily(faq.intent);
  if (requestedIntent !== 'unknown_query' && candidateIntent === requestedIntent) {
    score += 0.65;
  }

  if (requestedService) {
    const requestedTerms = tokenSet(requestedService);
    const candidateTerms = new Set([
      ...categoryTokens,
      ...subServiceTokens,
      ...keywordTokens,
    ]);

    if (overlap(requestedTerms, candidateTerms) > 0) {
      score += 1.20;
    } else {
      score -= 0.75;
    }
  }

  // Never let a specific emergency record answer an ordinary request.
  if (normalize(faq.urgency).includes('emergency') && !/\b(emergency|urgent|asap|immediately)\b/i.test(question)) {
    return -Infinity;
  }

  // Specific sub-service records need evidence in the query; otherwise
  // they must not beat a generic service-level record.
  if (faq.subService) {
    const sub = tokenSet(faq.subService);
    const hits = overlap(q, sub);
    if (hits === 0 && requestedService) score -= 0.8;
  }

  return score;
}

export function findBestAnswer(question: string, language = 'en', audience: Audience = 'customer'): RAGResult {
  const q = normalize(question);
  if (!q) return { matched: false, answer: '', score: 0, intent: 'unknown_query', service: '', candidates: 0, missingFields: [] };

  const requestedService = detectService(question);
  const requestedIntent = queryIntent(question);

  if (requestedIntent === 'service_search' && requestedService) {
    const generic = faqs.find(f =>
      f.active &&
      f.audience === audience &&
      f.language === language &&
      /^(find_service|service_search)$/.test(f.intent) &&
      !f.subService?.trim() &&
      !/emergency|urgent/i.test(f.urgency || '') &&
      !/emergency/i.test(f.answer)
    );
    if (generic) {
      return {
        matched: true,
        answer: generic.answer,
        score: 1,
        intent: 'find_service',
        service: requestedService,
        faqId: generic.id,
        candidates: 1,
        missingFields: [],
        language: language as SupportedLanguage,
      };
    }
  }

  let pool = faqs.filter(f => f.audience === audience && (f.language === language));
  if (!pool.length) pool = [];

  const ranked = pool
    .map(faq => ({ faq, score: candidateScore(question, faq, requestedService, requestedIntent) }))
    .filter(x => Number.isFinite(x.score))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best) return { matched: false, answer: '', score: 0, intent: 'unknown_query', service: requestedService, candidates: 0, missingFields: [] };

  // Dataset-grounded confidence. A service query must have actual dataset evidence.
  const qTokenCount = tokenSet(question).size;
  const confidence = best.score >= 0.75 || (best.score >= 0.45 && qTokenCount <= 3);
  if (!confidence) {
    return { matched: false, answer: '', score: best.score, intent: 'unknown_query', service: requestedService, faqId: best.faq.id, candidates: ranked.length, missingFields: [] };
  }

  const service = requestedService || normalize(best.faq.category || best.faq.subService);
  return {
    matched: true,
    answer: best.faq.answer,
    score: best.score,
    intent: intentFamily(best.faq.intent),
    service,
    faqId: best.faq.id,
    candidates: ranked.length,
    missingFields: [],
    language: language as SupportedLanguage,
  };
}

loadFaqs();
