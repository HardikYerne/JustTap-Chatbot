import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import type { KnowledgeRecord } from './types.js';
import { normalizeText, parseKeywords } from './normalize.js';

function text(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function keywordPhrases(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(item => normalizeText(item))
      .filter(Boolean);
  }

  return String(value ?? '')
    .split(/[|;\n]/)
    .map(item => normalizeText(item))
    .filter(Boolean);
}

function canInferSubService(intent: string): boolean {
  const x = normalizeText(intent);
  return /book|booking|availability|available|price|cost|fee|charge|rate|emergency|urgent|complaint|cancel/.test(x);
}

function looksGenericPhrase(value: string): boolean {
  const x = normalizeText(value);
  return /^(book|booking|service|services|find service|search service|help|support|what is justtap|about justtap|how to book|provider|become provider|provider registration|provider documents)$/.test(x);
}

function inferSubService(raw: Record<string, unknown>, intent: string): string {
  const explicit = text(
    raw,
    'sub_service',
    'subService',
    'subservice'
  );
  if (explicit) return explicit;

  if (!canInferSubService(intent)) return '';

  const phrases = keywordPhrases(raw.keywords ?? raw.keyword ?? '');
  const candidate = phrases.find(phrase => !looksGenericPhrase(phrase));

  return candidate || '';
}

function toRecord(raw: Record<string, unknown>, source: string): KnowledgeRecord | null {
  const id = text(raw, 'id', 'ID');
  const question = text(raw, 'question', 'query', 'text', 'canonical_question');
  const answer = text(raw, 'answer', 'response');

  if (!id || !question || !answer) return null;

  const audienceRaw = normalizeText(text(raw, 'audience', 'user_type') || 'customer');
  const audience = audienceRaw === 'provider' ? 'provider' : 'customer';
  const intent = normalizeText(text(raw, 'intent', 'intent_name') || 'unknown_query');

  return {
    id,
    language: normalizeText(text(raw, 'language', 'lang') || 'en') || 'en',
    audience,
    intent,
    category: text(raw, 'category', 'service_category'),
    service: text(raw, 'service', 'service_name'),
    subService: inferSubService(raw, intent),
    urgency: normalizeText(text(raw, 'urgency')),
    question,
    keywords: parseKeywords(raw.keywords ?? raw.keyword ?? ''),
    answer,
    answerTemplate: text(raw, 'answerTemplate', 'answer_template'),
    source: text(raw, 'source') || source,
    active: !['false', '0', 'no', 'inactive', 'disabled'].includes(
      normalizeText(text(raw, 'active', 'is_active') || 'true')
    ),
  };
}

function loadCSV(file: string): KnowledgeRecord[] {
  const rows = parse(fs.readFileSync(file, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, unknown>[];

  return rows
    .map(row => toRecord(row, path.basename(file)))
    .filter((x): x is KnowledgeRecord => x !== null);
}

function loadJSON(file: string): KnowledgeRecord[] {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  const rows: unknown[] = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as any).records)
      ? (parsed as any).records
      : [];

  return rows
    .filter((x): x is Record<string, unknown> =>
      typeof x === 'object' && x !== null && !Array.isArray(x)
    )
    .map(row => toRecord(row, path.basename(file)))
    .filter((x): x is KnowledgeRecord => x !== null);
}

function selectedFiles(directory: string): string[] {
  const configured = process.env.JUSTTAP_KNOWLEDGE_FILES
    ?.split(',')
    .map(x => x.trim())
    .filter(Boolean);

  if (configured?.length) {
    return configured.map(name => path.resolve(directory, name));
  }

  const preferred = ['justtap_knowledge.csv'];
  const found = preferred
    .map(name => path.join(directory, name))
    .filter(file => fs.existsSync(file));

  if (found.length) return found;

  const fallback = ['justtap_knowledge.json']
    .map(name => path.join(directory, name))
    .filter(file => fs.existsSync(file));

  if (fallback.length) return fallback;

  throw new Error(
    `No canonical JustTap knowledge file found in ${directory}. Expected justtap_knowledge.csv`
  );
}

export function loadKnowledgeDirectory(directory: string): KnowledgeRecord[] {
  const dir = path.resolve(directory);

  if (!fs.existsSync(dir)) {
    throw new Error(`Knowledge directory not found: ${dir}`);
  }

  const records: KnowledgeRecord[] = [];

  for (const file of selectedFiles(dir)) {
    try {
      const ext = path.extname(file).toLowerCase();

      if (ext === '.csv') records.push(...loadCSV(file));
      else if (ext === '.json') records.push(...loadJSON(file));
    } catch (error) {
      console.error(`[RAG] Failed to load ${file}:`, error);
    }
  }

  const unique = new Map<string, KnowledgeRecord>();

  for (const record of records) {
    if (!record.active) continue;
    const key = `${record.id}|${record.language}|${record.audience}`;
    if (!unique.has(key)) unique.set(key, record);
  }

  return [...unique.values()];
}
