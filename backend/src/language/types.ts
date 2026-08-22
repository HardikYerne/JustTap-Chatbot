import type { SupportedLanguage } from '../types.js';

export type TranslationProvider = {
  translate(
    text: string,
    sourceLanguage: SupportedLanguage,
    targetLanguage: SupportedLanguage
  ): Promise<string>;
};
