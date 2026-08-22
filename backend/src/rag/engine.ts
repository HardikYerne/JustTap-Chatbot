import path from 'node:path';
import { loadKnowledgeDirectory } from './loader.js';
import { buildIndex, type KnowledgeIndex } from './indexer.js';
import { retrieve, queryAudience, resolveService, queryIntent } from './retriever.js';
import { rank } from './ranker.js';
import type { Audience, RAGResult } from './types.js';
import type { SupportedLanguage } from '../types.js';
import { languageService } from '../language/service.js';
import { serviceRequestStarted } from '../language/responses.js';
import { normalizeText, tokenize } from './normalize.js';


function hasUnsupportedSpecificTerms(query: string, resolved: ReturnType<typeof resolveService>, index: KnowledgeIndex): boolean {
  if (resolved.specificity !== 'category') return false;

  const generic = new Set([
    'book','booking','reserve','reservation','schedule','hire','find','search','service','services',
    'want','need','please','help','looking','look','for','get','give','tell','can','could','would',
    'i','me','my','the','a','an','to','how','what','where','when','why','is','are','do','does','did',
    'just','as','someone','something','send','provide','with','please'
  ]);

  const categoryTokens = new Set(tokenize(resolved.category));
  const knownSubTokens = new Set<string>();
  for (const subService of index.subServiceToRecords.keys()) {
    for (const token of tokenize(subService)) knownSubTokens.add(token);
  }

  const meaningful = tokenize(query).filter(token => !generic.has(token));
  const unknown = meaningful.filter(token => !categoryTokens.has(token) && !knownSubTokens.has(token));

  // A category-only query with extra, unsupported service-specific terms should
  // not fall back to the generic discovery FAQ. Example: AC gas refill when the
  // dataset contains AC repair/servicing but no AC gas refill knowledge.
  return unknown.length >= 1 && meaningful.length >= 2;
}

export class VectorlessRAG {
  private index: KnowledgeIndex = {
    records: [],
    tokenToRecords: new Map(),
    serviceTokenToRecords: new Map(),
    categoryTokenToRecords: new Map(),
    categoryToRecords: new Map(),
    subServiceToRecords: new Map(),
    intentToRecords: new Map(),
    documentFrequency: new Map(),
    serviceVocabulary: new Set(),
    serviceAliases: new Map(),
    serviceAliasCategories: new Map(),
    selectiveTokenMaxDf: 0,
    locationPhrases: new Set(),
  };

  constructor(private readonly directory: string) {
    this.reload();
  }

  reload(): void {
    const records = loadKnowledgeDirectory(this.directory);
    this.index = buildIndex(records);

    console.log(`[RAG] Loaded ${records.length} knowledge records`);
    console.log(`[RAG] Indexed ${this.index.tokenToRecords.size} selective tokens`);
    console.log(`[RAG] Indexed ${this.index.serviceVocabulary.size} service/category tokens`);
    console.log(`[RAG] Indexed ${this.index.categoryToRecords.size} categories`);
    console.log(`[RAG] Indexed ${this.index.subServiceToRecords.size} sub-services`);
    console.log(`[RAG] Selective token DF limit: ${this.index.selectiveTokenMaxDf}`);
    console.log(`[RAG] Knowledge directory: ${this.directory}`);

    if (records.length === 0) {
      console.error('[RAG] No knowledge records loaded. Check JUSTTAP_KNOWLEDGE_DIR.');
    }
  }

  search(
    query: string,
    language: SupportedLanguage = 'en',
    audience: Audience = 'customer'
  ): RAGResult {
    const prepared = languageService.prepareQuery(query, language);

    const effectiveAudience = queryAudience(prepared.query, audience);

    // Search both the original native-language query and the local normalized
    // representation. The language remains a hard constraint on records, so
    // normalization cannot accidentally answer in another language.
    const retrievalQuery =
      language === 'en'
        ? prepared.query
        : `${query} ${prepared.query}`;

    const candidates = retrieve(
      retrievalQuery,
      this.index,
      language,
      effectiveAudience
    );

    let result = rank(candidates, retrievalQuery, language);
    const resolvedService = resolveService(retrievalQuery, this.index);
    const resolvedIntent = queryIntent(
      retrievalQuery,
      resolvedService.specificity !== 'none'
    );
    const unsupportedSpecificTerms = hasUnsupportedSpecificTerms(
      prepared.query,
      resolvedService,
      this.index
    );

    // If the requested language has no localized generic discovery FAQ, use a
    // localized routing response instead of returning an English fallback or
    // an unrelated concrete booking record. This response makes no dataset
    // claim; it only acknowledges the resolved service.
    if (!result.matched &&
        resolvedIntent === 'find_service' &&
        resolvedService.specificity !== 'none' &&
        !unsupportedSpecificTerms) {
      result = {
        matched: true,
        answer: serviceRequestStarted(
          resolvedService.subService || resolvedService.category,
          language
        ),
        score: resolvedService.confidence,
        intent: 'find_service',
        service: resolvedService.subService || resolvedService.category,
        candidates: 0,
        missingFields: [],
        language,
      };
    }

    if (result.matched && unsupportedSpecificTerms && result.intent === 'find_service') {
      result = {
        matched: false,
        answer: result.answer,
        score: 0,
        intent: 'unknown_query',
        service: '',
        candidates: result.candidates,
        language,
      };
    }

    // If the answer came from the generic service-discovery FAQ, expose the
    // service/category resolved from the user's query rather than the FAQ's
    // generic "Service-related" category.
    if (result.matched &&
        result.intent === 'find_service' &&
        resolvedService.specificity !== 'none') {
      result.service = resolvedService.subService || resolvedService.category;
    }

    return result;
  }

  count(): number {
    return this.index.records.length;
  }

  indexedTokenCount(): number {
    return this.index.tokenToRecords.size;
  }
}

export function createRAG(): VectorlessRAG {
  return new VectorlessRAG(
    process.env.JUSTTAP_KNOWLEDGE_DIR ||
    path.resolve(process.cwd(), 'data', 'knowledge')
  );
}
