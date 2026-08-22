import type { SupportedLanguage } from './types.js';

export type GeneralIntent = 'greeting' | 'thanks' | 'goodbye' | 'small_talk' | null;

const normalize = (value: string): string =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const patterns: Record<Exclude<GeneralIntent, null>, RegExp[]> = {
  greeting: [
    /^(hi|hello|hey|hiya|yo|namaste|good morning|good afternoon|good evening)$/i,
    /^(नमस्ते|नमस्कार|हैलो|हाय)$/u,
    /^(नमस्कार|हॅलो|हाय)$/u,
  ],
  thanks: [
    /^(thanks|thank you|thankyou|thx|ty)$/i,
    /^(धन्यवाद|शुक्रिया|आभारी)$/u,
    /^(धन्यवाद|आभारी)$/u,
  ],
  goodbye: [
    /^(bye|goodbye|see you|see ya|good night)$/i,
    /^(बाय|अलविदा|फिर मिलेंगे)$/u,
    /^(बाय|पुन्हा भेटू)$/u,
  ],
  small_talk: [
    /^(how are you|how r you|how is it going|what's up)$/i,
    /^(कैसे हो|आप कैसे हैं|क्या हाल है)$/u,
    /^(कसे आहात|काय म्हणता|कसा आहेस)$/u,
  ],
};

const responses: Record<Exclude<GeneralIntent, null>, Record<string, string>> = {
  greeting: {
    en: 'Hello 👋 How can I help you today?',
    hi: 'नमस्ते 👋 मैं आज आपकी कैसे मदद कर सकता हूँ?',
    mr: 'नमस्कार 👋 मी आज तुमची कशी मदत करू शकतो?',
  },
  thanks: {
    en: 'You’re welcome! 😊 How can I help you?',
    hi: 'आपका स्वागत है! 😊 मैं आपकी कैसे मदद कर सकता हूँ?',
    mr: 'आपले स्वागत आहे! 😊 मी तुमची कशी मदत करू शकतो?',
  },
  goodbye: {
    en: 'Thanks for using JustTap. Have a great day! 👋',
    hi: 'JustTap का उपयोग करने के लिए धन्यवाद। आपका दिन शुभ हो! 👋',
    mr: 'JustTap वापरल्याबद्दल धन्यवाद. तुमचा दिवस शुभ जावो! 👋',
  },
  small_talk: {
    en: 'I’m doing great! 😊 I can help you find JustTap services or answer service-related questions.',
    hi: 'मैं बढ़िया हूँ! 😊 मैं JustTap की सेवाएँ खोजने या सेवा से जुड़े सवालों का जवाब देने में आपकी मदद कर सकता हूँ।',
    mr: 'मी छान आहे! 😊 मी JustTap वरील सेवा शोधण्यात किंवा सेवेशी संबंधित प्रश्नांची उत्तरे देण्यात मदत करू शकतो.',
  },
};

export function detectGeneralIntent(value: string): GeneralIntent {
  const q = normalize(value);
  if (!q) return null;

  for (const intent of Object.keys(patterns) as Exclude<GeneralIntent, null>[]) {
    if (patterns[intent].some((pattern) => pattern.test(q))) return intent;
  }

  return null;
}

export function generalResponse(
  value: string,
  language: SupportedLanguage = 'en',
): { matched: boolean; intent: GeneralIntent; answer: string } {
  const intent = detectGeneralIntent(value);
  if (!intent) return { matched: false, intent: null, answer: '' };

  const lang = language === 'hi' || language === 'mr' ? language : 'en';
  return {
    matched: true,
    intent,
    answer: responses[intent][lang] ?? responses[intent].en,
  };
}
