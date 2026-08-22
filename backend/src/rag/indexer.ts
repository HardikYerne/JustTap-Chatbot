import type { KnowledgeRecord } from './types.js';
import { normalizeText, tokenize } from './normalize.js';

export interface KnowledgeIndex {
  records: KnowledgeRecord[];
  tokenToRecords: Map<string, Set<number>>;
  serviceTokenToRecords: Map<string, Set<number>>;
  categoryTokenToRecords: Map<string, Set<number>>;
  categoryToRecords: Map<string, Set<number>>;
  subServiceToRecords: Map<string, Set<number>>;
  intentToRecords: Map<string, Set<number>>;
  documentFrequency: Map<string, number>;
  serviceVocabulary: Set<string>;
  serviceAliases: Map<string, string>;
  serviceAliasCategories: Map<string, Map<string, number>>;
  selectiveTokenMaxDf: number;
  locationPhrases: Set<string>;
}

function add(map: Map<string, Set<number>>, token: string, id: number): void {
  if (!token) return;
  let set = map.get(token);
  if (!set) {
    set = new Set<number>();
    map.set(token, set);
  }
  set.add(id);
}

function addCount(
  map: Map<string, Map<string, number>>,
  alias: string,
  category: string
): void {
  if (!alias || !category) return;
  let categories = map.get(alias);
  if (!categories) {
    categories = new Map<string, number>();
    map.set(alias, categories);
  }
  categories.set(category, (categories.get(category) ?? 0) + 1);
}

function rawWords(value: string): string[] {
  return [...new Set(
    normalizeText(value)
      .split(' ')
      .filter(Boolean)
      .filter(token => token.length >= 2)
  )];
}


// Canonical user-language aliases. These are intentionally category-level
// aliases: a broad term such as "plumber" must resolve to Plumbing, not to
// an arbitrary sub-service or to a category that merely happens to mention
// the word in one of its FAQ keywords.
const CATEGORY_ALIASES: Record<string, string[]> = {
  'Plumbing': ['plumber', 'plumbing'],
  'Electrical': ['electrician', 'electrical', 'electric'],
  'Carpenter': ['carpenter', 'carpentry'],
  'Mason': ['mason', 'masonry'],
  'Painting': ['painter', 'painting'],
  'AC & Cooling': ['ac', 'air conditioner', 'air conditioning', 'ac technician'],
  'Beauty & Personal Care': ['beauty', 'beautician', 'salon'],
  'Cleaning & Maintenance': ['cleaning maintenance', 'maintenance'],
  'Cleaning': ['cleaner'],
  'Gardening & Outdoor': ['gardener', 'gardening'],
  'Moving & Logistics': ['mover', 'moving'],
  'Construction & Home Improvement': ['construction', 'home improvement'],
  'Emergency Services': ['emergency service'],
  'Business & Office Services': ['business service', 'office service'],
  'Creative Services': ['creative service'],
  'IT & Digital Services': ['it service', 'digital service'],
  'Education Services': ['education', 'tutor', 'tutoring'],
  'Family & Personal Services': ['personal service'],
  'Pet Services': ['pet service', 'pet care'],
  'Pest Control': ['pest control', 'exterminator'],
  'Appliance Repair': ['appliance repair', 'appliance technician'],
  'Bathroom': ['bathroom service'],
  'Gas Services': ['gas service', 'gas technician'],
  'Locksmith': ['locksmith'],
  'Glass & Window': ['glass service', 'window service'],
  'Waterproofing': ['waterproofing'],
  'Automobile Services': ['automobile service', 'auto service', 'car service'],
  'Events & Wedding Services': ['event service', 'wedding service'],
};

const COMMON_SERVICE_WORDS = new Set([
  'book', 'booking', 'reserve', 'reservation', 'schedule', 'scheduled',
  'hire', 'find', 'search', 'service', 'services', 'want', 'need', 'please',
  'help', 'looking', 'look', 'for', 'get', 'give', 'tell', 'can', 'could',
  'would', 'how', 'what', 'where', 'when', 'why', 'is', 'are', 'do', 'does',
  'did', 'just', 'repair', 'cleaning', 'maintenance', 'price', 'cost',
  'fee', 'charge', 'rate', 'available', 'availability', 'today', 'tomorrow',
  'tonight', 'morning', 'afternoon', 'evening', 'night', 'urgent', 'urgently',
  'emergency', 'asap', 'immediately', 'same', 'day', 'next', 'week', 'weekend'
]);

export function buildIndex(records: KnowledgeRecord[]): KnowledgeIndex {
  const tokenToRecords = new Map<string, Set<number>>();
  const serviceTokenToRecords = new Map<string, Set<number>>();
  const categoryTokenToRecords = new Map<string, Set<number>>();
  const categoryToRecords = new Map<string, Set<number>>();
  const subServiceToRecords = new Map<string, Set<number>>();
  const intentToRecords = new Map<string, Set<number>>();
  const documentFrequency = new Map<string, number>();
  const serviceVocabulary = new Set<string>();
  const serviceAliases = new Map<string, string>();
  const serviceAliasCategories = new Map<string, Map<string, number>>();
  const locationPhrases = new Set<string>();
  const locationCandidateCounts = new Map<string, number>();

  records.forEach((record, id) => {
    if (!record.active) return;

    const allTerms = new Set<string>([
      ...tokenize(record.question),
      ...record.keywords.flatMap(tokenize),
      ...tokenize(record.category),
      ...tokenize(record.service),
      ...tokenize(record.subService),
      ...tokenize(record.intent),
      ...tokenize(record.urgency),
    ]);

    for (const term of allTerms) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }

    const category = normalizeText(record.category);
    const subService = normalizeText(record.subService || record.service);
    const intent = normalizeText(record.intent);

    const keywordTokenSet = new Set(record.keywords.flatMap(tokenize));
    const locationSource = normalizeText(`${record.question} ${record.answer}`);
    for (const match of locationSource.matchAll(/\b(?:in|at|near|around)\s+([a-z][a-z\s-]{2,40})/gi)) {
      const rawPhrase = normalizeText(match[1] || '');
      const words = rawPhrase.split(' ').filter(Boolean);
      let phrase = '';
      for (let length = Math.min(3, words.length); length >= 1; length -= 1) {
        const candidate = words.slice(0, length).join(' ');
        const candidateTokens = tokenize(candidate);
        if (candidateTokens.length > 0 && candidateTokens.every(token => keywordTokenSet.has(token))) {
          phrase = candidate;
          break;
        }
      }
      if (!phrase) continue;
      const phraseTokens = tokenize(phrase);
      const rawPhraseWords = phrase.split(' ');
      const functionWords = new Set(['a', 'an', 'the', 'and', 'or', 'we', 'you', 'it', 's', 'can', 'will', 'please', 'your', 'our']);
      const noisyPhrase = rawPhraseWords.length > 2 || rawPhraseWords.some(word => functionWords.has(word));
      const serviceLike = phrase === category ||
        phrase === subService ||
        phraseTokens.length === 0 ||
        phraseTokens.every(token => COMMON_SERVICE_WORDS.has(token));
      if (!noisyPhrase && !serviceLike) {
        locationCandidateCounts.set(phrase, (locationCandidateCounts.get(phrase) ?? 0) + 1);
      }
    }

    if (category) add(categoryToRecords, category, id);
    if (subService) add(subServiceToRecords, subService, id);
    if (intent) add(intentToRecords, intent, id);

    for (const term of tokenize(record.category)) {
      add(categoryTokenToRecords, term, id);
      add(serviceTokenToRecords, term, id);
      serviceVocabulary.add(term);
    }

    const serviceTerms = new Set<string>([
      ...tokenize(record.service),
      ...tokenize(record.subService),
    ]);

    for (const term of serviceTerms) {
      add(serviceTokenToRecords, term, id);
      serviceVocabulary.add(term);
      serviceAliases.set(term, category || subService);
    }

    // Keep alias classification on unstemmed words. Otherwise "plumber"
    // and "plumbing" both collapse to "plumb" and a dominant category
    // can incorrectly claim the other term.
    const rawAliasWords = new Set<string>([
      ...rawWords(record.service),
      ...rawWords(record.subService),
      ...record.keywords.flatMap(rawWords),
    ]);

    for (const term of rawAliasWords) {
      if (category && !COMMON_SERVICE_WORDS.has(term)) {
        addCount(serviceAliasCategories, term, category);
      }
    }
  });


  // Add explicit canonical aliases after observing the dataset categories.
  // This prevents ambiguous keyword evidence such as "plumber" appearing
  // only in Emergency Services FAQs from hijacking Plumbing detection.
  for (const [category, aliases] of Object.entries(CATEGORY_ALIASES)) {
    const canonicalCategory = [...categoryToRecords.keys()]
      .find(value => normalizeText(value) === normalizeText(category));
    if (!canonicalCategory) continue;
    for (const alias of aliases) {
      for (const token of rawWords(alias)) {
        if (!COMMON_SERVICE_WORDS.has(token)) {
          addCount(serviceAliasCategories, token, canonicalCategory);
          // Explicit canonical aliases override noisy dataset keyword evidence.
          serviceAliases.set(token, canonicalCategory);
        }
      }
    }
  }

  // Keep only repeated, non-service phrases as learned location vocabulary.
  // The threshold prevents phrases such as "the exact work" or service names
  // from being mistaken for locations.
  for (const [phrase, count] of locationCandidateCounts) {
    if (count >= 50) locationPhrases.add(phrase);
  }

  // Keep only selective tokens in the generic inverted index. Service/category
  // and intent indexes remain available for common words, so frequent tokens
  // no longer create near-full-dataset candidate sets.
  const maxDf = Math.max(25, Math.floor(records.length * 0.01));

  records.forEach((record, id) => {
    if (!record.active) return;

    const allTerms = new Set<string>([
      ...tokenize(record.question),
      ...record.keywords.flatMap(tokenize),
      ...tokenize(record.category),
      ...tokenize(record.service),
      ...tokenize(record.subService),
      ...tokenize(record.intent),
      ...tokenize(record.urgency),
    ]);

    for (const term of allTerms) {
      if ((documentFrequency.get(term) ?? 0) <= maxDf) {
        add(tokenToRecords, term, id);
      }
    }
  });

  return {
    records,
    tokenToRecords,
    serviceTokenToRecords,
    categoryTokenToRecords,
    categoryToRecords,
    subServiceToRecords,
    intentToRecords,
    documentFrequency,
    serviceVocabulary,
    serviceAliases,
    serviceAliasCategories,
    selectiveTokenMaxDf: maxDf,
    locationPhrases,
  };
}
