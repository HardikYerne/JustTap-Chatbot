import fs from 'node:fs';
import path from 'node:path';

import type { Lead, Ticket, Session } from './types.js';

const stateDir = path.resolve(
  process.env.JUSTTAP_STATE_DIR || 'data'
);

const stateFile = path.join(
  stateDir,
  'support-state.json'
);

export const tickets = new Map<string, Ticket>();
export const leads = new Map<string, Lead>();
const sessions = new Map<string, Session>();

function ensureStateDir(): void {
  fs.mkdirSync(stateDir, { recursive: true });
}

export function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function getSession(id: string): Session {
  let session = sessions.get(id);

  if (!session) {
    session = {
      id,
      messages: [],
      awaitingTicketConfirmation: false,
      pendingQuestion: '',
      pendingRagQuestion: '',
      pendingMissingFields: [],
      pendingRequest: undefined,
      language: 'en',
      audience: 'customer'
    };

    sessions.set(id, session);
  }

  return session;
}

export function clearSession(id: string): void {
  sessions.delete(id);
}

export function persist(): void {
  try {
    ensureStateDir();

    const tmpFile = `${stateFile}.tmp`;

    const data = JSON.stringify(
      {
        tickets: [...tickets.values()],
        leads: [...leads.values()]
      },
      null,
      2
    );

    // Atomic write: prevents an interrupted process from leaving
    // support-state.json empty/truncated.
    fs.writeFileSync(tmpFile, data, 'utf8');
    fs.renameSync(tmpFile, stateFile);
  } catch (error) {
    console.error('[STORE] Persist failed:', error);
  }
}

export function restore(): void {
  try {
    ensureStateDir();

    if (!fs.existsSync(stateFile)) {
      console.log('[STORE] No state file found. Starting fresh.');
      return;
    }

    const rawText = fs.readFileSync(stateFile, 'utf8').trim();

    // Empty/truncated file: start safely instead of crashing JSON.parse.
    if (!rawText) {
      console.warn('[STORE] State file is empty. Starting fresh.');
      return;
    }

    let raw: unknown;

    try {
      raw = JSON.parse(rawText);
    } catch (parseError) {
      console.warn(
        '[STORE] Invalid/corrupted state JSON. Starting fresh.',
        parseError
      );

      // Preserve the damaged file so data is not silently destroyed.
      const backupFile = `${stateFile}.corrupt-${Date.now()}`;

      try {
        fs.renameSync(stateFile, backupFile);
        console.warn(`[STORE] Corrupt state backed up to: ${backupFile}`);
      } catch (backupError) {
        console.warn(
          '[STORE] Could not back up corrupt state file:',
          backupError
        );
      }

      return;
    }

    if (!raw || typeof raw !== 'object') {
      console.warn('[STORE] Invalid state structure. Starting fresh.');
      return;
    }

    const state = raw as {
      tickets?: unknown;
      leads?: unknown;
    };

    if (Array.isArray(state.tickets)) {
      for (const ticket of state.tickets) {
        if (
          ticket &&
          typeof ticket === 'object' &&
          'id' in ticket &&
          typeof ticket.id === 'string'
        ) {
          tickets.set(ticket.id, ticket as Ticket);
        }
      }
    }

    if (Array.isArray(state.leads)) {
      for (const lead of state.leads) {
        if (
          lead &&
          typeof lead === 'object' &&
          'id' in lead &&
          typeof lead.id === 'string'
        ) {
          leads.set(lead.id, lead as Lead);
        }
      }
    }

    console.log(
      `[STORE] Restored ${tickets.size} tickets and ${leads.size} leads`
    );
  } catch (error) {
    console.error('[STORE] Restore failed:', error);
  }
}

restore();
