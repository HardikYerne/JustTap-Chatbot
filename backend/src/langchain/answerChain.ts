import { SearchHit } from '../models/types.js';

export type GroundedAnswerInput = {
  message: string;
  normalizedMessage: string;
  language: string;
  intent: string;
  category: string;
  hits: SearchHit[];
  topScore: number;
  minRelevanceScore: number;
};

export async function runAnswerChain(
  input: GroundedAnswerInput
): Promise<string> {
  const strongMatch =
    input.hits.length > 0 &&
    input.topScore >= input.minRelevanceScore;

  const safeFallbacks: Record<string, string> = {
    en: "I don't have exact information about that JustTap topic yet. The JustTap support team can help you with the exact details.",
    hi: "मेरे पास अभी इस JustTap विषय की सटीक जानकारी नहीं है। JustTap की सहायता टीम आपको सही जानकारी देने में मदद कर सकती है।",
    mr: "माझ्याकडे सध्या या JustTap विषयाची अचूक माहिती नाही. JustTap ची सहाय्य टीम तुम्हाला योग्य माहिती देण्यात मदत करू शकते."
  };

  /*
   * Handle unsupported account/login questions BEFORE retrieval output
   * can reach an LLM. This prevents invented login steps and unrelated
   * service information.
   */
  if (
    /login|log in|sign in|signin|account|password|credential/i.test(
      input.normalizedMessage
    )
  ) {
    return safeFallbacks[input.language] ?? safeFallbacks.en;
  }

  /*
   * A strong knowledge match is already grounded in the knowledge base.
   * Return ONLY the best matching answer.
   *
   * Do not send multiple hits to the LLM because the LLM can combine
   * unrelated records and invent details.
   *
   * This also preserves Markdown headings, bullets, numbered steps and
   * Learn More links stored in the knowledge base.
   */
  if (strongMatch && input.hits[0]?.answer?.trim()) {
    return input.hits[0].answer.trim();
  }

  /*
   * No sufficiently strong grounded answer.
   * Return a deterministic fallback instead of allowing the LLM to guess.
   */
  return safeFallbacks[input.language] ?? safeFallbacks.en;
}
