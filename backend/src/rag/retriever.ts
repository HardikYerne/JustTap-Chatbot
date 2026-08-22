import type { Audience, Candidate, KnowledgeRecord } from './types.js';
import type { KnowledgeIndex } from './indexer.js';
import { normalizeText, tokenize } from './normalize.js';

const GENERIC = new Set([
  'book', 'booking', 'reserve', 'reservation', 'schedule', 'hire', 'find', 'search',
  'service', 'services', 'want', 'need', 'please', 'help', 'looking', 'look', 'for',
  'get', 'give', 'tell', 'can', 'could', 'would', 'i', 'me', 'my', 'the', 'a', 'an', 'to',
  'how', 'what', 'where', 'when', 'why', 'is', 'are', 'do', 'does', 'did', 'just',
  'as', 'someone', 'something', 'send', 'provide'
]);

const SPECIFIC_TIME_WORDS = /\b(emergency|urgent|urgently|asap|immediately|today|tomorrow|tonight|morning|afternoon|evening|night|weekend|next week|in an hour|right now|day after tomorrow)\b/i;

export interface ServiceResolution {
  category: string;
  subService: string;
  specificity: 'none' | 'category' | 'sub_service';
  confidence: number;
}

function intentGroup(intent: string): string {
  const x = normalizeText(intent).replace(/\s+/g, '_');
  if (/what_is_justtap/.test(x)) return 'what_is_justtap';
  if (/how_to_book/.test(x)) return 'how_to_book';
  if (/find_service/.test(x)) return 'find_service';
  if (/become_provider/.test(x)) return 'become_provider';
  if (/provider_registration/.test(x)) return 'provider_registration';
  if (/provider_documents/.test(x)) return 'provider_documents';
  if (/provider_commission/.test(x)) return 'provider_commission';
  if (/provider_payment/.test(x)) return 'provider_payment';
  if (/provider_verification/.test(x)) return 'provider_verification';
  if (/cancel|cancellation/.test(x)) return 'cancel_booking';
  if (/emergency|urgent/.test(x)) return 'emergency_request';
  if (/complaint|complain|issue|problem/.test(x)) return 'complaint';
  if (/payment|pay|refund|transaction|price|cost|fee|charge|rate/.test(x)) return 'ask_price';
  if (/find|search|availability|available|locate|check/.test(x)) return 'check_availability';
  if (/book|booking|reserve|reservation|schedule|hire/.test(x)) return 'book_service';
  if (/general|info|information/.test(x)) return 'general_info';
  return x || 'unknown';
}

export function queryIntent(query: string, serviceKnown = false): string {
  const x = normalizeText(query);

  // General company questions must be resolved before generic service discovery.
  // Example: "tell me about JustTap service" is asking what JustTap is, not
  // how to find a service. Plural "services" remains service discovery.
  if (/\b(what is justtap|about justtap|tell me about justtap|who is justtap|what does justtap do|justtap service)\b/.test(x) &&
      !/\b(justtap services|what services does justtap|services does justtap offer)\b/.test(x)) {
    return 'what_is_justtap';
  }
  if (/\b(how does justtap work|how justtap works|how does justtap)\b/.test(x)) return 'how_justtap_works';
  if (/\b(justtap services|what services does justtap|services does justtap offer|tell me about justtap services)\b/.test(x)) return 'find_service';
  if (/\b(justtap locations|where does justtap operate|where is justtap available)\b/.test(x)) return 'justtap_locations';
  if (/\b(contact justtap|contact customer support|contact support)\b/.test(x)) return 'contact_justtap';

  if (/\b(become|join|work as|register as|registration|sign up)\b/.test(x) && /\b(provider|professional|technician)\b/.test(x)) {
    if (/\b(document|documents|paperwork|proof)\b/.test(x)) return 'provider_documents';
    if (/\bcommission\b/.test(x)) return 'provider_commission';
    if (/\b(payment|paid|payout)\b/.test(x)) return 'provider_payment';
    if (/\b(verif|verify|verification)\b/.test(x)) return 'provider_verification';
    if (/\b(register|registration|sign up)\b/.test(x)) return 'provider_registration';
    return 'become_provider';
  }

  if (/\b(provider|professional|technician)\b/.test(x)) {
    if (/\b(document|documents|paperwork|proof)\b/.test(x)) return 'provider_documents';
    if (/\bcommission\b/.test(x)) return 'provider_commission';
    if (/\b(payment|paid|payout)\b/.test(x)) return 'provider_payment';
    if (/\b(verif|verify|verification)\b/.test(x)) return 'provider_verification';
    if (/\b(register|registration|sign up)\b/.test(x)) return 'provider_registration';
    if (/\bbecome|join|work\b/.test(x)) return 'become_provider';
  }

  if (/\b(cancel|cancellation)\b/.test(x)) return 'cancel_booking';
  if (/\b(emergency|urgent|urgently|asap|immediately)\b/.test(x)) return 'emergency_request';
  if (/\b(complaint|complain|problem|issue)\b/.test(x)) return 'complaint';
  if (/\b(payment|pay|refund|transaction|price|cost|fee|charge|rate|how much)\b/.test(x)) return 'ask_price';
  if (/\b(available|availability|locate|check availability)\b/.test(x)) return 'check_availability';

  // A broad service request is service discovery, not a booking completion.
  if (/\b(book|booking|reserve|reservation|hire)\b/.test(x) && serviceKnown && !SPECIFIC_TIME_WORDS.test(x)) {
    return 'find_service';
  }
  if (/\b(need|want)\b/.test(x) && serviceKnown && !SPECIFIC_TIME_WORDS.test(x)) {
    return 'find_service';
  }
  if (/\b(need|want)\b/.test(x) && serviceKnown && SPECIFIC_TIME_WORDS.test(x)) {
    return 'book_service';
  }
  if (/\b(find|search|looking for|look for)\b/.test(x) && serviceKnown) return 'find_service';

  // Natural-language support requests such as "can someone help with AC repair?"
  // are service discovery requests, not pricing/unknown queries.
  if (/\b(help|assist|support|someone)\b/.test(x) && serviceKnown) return 'find_service';
  if (/\bhow to book\b|\bhow do i book\b|\bhow can i book\b/.test(x)) return 'how_to_book';
  if (/\b(book|booking|reserve|reservation|schedule|hire)\b/.test(x)) return 'book_service';
  if (/\b(find|search|locate|check)\b/.test(x)) return 'check_availability';

  return 'unknown';
}

export function queryAudience(query: string, fallback: Audience): Audience {
  const x = normalizeText(query);
  return /\b(provider|professional|service provider)\b/.test(x) ? 'provider' : fallback;
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const old = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = old;
    }
  }
  return row[b.length];
}

function fuzzy(a: string, b: string): boolean {
  if (a === b) return true;
  // Short aliases must be exact tokens. This prevents "ac" from matching
  // unrelated words such as "practice".
  if (a.length < 4 || b.length < 4) return false;
  const d = editDistance(a, b);
  return d <= Math.max(1, Math.floor(Math.max(a.length, b.length) * 0.22));
}

function phraseInQuery(query: string, phrase: string): boolean {
  if (!phrase) return false;
  const q = ` ${normalizeText(query)} `;
  const p = ` ${normalizeText(phrase)} `;
  return q.includes(p);
}

function idf(index: KnowledgeIndex, token: string): number {
  return Math.log((index.records.length + 1) / ((index.documentFrequency.get(token) ?? 0) + 1)) + 1;
}

function fields(record: KnowledgeRecord) {
  return {
    question: new Set(tokenize(record.question)),
    keywords: new Set(record.keywords.flatMap(tokenize)),
    category: new Set(tokenize(record.category)),
    service: new Set(tokenize(record.service)),
    subService: new Set(tokenize(record.subService)),
    intent: new Set(tokenize(record.intent)),
  };
}

function serviceEvidence(
  queryTokens: string[],
  f: ReturnType<typeof fields>,
  resolution: ServiceResolution
) {
  const all = new Set([...f.service, ...f.subService]);
  const matched: string[] = [];
  let score = 0;

  for (const token of queryTokens) {
    if (GENERIC.has(token)) continue;
    if (all.has(token)) {
      matched.push(token);
      score += 1;
      continue;
    }
    for (const t of all) {
      if (fuzzy(token, t)) {
        matched.push(token);
        score += 0.8;
        break;
      }
    }
  }

  if (resolution.category && normalizeText(resolution.category) === normalizeText('')) {
    score += 0;
  }

  return { score, matched: [...new Set(matched)] };
}

function rawQueryWords(query: string): string[] {
  return [...new Set(
    normalizeText(query)
      .split(' ')
      .filter(Boolean)
      .filter(token => token.length >= 2)
  )];
}

function bestAliasCategory(queryTokens: string[], index: KnowledgeIndex): { category: string; score: number } | null {
  const scores = new Map<string, number>();

  for (const token of queryTokens) {
    const categories = index.serviceAliasCategories.get(token);
    if (categories) {
      for (const [category, count] of categories) {
        scores.set(category, (scores.get(category) ?? 0) + Math.log1p(count));
      }
      continue;
    }

    if (token.length < 4) continue;

    for (const [alias, categories] of index.serviceAliasCategories) {
      if (!fuzzy(token, alias)) continue;
      for (const [category, count] of categories) {
        scores.set(category, (scores.get(category) ?? 0) + Math.log1p(count) * 0.8);
      }
    }
  }

  if (!scores.size) return null;

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [category, score] = ranked[0];
  const second = ranked[1]?.[1] ?? 0;

  // Do not manufacture a category when the alias evidence is ambiguous.
  if (score < 1 || (second > 0 && score / second < 1.15)) return null;

  return { category, score };
}

export function resolveService(query: string, index: KnowledgeIndex): ServiceResolution {
  const normalized = normalizeText(query);
  const queryTokens = tokenize(query).filter(token => !GENERIC.has(token));
  const rawTokens = rawQueryWords(query).filter(token => !GENERIC.has(token));

  // 1. Exact sub-service phrase is the strongest signal.
  const subServices = [...index.subServiceToRecords.keys()]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const subService of subServices) {
    if (!phraseInQuery(normalized, subService)) continue;

    const ids = index.subServiceToRecords.get(subService) ?? new Set<number>();
    const categories = new Map<string, number>();
    for (const id of ids) {
      const category = index.records[id]?.category?.trim();
      if (category) categories.set(category, (categories.get(category) ?? 0) + 1);
    }

    const category = [...categories.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    return {
      category,
      subService,
      specificity: 'sub_service',
      confidence: 1,
    };
  }

  // 2. Exact category phrase.
  for (const category of index.categoryToRecords.keys()) {
    if (phraseInQuery(normalized, category)) {
      return {
        category,
        subService: '',
        specificity: 'category',
        confidence: 0.98,
      };
    }
  }

  // 3. Explicit canonical aliases have priority over noisy keyword evidence.
  // Example: "plumber" must resolve to Plumbing even if the word appears
  // in many Emergency Services FAQ keywords.
  for (const token of rawTokens) {
    const canonicalCategory = index.serviceAliases.get(token);
    if (canonicalCategory) {
      return {
        category: canonicalCategory,
        subService: '',
        specificity: 'category',
        confidence: 0.97,
      };
    }
  }

  // 4. Dataset-learned aliases from keywords/sub-services.
  const alias = bestAliasCategory(rawTokens, index);
  if (alias) {
    return {
      category: alias.category,
      subService: '',
      specificity: 'category',
      confidence: Math.min(0.95, 0.55 + alias.score / 20),
    };
  }

  return {
    category: '',
    subService: '',
    specificity: 'none',
    confidence: 0,
  };
}

export function detectService(query: string, index: KnowledgeIndex): string {
  const resolved = resolveService(query, index);
  return resolved.subService || resolved.category;
}

function urgencyCompatible(query: string, urgency: string): boolean {
  const u = normalizeText(urgency).replace(/_/g, ' ');
  if (!u || /normal|none|not applicable|na/.test(u)) return true;

  const q = normalizeText(query);

  // Emergency records are semantically different. Never use them unless the
  // user explicitly asks for urgency/emergency service.
  if (/emergency|urgent/.test(u)) {
    return /\b(emergency|urgent|asap|immediately)\b/.test(q);
  }

  // "scheduled" and "same day" are dataset variants, not hard requirements.
  // A generic service request may match either variant; explicit time/urgency
  // is handled as ranking evidence rather than a destructive filter.
  return true;
}

function hasEmergencyRequest(query: string): boolean {
  return /\b(emergency|urgent|urgently|asap|immediately)\b/i.test(normalizeText(query));
}

function hasTimeRequest(query: string): boolean {
  return /\b(today|tomorrow|tonight|morning|afternoon|evening|night|weekend|next week|in an hour|day after tomorrow)\b/i.test(normalizeText(query));
}

function hasLocationRequest(query: string): boolean {
  const q = normalizeText(query);
  return /\b(in|at|near|around|from)\b/i.test(q);
}

function recordHasLocation(record: KnowledgeRecord, index: KnowledgeIndex): boolean {
  const text = normalizeText([
    record.question,
    record.answer,
    record.keywords.join(' '),
  ].join(' '));

  return [...index.locationPhrases].some(location => phraseInQuery(text, location));
}

function requestedLocations(query: string): string[] {
  const q = normalizeText(query);
  const out: string[] = [];
  for (const match of q.matchAll(/\b(?:in|at|near|around)\s+([a-z][a-z\s-]{2,40})/gi)) {
    let phrase = normalizeText(match[1] || '');
    phrase = phrase.split(/\b(?:please|thank|thanks|if|waiting|preferably|today|tomorrow|tonight|this|next|asap|right now)\b/i)[0].trim();
    if (phrase) out.push(phrase);
  }
  return [...new Set(out)];
}

function locationEvidence(query: string, record: KnowledgeRecord, index: KnowledgeIndex): number {
  const requested = requestedLocations(query);
  if (!requested.length) return 0;
  const recordText = normalizeText([record.question, record.answer, record.keywords.join(' ')].join(' '));
  if (requested.some(location => phraseInQuery(recordText, location))) return 1;
  if (recordHasLocation(record, index)) return -0.65;
  return 0;
}

function recordHasTime(record: KnowledgeRecord): boolean {
  const text = normalizeText([
    record.question,
    record.keywords.join(' '),
    record.urgency,
  ].join(' '));
  return /\b(today|tomorrow|tonight|morning|afternoon|evening|night|weekend|next week|in an hour|day after tomorrow)\b/i.test(text);
}

function requestedTimePhrases(query: string): string[] {
  const q = normalizeText(query);
  const phrases = [
    'day after tomorrow', 'next week', 'this weekend', 'in an hour',
    'as soon as possible', 'right now', 'tomorrow', 'today', 'tonight',
    'morning', 'afternoon', 'evening', 'night', 'weekend'
  ];

  const found = phrases.filter(phrase => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(q);
  }).sort((a, b) => b.length - a.length);

  const selected: string[] = [];
  for (const phrase of found) {
    if (!selected.some(existing => existing.includes(phrase))) selected.push(phrase);
  }
  return selected;
}


function timeEvidence(query: string, record: KnowledgeRecord): number {
  const requested = requestedTimePhrases(query);
  if (!requested.length) return 0;

  const recordText = normalizeText([record.question, record.keywords.join(' '), record.urgency].join(' '));
  const recordTimes = requestedTimePhrases(recordText);

  // Prefer the most specific time phrase. "tomorrow" must not match
  // "day after tomorrow".
  const exact = requested.some(time => recordTimes.includes(time));
  if (exact) return 1;
  if (recordTimes.length) return -0.65;
  return 0;
}


function addSet(target: Set<number>, source?: Set<number>): void {
  if (!source) return;
  for (const id of source) target.add(id);
}

function compatibleIntent(queryIntentName: string, recordIntent: string): boolean {
  if (queryIntentName === 'unknown') return true;
  const ri = intentGroup(recordIntent);

  if (ri === queryIntentName) return true;
  if (queryIntentName === 'find_service') {
    return ri === 'find_service' || ri === 'general_info' || ri === 'book_service' || ri === 'check_availability';
  }
  if (queryIntentName === 'ask_price') return ri === 'ask_price' || ri === 'general_info';
  if (queryIntentName === 'check_availability') return ri === 'check_availability' || ri === 'general_info';
  return false;
}

export function retrieve(
  query: string,
  index: KnowledgeIndex,
  language: string,
  audience: Audience,
  limit = 30
): Candidate[] {
  const tokens = tokenize(query);
  if (!tokens.length) return [];

  const effectiveAudience = queryAudience(query, audience);
  const resolution = resolveService(query, index);
  const qIntent = queryIntent(query, resolution.specificity !== 'none');
  const candidateIds = new Set<number>();

  // Primary retrieval: use the strongest structured dimensions first.
  if (resolution.subService) {
    addSet(candidateIds, index.subServiceToRecords.get(normalizeText(resolution.subService)));
  }

  if (resolution.category) {
    addSet(candidateIds, index.categoryToRecords.get(normalizeText(resolution.category)));
  }

  addSet(candidateIds, index.intentToRecords.get(normalizeText(qIntent)));

  // Secondary retrieval: only selective tokens enter the generic inverted index.
  for (const token of tokens) {
    if (GENERIC.has(token)) continue;
    addSet(candidateIds, index.tokenToRecords.get(token));
  }

  // Service aliases are allowed to contribute candidates even when their token
  // is common enough to be excluded from the generic inverted index.
  for (const token of tokens.filter(t => t.length >= 2 && !GENERIC.has(t))) {
    addSet(candidateIds, index.serviceTokenToRecords.get(token));

    if (token.length >= 4) {
      for (const serviceToken of index.serviceVocabulary) {
        if (!fuzzy(token, serviceToken)) continue;
        addSet(candidateIds, index.serviceTokenToRecords.get(serviceToken));
      }
    }
  }

  const totalWeight = tokens.reduce((s, t) => s + idf(index, t), 0);
  const out: Candidate[] = [];
  const requestedLanguage = normalizeText(language || 'en').toLowerCase();
  const requestedLocationList = requestedLocations(query);
  const requestedTimeList = requestedTimePhrases(query);
  // Category-only discovery can use the single generic "find a service" FAQ.
  // A query that names an exact sub-service must be allowed to use the
  // sub-service's own informational/availability/booking knowledge records.
  const genericCategoryRequest = qIntent === 'find_service' && resolution.specificity === 'category';
  const genericDiscoveryIds = index.intentToRecords.get('find service') ?? new Set<number>();
  const hasLocalizedGenericDiscovery = [...genericDiscoveryIds].some(id => {
    const record = index.records[id];
    return record?.active &&
      record.audience === effectiveAudience &&
      normalizeText(record.language || 'en').toLowerCase() === requestedLanguage;
  });

  for (const id of candidateIds) {
    const record = index.records[id];
    if (!record?.active || record.audience !== effectiveAudience) continue;

    const recordLanguage = normalizeText(record.language || 'en').toLowerCase();
    if (recordLanguage !== requestedLanguage) continue;

    if (!urgencyCompatible(query, record.urgency)) continue;

    // Generic queries must not inherit emergency/scheduled/location/time facts
    // unless the user explicitly supplied those dimensions.
    if (!hasEmergencyRequest(query) && /emergency|urgent/i.test(normalizeText(record.urgency))) continue;
    if (!hasEmergencyRequest(query) && /\bemergency\b/i.test(normalizeText(record.answer))) continue;
    const ri = intentGroup(record.intent);

    // Location/time facts are hard constraints for concrete availability/booking
    // answers, but not for general informational FAQs. A pipe-repair info FAQ
    // may mention one example location and should still answer "I need pipe repair".
    const concreteIntent = ri === 'book_service' || ri === 'check_availability' || ri === 'emergency_request';
    if (concreteIntent && !hasLocationRequest(query) && recordHasLocation(record, index)) continue;
    if (concreteIntent && !hasTimeRequest(query) && recordHasTime(record)) continue;


    if (!compatibleIntent(qIntent, record.intent)) continue;

    // For a broad service-discovery request, prefer the dataset's explicit
    // localized discovery FAQ over an arbitrary sub-service record. If the
    // requested language has no discovery FAQ, do not invent a sub-service.
    if (genericCategoryRequest && hasLocalizedGenericDiscovery && ri !== 'find_service') continue;
    if (genericCategoryRequest && !hasLocalizedGenericDiscovery) continue;

    // Provider requests must not silently use customer-only knowledge.
    if (effectiveAudience === 'provider' && record.audience !== 'provider') continue;

    const f = fields(record);
    const se = serviceEvidence(tokens, f, resolution);

    const candidateCategory = normalizeText(record.category);
    const candidateSubService = normalizeText(record.subService || record.service);

    const categoryMatch = Boolean(
      resolution.category && candidateCategory === normalizeText(resolution.category)
    );

    let subServiceMatch = false;
    if (resolution.subService) {
      subServiceMatch = candidateSubService === normalizeText(resolution.subService);
    }

    // Category-level requests keep all records in that category. A sub-service
    // match is required only when the user explicitly selected a sub-service.
    // This is the key fix for generic requests such as "book a plumber".
    if (resolution.specificity === 'sub_service' && !subServiceMatch) continue;
    if (resolution.specificity === 'category' && resolution.category && !categoryMatch) {
      // A localized generic find-service FAQ is allowed to answer a broad
      // service-discovery request when the dataset has no category-specific
      // discovery record. It is ranked below a true category match.
      if (!(qIntent === 'find_service' && ri === 'find_service')) continue;
    }

    const matched = tokens.filter(t =>
      f.question.has(t) ||
      f.keywords.has(t) ||
      f.category.has(t) ||
      f.service.has(t) ||
      f.subService.has(t) ||
      f.intent.has(t)
    );

    for (const t of se.matched) {
      if (!matched.includes(t)) matched.push(t);
    }

    // Structured service evidence can make a generic service query valid even
    // when its only lexical token is the service alias.
    if (!matched.length && genericCategoryRequest && ri === 'find_service') {
      // The service was resolved structurally from the query, so the generic
      // discovery FAQ does not need the user's alias to literally occur in
      // its own keyword list.
      matched.push('service');
    }

    if (!matched.length && !(categoryMatch || subServiceMatch)) continue;

    const weighted = matched.reduce((s, t) => s + idf(index, t), 0);
    const coverage = totalWeight ? Math.min(1, weighted / totalWeight) : 0;
    const questionHits = tokens.filter(t => f.question.has(t)).length;
    const keywordHits = tokens.filter(t => f.keywords.has(t)).length;
    const categoryHits = tokens.filter(t => f.category.has(t)).length;
    const subServiceHits = tokens.filter(t => f.subService.has(t)).length;
    const locationMatch = locationEvidence(query, record, index);
    const timeMatch = timeEvidence(query, record);
    const intentMatch = qIntent !== 'unknown' && ri === qIntent;

    // Booking answers in this dataset contain concrete location/time facts.
    // Never return one when the user's request leaves those facts unresolved.
    if (qIntent === 'book_service') {
      if (!requestedLocationList.length) continue;
      if (requestedTimeList.length && timeMatch < 0.5) continue;
      if (requestedLocationList.length && locationMatch < 0.5) continue;
    }
    const exact = normalizeText(record.question) === normalizeText(query);

    const categoryBoost = categoryMatch ? 0.30 : 0;
    const subServiceBoost = subServiceMatch ? 0.40 : 0;
    const genericServiceBoost = genericCategoryRequest && categoryMatch ? 0.20 : 0;
    const genericDiscoveryBoost = genericCategoryRequest && ri === 'find_service' ? 0.55 : 0;
    // For an explicitly named sub-service, strongly prefer records for that
    // sub-service over the generic discovery FAQ.
    const specificSubServiceBoost = resolution.specificity === 'sub_service' && subServiceMatch ? 0.45 : 0;

    const baseScore =
      coverage * 0.25 +
      (questionHits / Math.max(tokens.length, 1)) * 0.12 +
      (keywordHits / Math.max(tokens.length, 1)) * 0.12 +
      (categoryHits ? 0.04 : 0) +
      (subServiceHits ? 0.12 : 0) +
      Math.min(se.score, 2) * 0.12 +
      (intentMatch ? 0.12 : 0) +
      categoryBoost +
      subServiceBoost +
      genericServiceBoost +
      genericDiscoveryBoost +
      specificSubServiceBoost;

    const score = Math.max(0,
      Math.min(1.85, baseScore) +
      locationMatch * 0.45 +
      timeMatch * 0.45 +
      (exact ? 0.40 : 0)
    );

    out.push({
      record,
      score,
      matchedTokens: [...new Set(matched)],
      questionHits,
      keywordHits,
      categoryHits,
      subServiceHits,
      intentMatch,
      serviceEvidence: se.score + (categoryMatch ? 1 : 0) + (subServiceMatch ? 1.5 : 0) + (genericCategoryRequest && ri === 'find_service' ? 1 : 0),
      specificityPenalty: 0,
    });
  }

  return out
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export { intentGroup };
