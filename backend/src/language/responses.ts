import type { RAGResult } from '../rag/types.js';
import type { SupportedLanguage } from '../types.js';

export function genericPrompt(language: SupportedLanguage): string {
  if (language === 'hi') return 'ज़रूर। मैं आपकी मदद कर सकता हूँ। आप क्या जानना चाहते हैं?';
  if (language === 'mr') return 'नक्की. मी तुमची मदत करू शकतो. तुम्हाला काय जाणून घ्यायचे आहे?';
  return 'Sure! I can help. What would you like to know?';
}

export function locationPrompt(language: SupportedLanguage): string {
  if (language === 'hi') return 'ज़रूर। कृपया अपना स्थान बताएं।';
  if (language === 'mr') return 'नक्की. कृपया तुमचे ठिकाण सांगा.';
  return 'Sure. What is your location?';
}

export function timePrompt(language: SupportedLanguage): string {
  if (language === 'hi') return 'धन्यवाद। आप किस समय सर्विस चाहते हैं?';
  if (language === 'mr') return 'धन्यवाद. तुम्हाला सर्विस कोणत्या वेळी हवी आहे?';
  return 'Thanks. What time would you prefer for the service?';
}

export function namePrompt(language: SupportedLanguage): string {
  if (language === 'hi') return 'बहुत अच्छा। कृपया अपना नाम बताएं।';
  if (language === 'mr') return 'छान. कृपया तुमचे नाव सांगा.';
  return 'Great. May I have your name?';
}

export function phonePrompt(language: SupportedLanguage): string {
  if (language === 'hi') return 'धन्यवाद। कृपया अपना मोबाइल नंबर बताएं।';
  if (language === 'mr') return 'धन्यवाद. कृपया तुमचा मोबाइल नंबर सांगा.';
  return 'Thanks. Please provide your mobile number.';
}

export function serviceConfirmationPrompt(service: string, location: string | undefined, requestedTime: string | undefined, language: SupportedLanguage): string {
  const s = service?.trim() || 'service';
  const p = location?.trim() || '';
  const t = requestedTime?.trim() || '';
  if (language === 'hi') return `ठीक है। मैं आपके लिए ${s} सर्विस${p ? ` ${p} में` : ''}${t ? ` ${t} के लिए` : ''} का अनुरोध तैयार कर सकता हूँ। क्या आप चाहते हैं कि हमारी टीम आपसे संपर्क करे?`;
  if (language === 'mr') return `ठीक आहे. मी तुमच्यासाठी ${s} सर्विसची विनंती${p ? ` ${p} येथे` : ''}${t ? ` ${t} साठी` : ''} तयार करू शकतो. आमच्या टीमने तुमच्याशी संपर्क साधावा का?`;
  return `Great. I can prepare your ${s} service request${p ? ` in ${p}` : ''}${t ? ` for ${t}` : ''}. Would you like our team to contact you?`;
}

export function serviceRequestStarted(service: string, language: SupportedLanguage): string {
  const s = service?.trim() || 'service';
  if (language === 'hi') return `मैं आपको ${s} सर्विस खोजने में मदद कर सकता हूँ।`;
  if (language === 'mr') return `मी तुम्हाला ${s} सर्विस शोधण्यात मदत करू शकतो.`;
  return `I can help you find a ${s} service.`;
}

export function requestReceived(service: string, location: string | undefined, requestedTime: string | undefined, language: SupportedLanguage): string {
  const s = service?.trim() || 'service';
  const p = location?.trim();
  const t = requestedTime?.trim();
  if (language === 'hi') return `धन्यवाद। आपका ${s} सर्विस अनुरोध${p ? ` ${p}` : ''}${t ? ` ${t}` : ''} के लिए प्राप्त हो गया है। हमारी टीम आपसे जल्द संपर्क करेगी।`;
  if (language === 'mr') return `धन्यवाद. तुमची ${s} सर्विसची विनंती${p ? ` ${p}` : ''}${t ? ` ${t}` : ''} साठी प्राप्त झाली आहे. आमची टीम लवकरच तुमच्याशी संपर्क करेल.`;
  return `Thanks. Your ${s} service request${p ? ` in ${p}` : ''}${t ? ` for ${t}` : ''} has been received. Our team will contact you shortly.`;
}

export function confirmationChoice(language: SupportedLanguage): string {
  if (language === 'hi') return 'कृपया हाँ या नहीं बताएं।';
  if (language === 'mr') return 'कृपया होय किंवा नाही सांगा.';
  return 'Please reply Yes or No.';
}

export function chooseYesNo(language: SupportedLanguage): string { return confirmationChoice(language); }

export function priceUnavailable(language: SupportedLanguage): string {
  if (language === 'hi') return 'इस सर्विस की सटीक कीमत अभी उपलब्ध नहीं है। अंतिम कीमत जांच के बाद बताई जाएगी।';
  if (language === 'mr') return 'या सर्विसची अचूक किंमत सध्या उपलब्ध नाही. तपासणीनंतर अंतिम किंमत सांगितली जाईल.';
  return 'The exact price is not available right now. The final price will be confirmed after inspection.';
}

export function fallbackMessage(language: SupportedLanguage): string {
  if (language === 'hi') return 'मुझे हमारी सपोर्ट जानकारी में इसका विश्वसनीय उत्तर नहीं मिला।';
  if (language === 'mr') return 'आमच्या सपोर्ट माहितीत याचे विश्वसनीय उत्तर सापडले नाही.';
  return "I couldn't find a reliable answer from our support information.";
}

export function errorMessage(language: SupportedLanguage): string {
  if (language === 'hi') return 'माफ़ कीजिए, अभी कुछ तकनीकी समस्या आ गई है। कृपया थोड़ी देर बाद फिर कोशिश करें।';
  if (language === 'mr') return 'क्षमस्व, सध्या तांत्रिक अडचण आली आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.';
  return 'Sorry, something went wrong. Please try again in a moment.';
}

export function localizeRagResult(result: RAGResult, language: SupportedLanguage): RAGResult {
  return { ...result, language };
}

export function ticketPrompt(language: SupportedLanguage): string {
  if (language === 'hi') return 'क्या आप सपोर्ट टिकट बनाना चाहते हैं?';
  if (language === 'mr') return 'तुम्हाला सपोर्ट तिकीट तयार करायचे आहे का?';
  return 'Would you like me to create a support ticket?';
}

export function ticketCreated(ticketId: string, language: SupportedLanguage): string {
  if (language === 'hi') return `आपका सपोर्ट टिकट ${ticketId} बना दिया गया है।`;
  if (language === 'mr') return `तुमचे सपोर्ट तिकीट ${ticketId} तयार झाले आहे.`;
  return `Your support ticket ${ticketId} has been created.`;
}

export function ticketCancelled(language: SupportedLanguage): string {
  if (language === 'hi') return 'ठीक है। आप अपना अगला सवाल पूछ सकते हैं।';
  if (language === 'mr') return 'ठीक आहे. तुम्ही तुमचा पुढील प्रश्न विचारू शकता.';
  return 'Okay. You can continue chatting and ask another question.';
}
