// src/utils/ir.ts
// IR Remote control for Guardian v4
// Uses react-native-ir-manager (wraps Android ConsumerIrManager)

export interface IRDevice {
  id: string;
  name: string;
  brand: string;
  type: IRDeviceType;
  icon: string;
  commands: IRCommand[];
}

export type IRDeviceType = 'tv' | 'ac' | 'projector' | 'audio' | 'fan' | 'custom';

export interface IRCommand {
  id: string;
  label: string;
  icon: string;
  frequency: number;    // Hz, usually 38000
  pattern: number[];    // pulse/pause pattern in microseconds
  color?: string;
}

// ── Frequency helpers ─────────────────────────────────────────────────────────

export const IR_FREQ = {
  STANDARD: 38000,  // 38kHz — used by most devices
  SONY: 40000,      // Sony uses 40kHz
  SHARP: 38000,
  SAMSUNG: 38000,
};

// ── NEC protocol encoder (used by most TVs) ───────────────────────────────────

function necBit1(): number[] { return [560, 1690]; }
function necBit0(): number[] { return [560, 560]; }
function necHeader(): number[] { return [9000, 4500]; }
function necStop(): number[] { return [560]; }

export function encodeNEC(address: number, command: number): number[] {
  const bits: number[] = [];
  const addr = address & 0xFF;
  const addrInv = (~address) & 0xFF;
  const cmd = command & 0xFF;
  const cmdInv = (~command) & 0xFF;

  const data = [addr, addrInv, cmd, cmdInv];
  const pattern = [...necHeader()];

  for (const byte of data) {
    for (let i = 0; i < 8; i++) {
      if ((byte >> i) & 1) pattern.push(...necBit1());
      else pattern.push(...necBit0());
    }
  }
  pattern.push(...necStop());
  return pattern;
}

// ── Samsung protocol (used by Samsung TVs) ───────────────────────────────────

export function encodeSamsung(address: number, command: number): number[] {
  return encodeNEC(address, command); // Samsung uses NEC variant
}

// ── Sony SIRC protocol ────────────────────────────────────────────────────────

export function encodeSony(command: number, address: number): number[] {
  const pattern = [2400, 600]; // header
  const bits = (command & 0x7F) | ((address & 0x1F) << 7);
  for (let i = 0; i < 12; i++) {
    if ((bits >> i) & 1) pattern.push(1200, 600);
    else pattern.push(600, 600);
  }
  return pattern;
}

// ── Built-in device profiles ──────────────────────────────────────────────────

export const BUILTIN_DEVICES: IRDevice[] = [
  {
    id: 'samsung_tv',
    name: 'Samsung TV',
    brand: 'Samsung',
    type: 'tv',
    icon: '📺',
    commands: [
      { id: 'power', label: 'Power', icon: '⏻', frequency: 38000, pattern: encodeNEC(0x07, 0x02), color: '#ff3d3d' },
      { id: 'vol_up', label: 'Vol +', icon: '🔊', frequency: 38000, pattern: encodeNEC(0x07, 0x07) },
      { id: 'vol_down', label: 'Vol -', icon: '🔉', frequency: 38000, pattern: encodeNEC(0x07, 0x0B) },
      { id: 'mute', label: 'Mute', icon: '🔇', frequency: 38000, pattern: encodeNEC(0x07, 0x0F) },
      { id: 'ch_up', label: 'CH +', icon: '⬆️', frequency: 38000, pattern: encodeNEC(0x07, 0x12) },
      { id: 'ch_down', label: 'CH -', icon: '⬇️', frequency: 38000, pattern: encodeNEC(0x07, 0x10) },
      { id: 'hdmi1', label: 'HDMI 1', icon: '1️⃣', frequency: 38000, pattern: encodeNEC(0x07, 0x62) },
      { id: 'hdmi2', label: 'HDMI 2', icon: '2️⃣', frequency: 38000, pattern: encodeNEC(0x07, 0x63) },
      { id: 'menu', label: 'Menu', icon: '☰', frequency: 38000, pattern: encodeNEC(0x07, 0x1A) },
      { id: 'home', label: 'Home', icon: '🏠', frequency: 38000, pattern: encodeNEC(0x07, 0x79) },
      { id: 'back', label: 'Back', icon: '↩️', frequency: 38000, pattern: encodeNEC(0x07, 0x58) },
      { id: 'ok', label: 'OK', icon: '✓', frequency: 38000, pattern: encodeNEC(0x07, 0x68) },
      { id: 'up', label: '▲', icon: '▲', frequency: 38000, pattern: encodeNEC(0x07, 0x60) },
      { id: 'down', label: '▼', icon: '▼', frequency: 38000, pattern: encodeNEC(0x07, 0x61) },
      { id: 'left', label: '◀', icon: '◀', frequency: 38000, pattern: encodeNEC(0x07, 0x65) },
      { id: 'right', label: '▶', icon: '▶', frequency: 38000, pattern: encodeNEC(0x07, 0x62) },
    ],
  },
  {
    id: 'lg_tv',
    name: 'LG TV',
    brand: 'LG',
    type: 'tv',
    icon: '📺',
    commands: [
      { id: 'power', label: 'Power', icon: '⏻', frequency: 38000, pattern: encodeNEC(0x04, 0x08), color: '#ff3d3d' },
      { id: 'vol_up', label: 'Vol +', icon: '🔊', frequency: 38000, pattern: encodeNEC(0x04, 0x02) },
      { id: 'vol_down', label: 'Vol -', icon: '🔉', frequency: 38000, pattern: encodeNEC(0x04, 0x03) },
      { id: 'mute', label: 'Mute', icon: '🔇', frequency: 38000, pattern: encodeNEC(0x04, 0x09) },
      { id: 'ch_up', label: 'CH +', icon: '⬆️', frequency: 38000, pattern: encodeNEC(0x04, 0x00) },
      { id: 'ch_down', label: 'CH -', icon: '⬇️', frequency: 38000, pattern: encodeNEC(0x04, 0x01) },
      { id: 'hdmi1', label: 'HDMI 1', icon: '1️⃣', frequency: 38000, pattern: encodeNEC(0x04, 0xAE) },
      { id: 'home', label: 'Home', icon: '🏠', frequency: 38000, pattern: encodeNEC(0x04, 0x7C) },
      { id: 'back', label: 'Back', icon: '↩️', frequency: 38000, pattern: encodeNEC(0x04, 0x28) },
      { id: 'ok', label: 'OK', icon: '✓', frequency: 38000, pattern: encodeNEC(0x04, 0x44) },
      { id: 'up', label: '▲', icon: '▲', frequency: 38000, pattern: encodeNEC(0x04, 0x40) },
      { id: 'down', label: '▼', icon: '▼', frequency: 38000, pattern: encodeNEC(0x04, 0x41) },
      { id: 'left', label: '◀', icon: '◀', frequency: 38000, pattern: encodeNEC(0x04, 0x07) },
      { id: 'right', label: '▶', icon: '▶', frequency: 38000, pattern: encodeNEC(0x04, 0x06) },
    ],
  },
  {
    id: 'sony_tv',
    name: 'Sony TV',
    brand: 'Sony',
    type: 'tv',
    icon: '📺',
    commands: [
      { id: 'power', label: 'Power', icon: '⏻', frequency: 40000, pattern: encodeSony(0x15, 0x01), color: '#ff3d3d' },
      { id: 'vol_up', label: 'Vol +', icon: '🔊', frequency: 40000, pattern: encodeSony(0x12, 0x01) },
      { id: 'vol_down', label: 'Vol -', icon: '🔉', frequency: 40000, pattern: encodeSony(0x13, 0x01) },
      { id: 'mute', label: 'Mute', icon: '🔇', frequency: 40000, pattern: encodeSony(0x14, 0x01) },
      { id: 'ch_up', label: 'CH +', icon: '⬆️', frequency: 40000, pattern: encodeSony(0x10, 0x01) },
      { id: 'ch_down', label: 'CH -', icon: '⬇️', frequency: 40000, pattern: encodeSony(0x11, 0x01) },
      { id: 'home', label: 'Home', icon: '🏠', frequency: 40000, pattern: encodeSony(0x60, 0x01) },
      { id: 'ok', label: 'OK', icon: '✓', frequency: 40000, pattern: encodeSony(0x65, 0x01) },
      { id: 'up', label: '▲', icon: '▲', frequency: 40000, pattern: encodeSony(0x74, 0x01) },
      { id: 'down', label: '▼', icon: '▼', frequency: 40000, pattern: encodeSony(0x75, 0x01) },
    ],
  },
  {
    id: 'generic_ac',
    name: 'Generic AC',
    brand: 'Generic',
    type: 'ac',
    icon: '❄️',
    commands: [
      { id: 'power', label: 'Power', icon: '⏻', frequency: 38000, pattern: encodeNEC(0x00, 0x02), color: '#ff3d3d' },
      { id: 'cool', label: 'Cool', icon: '❄️', frequency: 38000, pattern: encodeNEC(0x00, 0x01), color: '#4fc3f7' },
      { id: 'heat', label: 'Heat', icon: '🔥', frequency: 38000, pattern: encodeNEC(0x00, 0x03), color: '#ff6b35' },
      { id: 'fan', label: 'Fan', icon: '💨', frequency: 38000, pattern: encodeNEC(0x00, 0x04) },
      { id: 'temp_up', label: 'Temp +', icon: '🌡️+', frequency: 38000, pattern: encodeNEC(0x00, 0x10) },
      { id: 'temp_down', label: 'Temp -', icon: '🌡️-', frequency: 38000, pattern: encodeNEC(0x00, 0x11) },
      { id: 'fan_up', label: 'Fan +', icon: '⬆️', frequency: 38000, pattern: encodeNEC(0x00, 0x12) },
      { id: 'fan_down', label: 'Fan -', icon: '⬇️', frequency: 38000, pattern: encodeNEC(0x00, 0x13) },
      { id: 'swing', label: 'Swing', icon: '↔️', frequency: 38000, pattern: encodeNEC(0x00, 0x14) },
      { id: 'timer', label: 'Timer', icon: '⏱️', frequency: 38000, pattern: encodeNEC(0x00, 0x15) },
    ],
  },
  {
    id: 'projector',
    name: 'Generic Projector',
    brand: 'Generic',
    type: 'projector',
    icon: '📽️',
    commands: [
      { id: 'power', label: 'Power', icon: '⏻', frequency: 38000, pattern: encodeNEC(0x02, 0x01), color: '#ff3d3d' },
      { id: 'source', label: 'Source', icon: '📥', frequency: 38000, pattern: encodeNEC(0x02, 0x06) },
      { id: 'vol_up', label: 'Vol +', icon: '🔊', frequency: 38000, pattern: encodeNEC(0x02, 0x02) },
      { id: 'vol_down', label: 'Vol -', icon: '🔉', frequency: 38000, pattern: encodeNEC(0x02, 0x03) },
      { id: 'zoom_in', label: 'Zoom +', icon: '🔍', frequency: 38000, pattern: encodeNEC(0x02, 0x10) },
      { id: 'zoom_out', label: 'Zoom -', icon: '🔎', frequency: 38000, pattern: encodeNEC(0x02, 0x11) },
      { id: 'menu', label: 'Menu', icon: '☰', frequency: 38000, pattern: encodeNEC(0x02, 0x08) },
      { id: 'ok', label: 'OK', icon: '✓', frequency: 38000, pattern: encodeNEC(0x02, 0x15) },
      { id: 'up', label: '▲', icon: '▲', frequency: 38000, pattern: encodeNEC(0x02, 0x0A) },
      { id: 'down', label: '▼', icon: '▼', frequency: 38000, pattern: encodeNEC(0x02, 0x0B) },
      { id: 'freeze', label: 'Freeze', icon: '⏸️', frequency: 38000, pattern: encodeNEC(0x02, 0x07) },
      { id: 'blank', label: 'Blank', icon: '⬛', frequency: 38000, pattern: encodeNEC(0x02, 0x0C) },
    ],
  },
];

// ── Custom device storage ─────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

const CUSTOM_DEVICES_KEY = 'guardian_ir_devices';

export async function saveCustomDevice(device: IRDevice): Promise<void> {
  const all = await loadCustomDevices();
  const idx = all.findIndex(d => d.id === device.id);
  if (idx >= 0) all[idx] = device;
  else all.push(device);
  await AsyncStorage.setItem(CUSTOM_DEVICES_KEY, JSON.stringify(all));
}

export async function loadCustomDevices(): Promise<IRDevice[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_DEVICES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) { return []; }
}

export async function getAllDevices(): Promise<IRDevice[]> {
  const custom = await loadCustomDevices();
  return [...BUILTIN_DEVICES, ...custom];
}
