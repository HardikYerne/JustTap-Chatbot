import type { RAGResult } from '../rag/types.js';
import type { SupportedLanguage } from '../types.js';
import {
  genericPrompt,
  locationPrompt,
  namePrompt,
  phonePrompt,
  priceUnavailable,
  serviceConfirmationPrompt,
  serviceRequestStarted,
  timePrompt
} from '../language/responses.js';

export type ResponseKind =
  | 'chat'
  | 'field_request'
  | 'service_confirmation'
  | 'service_request_created';

export interface ResponseContext {
  language: SupportedLanguage;
  service?: string;
  query: string;
  missingFields?: string[];
  location?: string;
  requestedTime?: string;
}

export interface GeneratedResponse {
  answer: string;
  type: ResponseKind;
  intent: string;
  service: string;
  missingFields: string[];
}

/**
 * Response generation is intentionally independent from the knowledge
 * retrieval algorithm. RAG decides WHAT the answer is about; this layer
 * decides HOW it should be presented and whether a booking state is needed.
 */
export function generateResponse(
  result: RAGResult,
  context: ResponseContext
): GeneratedResponse {
  const intent = result.intent || 'unknown_query';
  const service =
    context.service ||
    result.service ||
    '';

  const missingFields = [
    ...new Set(context.missingFields ?? result.missingFields ?? [])
  ];

  // Informational intents must never enter the booking flow.
  // This is the generic fix for price/availability/service-information queries.
  if (
    intent !== 'book_service' &&
    intent !== 'create_ticket' &&
    intent !== 'confirm_request'
  ) {
    let answer = result.answer?.trim();

    if (!answer) {
      answer =
        intent === 'ask_price'
          ? priceUnavailable(context.language)
          : genericPrompt(context.language);
    }

    return {
      answer,
      type: 'chat',
      intent,
      service,
      missingFields
    };
  }

  if (intent === 'book_service') {
    const field = missingFields[0];

    if (field === 'location') {
      return {
        answer: locationPrompt(context.language),
        type: 'field_request',
        intent,
        service,
        missingFields
      };
    }

    if (field === 'requested_time') {
      return {
        answer: timePrompt(context.language),
        type: 'field_request',
        intent,
        service,
        missingFields
      };
    }

    if (field === 'name') {
      return {
        answer: namePrompt(context.language),
        type: 'field_request',
        intent,
        service,
        missingFields
      };
    }

    if (field === 'phone') {
      return {
        answer: phonePrompt(context.language),
        type: 'field_request',
        intent,
        service,
        missingFields
      };
    }

    if (field === 'service_confirmation') {
      return {
        answer: serviceConfirmationPrompt(
          service,
          context.location,
          context.requestedTime,
          context.language
        ),
        type: 'service_confirmation',
        intent,
        service,
        missingFields
      };
    }

    // A complete booking intent should not claim the service is booked.
    return {
      answer: serviceRequestStarted(service, context.language),
      type: 'chat',
      intent,
      service,
      missingFields: []
    };
  }

  return {
    answer: result.answer?.trim() || genericPrompt(context.language),
    type: 'chat',
    intent,
    service,
    missingFields
  };
}

/**
 * Decide whether a new RAG intent is allowed to interrupt a pending
 * service conversation. Informational questions can be answered without
 * destroying the pending request; booking state remains in the session.
 */
export function shouldInterruptPendingBooking(
  pendingIntent: string | undefined,
  newIntent: string | undefined
): boolean {
  if (pendingIntent !== 'book_service') return false;

  return (
    newIntent !== undefined &&
    newIntent !== 'book_service'
  );
}
