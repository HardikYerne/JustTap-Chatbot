const STOPWORDS = new Set([
  'a','an','the','and','or','but','to','of','for','in','on','at','by','with',
  'from','is','are','am','be','can','could','would','should','do','does','did',
  'how','what','why','when','where','which','who','i','me','my','we','our',
  'you','your','it','this','that','please','want','need','help','tell','give',
  'get','got','have','has','had','there','here','about','into','as','than',
  'then','also','just','please'
]);

export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[_/\\-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stemToken(token: string): string {
  let x = token.toLowerCase();

  if (x.length > 5 && x.endsWith('ies')) x = `${x.slice(0, -3)}y`;
  else if (x.length > 5 && x.endsWith('ing')) x = x.slice(0, -3);
  else if (x.length > 5 && x.endsWith('ers')) x = x.slice(0, -3);
  else if (x.length > 4 && x.endsWith('er')) x = x.slice(0, -2);
  else if (x.length > 4 && x.endsWith('ed')) x = x.slice(0, -2);
  else if (x.length > 4 && x.endsWith('es')) x = x.slice(0, -2);
  else if (x.length > 3 && x.endsWith('s')) x = x.slice(0, -1);

  return x;
}

export function tokenize(value: unknown): string[] {
  return [...new Set(
    normalizeText(value)
      .split(' ')
      .filter(Boolean)
      .filter(x => !STOPWORDS.has(x))
      .filter(x => x.length >= 2)
      .map(stemToken)
  )];
}

export function parseKeywords(value: unknown): string[] {
  if (Array.isArray(value)) return [...new Set(value.flatMap(tokenize))];

  return [...new Set(
    String(value ?? '')
      .split(/[,;|]/)
      .flatMap(tokenize)
  )];
}
