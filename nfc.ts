// src/utils/nfc.ts
// NFC card management for Guardian v4
// Uses react-native-nfc-manager

export type NFCTagType = 'MIFARE_CLASSIC' | 'MIFARE_ULTRALIGHT' | 'NTAG' | 'ISO_DEP' | 'ISO_15693' | 'UNKNOWN';

export interface NFCCard {
  id: string;               // unique DB id
  uid: string;              // card UID (hex)
  tagType: NFCTagType;
  techTypes: string[];
  rawData?: string;         // hex dump of readable sectors
  ndefMessage?: string;     // NDEF text if present
  employeeName?: string;    // assigned employee
  employeeId?: string;
  issuedDate: string;
  notes?: string;
  cardType: 'employee' | 'master' | 'visitor' | 'raw';
}

export interface ScanResult {
  success: boolean;
  card?: NFCCard;
  error?: string;
}

export interface WriteResult {
  success: boolean;
  error?: string;
}

// ── Tag type detection ────────────────────────────────────────────────────────

export function detectTagType(techTypes: string[]): NFCTagType {
  if (techTypes.some(t => t.includes('MifareClassic'))) return 'MIFARE_CLASSIC';
  if (techTypes.some(t => t.includes('MifareUltralight'))) return 'MIFARE_ULTRALIGHT';
  if (techTypes.some(t => t.includes('NfcA')) && techTypes.some(t => t.includes('Ndef'))) return 'NTAG';
  if (techTypes.some(t => t.includes('IsoDep'))) return 'ISO_DEP';
  if (techTypes.some(t => t.includes('NfcV'))) return 'ISO_15693';
  return 'UNKNOWN';
}

export function tagTypeLabel(t: NFCTagType): string {
  const map: Record<NFCTagType, string> = {
    MIFARE_CLASSIC: 'MIFARE Classic (1K/4K)',
    MIFARE_ULTRALIGHT: 'MIFARE Ultralight',
    NTAG: 'NTAG (NFC Forum)',
    ISO_DEP: 'ISO-DEP / ISO 14443-4',
    ISO_15693: 'ISO 15693 (vicinity)',
    UNKNOWN: 'Unknown Type',
  };
  return map[t];
}

export function tagTypeColor(t: NFCTagType): string {
  if (t === 'MIFARE_CLASSIC') return '#00ff6a';
  if (t === 'MIFARE_ULTRALIGHT') return '#4fc3f7';
  if (t === 'NTAG') return '#ffb300';
  if (t === 'ISO_DEP') return '#ce93d8';
  return '#888';
}

// ── UID formatting ────────────────────────────────────────────────────────────

export function formatUID(bytes: number[]): string {
  return bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(':');
}

export function uidToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join('');
}

// ── NDEF message builder ──────────────────────────────────────────────────────

export function buildNDEFText(text: string): object {
  // Returns NDEF record for react-native-nfc-manager
  return {
    tnf: 1,  // NFC_WELL_KNOWN
    type: [0x54], // 'T' = Text record
    payload: encodeNDEFText(text),
  };
}

function encodeNDEFText(text: string): number[] {
  const lang = 'en';
  const langBytes = lang.split('').map(c => c.charCodeAt(0));
  const textBytes = text.split('').map(c => {
    const code = c.charCodeAt(0);
    return code > 127 ? 63 : code; // fallback non-ASCII to '?'
  });
  const status = langBytes.length;
  return [status, ...langBytes, ...textBytes];
}

export function buildEmployeeNDEF(card: Partial<NFCCard>): string {
  return JSON.stringify({
    app: 'GUARDIAN',
    type: card.cardType ?? 'employee',
    name: card.employeeName ?? '',
    id: card.employeeId ?? '',
    issued: card.issuedDate ?? new Date().toISOString(),
    notes: card.notes ?? '',
  });
}

export function parseEmployeeNDEF(raw: string): Partial<NFCCard> | null {
  try {
    const data = JSON.parse(raw);
    if (data.app !== 'GUARDIAN') return null;
    return {
      employeeName: data.name,
      employeeId: data.id,
      issuedDate: data.issued,
      notes: data.notes,
      cardType: data.type,
    };
  } catch (_) {
    return null;
  }
}

// ── Card DB (stored in AsyncStorage) ─────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

const CARDS_KEY = 'guardian_nfc_cards';

export async function saveCard(card: NFCCard): Promise<void> {
  const all = await loadAllCards();
  const idx = all.findIndex(c => c.id === card.id);
  if (idx >= 0) all[idx] = card;
  else all.unshift(card);
  await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(all));
}

export async function loadAllCards(): Promise<NFCCard[]> {
  try {
    const raw = await AsyncStorage.getItem(CARDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) { return []; }
}

export async function deleteCard(id: string): Promise<void> {
  const all = await loadAllCards();
  await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(all.filter(c => c.id !== id)));
}

export function newCardId(): string {
  return `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Utility ───────────────────────────────────────────────────────────────────

export function cardTypeIcon(t: NFCCard['cardType']): string {
  return { employee: '👤', master: '👑', visitor: '🎫', raw: '💾' }[t] ?? '🏷️';
}

export function cardTypeLabel(t: NFCCard['cardType']): string {
  return { employee: 'Employee', master: 'Master Key', visitor: 'Visitor', raw: 'Raw Data' }[t] ?? t;
}
