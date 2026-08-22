import type { SupportedLanguage } from '../types.js';

const PHRASES: Record<SupportedLanguage, Array<[RegExp, string]>> = {
  en: [],
  hi: [
    [/मुझे\s+JustTap\s+के\s+बारे\s+में\s+बताइए/gi, 'Tell me about JustTap'],
    [/JustTap\s+के\s+बारे\s+में\s+बताइए/gi, 'Tell me about JustTap'],
    [/JustTap\s+के\s+बारे\s+में/gi, 'about JustTap'],
    [/क्या\s+कोई\s+AC\s+रिपेयर\s+में\s+मेरी\s+मदद\s+कर\s+सकता\s+है/gi, 'Can someone help with AC repair'],
    [/मुझे\s+नल\s+की\s+मरम्मत\s+करवानी\s+है/gi, 'I need tap repair'],
    [/नल\s+की\s+मरम्मत/gi, 'tap repair'],
    [/मरम्मत/gi, 'repair'],
    [/जस्टटैप\s+क्या\s+है/gi, 'What is JustTap'],
    [/मैं\s+प्रदाता\s+कैसे\s+बनूं/gi, 'How can I become a provider'],
    [/मैं\s+प्रोवाइडर\s+कैसे\s+बनूं/gi, 'How can I become a provider'],
    [/मुझे\s+प्लंबर\s+बुक\s+करना\s+है/gi, 'I want to book a plumber'],
    [/मुझे\s+प्लंबर\s+बुक\s+करना\s+है/gi, 'I want to book a plumber'],
    [/क्या\s+मैं\s+ग्लास\s+रिपेयर\s+सर्विस\s+बुक\s+कर\s+सकता\s+हूँ/gi, 'Can I book glass repair service'],
    [/पाइप\s+रिपेयर/gi, 'pipe repair'],
    [/प्लंबर/gi, 'plumber'],
    [/प्लंबिंग/gi, 'plumbing'],
    [/ग्लास\s+रिपेयर/gi, 'glass repair'],
    [/ग्लास/gi, 'glass'],
    [/रिपेयर/gi, 'repair'],
    [/बुक\s+करना/gi, 'book'],
    [/बुकिंग/gi, 'booking'],
    [/शेड्यूल/gi, 'schedule'],
    [/कीमत|दाम|चार्ज|शुल्क/gi, 'price'],
    [/कितना\s+है/gi, 'cost'],
    [/उपलब्ध/gi, 'available'],
    [/आज/gi, 'today'],
    [/कल/gi, 'tomorrow'],
    [/सुबह/gi, 'morning'],
    [/दोपहर/gi, 'afternoon'],
    [/शाम/gi, 'evening'],
    [/रात/gi, 'night'],
    [/तुरंत|जल्दी|अर्जेंट/gi, 'urgent'],
    [/रद्द/gi, 'cancel'],
    [/शिकायत/gi, 'complaint'],
    [/मुझे\s+ड्राइवर\s+चाहिए/gi, 'I need a driver'],
    [/मुझे\s+इलेक्ट्रीशियन\s+चाहिए/gi, 'I need an electrician'],
    [/मुझे\s+एसी\s+रिपेयर\s+कराना\s+है/gi, 'I need AC repair'],
    [/मुझे\s+कारपेंटर\s+चाहिए/gi, 'I need a carpenter'],
    [/हाँ/gi, 'yes'],
    [/हां/gi, 'yes'],
    [/नहीं/gi, 'no']
  ],
  mr: [
    [/मला\s+JustTap\s+बद्दल\s+सांगा/gi, 'Tell me about JustTap'],
    [/JustTap\s+बद्दल\s+सांगा/gi, 'Tell me about JustTap'],
    [/JustTap\s+बद्दल/gi, 'about JustTap'],
    [/AC\s+रिपेअरसाठी\s+कोणी\s+माझी\s+मदत\s+करू\s+शकते\s+का/gi, 'Can someone help with AC repair'],
    [/मला\s+नळाची\s+दुरुस्ती\s+करून\s+घ्यायची\s+आहे/gi, 'I need tap repair'],
    [/नळाची\s+दुरुस्ती/gi, 'tap repair'],
    [/दुरुस्ती/gi, 'repair'],
    [/मला\s+प्लंबर\s+बुक\s+करायचा\s+आहे/gi, 'I want to book a plumber'],
    [/ग्लास\s+रिपेअर\s+सर्व्हिस\s+बुक\s+करू\s+शकतो\s+का/gi, 'Can I book glass repair service'],
    [/पाईप\s+रिपेअर/gi, 'pipe repair'],
    [/प्लंबर/gi, 'plumber'],
    [/प्लंबिंग/gi, 'plumbing'],
    [/ग्लास\s+रिपेअर/gi, 'glass repair'],
    [/ग्लास/gi, 'glass'],
    [/रिपेअर/gi, 'repair'],
    [/बुक\s+करायचा|बुक\s+करणे/gi, 'book'],
    [/बुकिंग/gi, 'booking'],
    [/शेड्यूल/gi, 'schedule'],
    [/किंमत|दर|चार्ज|शुल्क/gi, 'price'],
    [/किती\s+आहे/gi, 'cost'],
    [/उपलब्ध/gi, 'available'],
    [/आज/gi, 'today'],
    [/उद्या/gi, 'tomorrow'],
    [/सकाळी/gi, 'morning'],
    [/दुपारी/gi, 'afternoon'],
    [/संध्याकाळी/gi, 'evening'],
    [/रात्री/gi, 'night'],
    [/तातडीने|लवकर/gi, 'urgent'],
    [/रद्द/gi, 'cancel'],
    [/तक्रार/gi, 'complaint'],
    [/मला\s+ड्रायव्हर\s+पाहिजे/gi, 'I need a driver'],
    [/मला\s+इलेक्ट्रिशियन\s+पाहिजे/gi, 'I need an electrician'],
    [/मला\s+एसी\s+रिपेअर\s+करायचे\s+आहे/gi, 'I need AC repair'],
    [/मला\s+कारपेंटर\s+पाहिजे/gi, 'I need a carpenter'],
    [/होय|हो/gi, 'yes'],
    [/नाही/gi, 'no']
  ]
};

const ROMAN: Array<[RegExp, string]> = [
  [/\bmujhe\b/gi, 'I'],
  [/\bplumber\b/gi, 'plumber'],
  [/\bbook\s+karna\s+hai\b/gi, 'book'],
  [/\bbook\s+karna\b/gi, 'book'],
  [/\bkarna\s+hai\b/gi, 'want'],
  [/\bchahiye\b/gi, 'need'],
  [/\bkal\b/gi, 'tomorrow'],
  [/\baaj\b/gi, 'today'],
  [/\bshaam\b/gi, 'evening'],
  [/\bsamajh\b/gi, 'understand'],
  [/\bkitna\b/gi, 'how much'],
  [/\bkeemat\b/gi, 'price'],
  [/\bmarammat\b/gi, 'repair'],
  [/\bseva\b/gi, 'service'],
  [/\bmala\b/gi, 'I'],
  [/\bpahije\b/gi, 'need'],
  [/\bkaraycha\b/gi, 'want'],
  [/\budya\b/gi, 'tomorrow'],
  [/\bsandhyakali\b/gi, 'evening'],
  [/\bkiti\b/gi, 'how much']
];

export class LanguageService {
  normalize(language?: string): SupportedLanguage {
    return language === 'hi' || language === 'mr'
      ? language
      : 'en';
  }

  prepareQuery(
    text: string,
    language: SupportedLanguage
  ): { query: string; language: SupportedLanguage } {
    let query = text.trim();

    if (language !== 'en') {
      for (const [pattern, replacement] of PHRASES[language]) {
        query = query.replace(pattern, replacement);
      }
    }

    for (const [pattern, replacement] of ROMAN) {
      query = query.replace(pattern, replacement);
    }

    return {
      query: query.replace(/\s+/g, ' ').trim(),
      language
    };
  }
}

export const languageService = new LanguageService();
