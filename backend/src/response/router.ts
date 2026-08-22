import type { RAGResult } from '../rag/types.js';

export type ConversationRoute =
  | 'continue_booking'
  | 'new_intent'
  | 'normal_chat';

export interface RouteDecision {
  route: ConversationRoute;
  preservePendingRequest: boolean;
}

/**
 * Pending booking is state, not a reason to classify every subsequent
 * message as a booking field. A new informational intent can be answered
 * while preserving the pending booking.
 */
export function routeConversation(
  pendingIntent: string | undefined,
  result: RAGResult | undefined
): RouteDecision {
  if (!pendingIntent) {
    return {
      route: result?.matched ? 'new_intent' : 'normal_chat',
      preservePendingRequest: false
    };
  }

  if (pendingIntent === 'book_service') {
    if (result?.matched && result.intent !== 'book_service') {
      return {
        route: 'new_intent',
        preservePendingRequest: true
      };
    }

    return {
      route: 'continue_booking',
      preservePendingRequest: true
    };
  }

  return {
    route: result?.matched ? 'new_intent' : 'normal_chat',
    preservePendingRequest: true
  };
}
