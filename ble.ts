// src/utils/ble.ts
// Bluetooth LE scanning and advertising for Guardian v4
// Uses react-native-ble-plx for scanning, react-native-ble-advertiser for advertising

export interface BLEDevice {
  id: string;
  name?: string;
  localName?: string;
  rssi: number;
  txPower?: number;
  serviceUUIDs?: string[];
  manufacturerData?: string;
  isConnectable?: boolean;
  lastSeen: number;
  // enriched
  category: BLECategory;
  categoryIcon: string;
  threat: 'safe' | 'monitor' | 'suspicious';
}

export type BLECategory =
  | 'phone' | 'laptop' | 'audio' | 'wearable' | 'beacon'
  | 'smarttv' | 'iot' | 'tracker' | 'unknown';

// ── Device Classification ─────────────────────────────────────────────────────

const COMPANY_PREFIXES: Record<string, string> = {
  '004C': 'Apple',    '0006': 'Microsoft', '0075': 'Samsung',
  '00E0': 'Google',   '0157': 'Xiaomi',    '01EC': 'Sonos',
  '0171': 'Amazon',   '006B': 'Sony',      '001D': 'Plantronics',
  '0010': 'Jawbone',  '00DA': 'Cambridge Audio',
};

export function parseManufacturer(hex?: string): string | undefined {
  if (!hex || hex.length < 4) return undefined;
  // BLE manufacturer data: first 2 bytes are company ID (little-endian)
  const companyId = hex.slice(2, 4) + hex.slice(0, 2);
  return COMPANY_PREFIXES[companyId.toUpperCase()];
}

const SERVICE_MAP: Record<string, string> = {
  '1800': 'Generic Access', '1801': 'Generic Attribute',
  '180A': 'Device Information', '180F': 'Battery',
  '1812': 'HID (Input Device)', '110B': 'Audio Sink',
  '110A': 'Audio Source', '1108': 'Headset',
  '1105': 'OPP (File Transfer)', '180D': 'Heart Rate',
  '1816': 'Cycling Speed', '1814': 'Running Speed',
  'FE9A': 'Tile Tracker', 'FD5A': 'Apple AirTag',
  'FD6F': 'COVID Exposure', 'FEAA': 'Google Eddystone',
  'FE9F': 'Google FastPair', '0x003C': 'Apple Find My',
};

export function classifyDevice(device: Partial<BLEDevice>): { category: BLECategory; icon: string; threat: BLEDevice['threat'] } {
  const name = (device.name ?? device.localName ?? '').toLowerCase();
  const services = (device.serviceUUIDs ?? []).map(s => s.toUpperCase());
  const mfr = parseManufacturer(device.manufacturerData);

  // Trackers
  if (services.some(s => s.includes('FE9A') || s.includes('FD5A')) || name.includes('tile') || name.includes('airtag'))
    return { category: 'tracker', icon: '🏷️', threat: 'monitor' };

  // Audio
  if (name.match(/airpod|bud|headphone|earphone|headset|speaker|soundbar|jbl|bose|sony wf|wh-/) ||
    services.some(s => ['110B','110A','1108'].includes(s)))
    return { category: 'audio', icon: '🎧', threat: 'safe' };

  // Wearable
  if (name.match(/watch|band|fit|garmin|polar|suunto|galaxy watch/))
    return { category: 'wearable', icon: '⌚', threat: 'safe' };

  // Phone/Laptop
  if (mfr === 'Apple' || name.match(/iphone|ipad|mac|pixel|samsung|oneplus|huawei/))
    return { category: 'phone', icon: '📱', threat: 'safe' };

  if (name.match(/laptop|desktop|surface|thinkpad|macbook|dell|hp |lenovo/))
    return { category: 'laptop', icon: '💻', threat: 'safe' };

  // Smart TV
  if (name.match(/tv|television|bravia|vizio|roku|firetv|appletv|shield/))
    return { category: 'smarttv', icon: '📺', threat: 'safe' };

  // Beacon
  if (services.some(s => s.includes('FEAA')) || name.includes('beacon') || name.includes('eddystone'))
    return { category: 'beacon', icon: '📍', threat: 'monitor' };

  // IoT
  if (name.match(/bulb|lamp|switch|plug|sensor|thermostat|lock|camera|esp|arduino|raspi/))
    return { category: 'iot', icon: '🏠', threat: 'monitor' };

  return { category: 'unknown', icon: '📶', threat: 'safe' };
}

// ── Signal Strength ───────────────────────────────────────────────────────────

export function rssiToDistance(rssi: number, txPower = -59): string {
  if (rssi === 0) return 'Unknown';
  const ratio = rssi / txPower;
  if (ratio < 1) return `~${(Math.pow(ratio, 10)).toFixed(1)}m`;
  const dist = 0.89976 * Math.pow(ratio, 7.7095) + 0.111;
  if (dist < 1) return `~${Math.round(dist * 100)}cm`;
  if (dist > 100) return '>100m';
  return `~${dist.toFixed(1)}m`;
}

export function rssiBar(rssi: number): number {
  // returns 0-4 bars
  if (rssi >= -55) return 4;
  if (rssi >= -65) return 3;
  if (rssi >= -75) return 2;
  if (rssi >= -85) return 1;
  return 0;
}

export function rssiColor(rssi: number): string {
  if (rssi >= -60) return '#00ff6a';
  if (rssi >= -70) return '#7fff00';
  if (rssi >= -80) return '#ffb300';
  return '#ff6b6b';
}

// ── Advertise Profiles ────────────────────────────────────────────────────────

export interface AdvertiseProfile {
  id: string;
  name: string;
  deviceName: string;
  serviceUUID: string;
  txPower: number;
  description: string;
  icon: string;
}

export const ADVERTISE_PROFILES: AdvertiseProfile[] = [
  { id: 'custom', name: 'Custom Device', deviceName: 'Guardian', serviceUUID: '0000180A-0000-1000-8000-00805F9B34FB', txPower: -59, description: 'Broadcast as a custom named BLE device', icon: '📡' },
  { id: 'beacon', name: 'Eddystone Beacon', deviceName: 'Guardian-Beacon', serviceUUID: '0000FEAA-0000-1000-8000-00805F9B34FB', txPower: -59, description: 'Google Eddystone beacon broadcast for demo', icon: '📍' },
  { id: 'hid', name: 'HID Input Device', deviceName: 'Guardian-HID', serviceUUID: '00001812-0000-1000-8000-00805F9B34FB', txPower: -59, description: 'Appears as a Bluetooth keyboard/mouse', icon: '⌨️' },
  { id: 'heartrate', name: 'Heart Rate Monitor', deviceName: 'Guardian-HR', serviceUUID: '0000180D-0000-1000-8000-00805F9B34FB', txPower: -59, description: 'Simulates a fitness heart rate sensor', icon: '❤️' },
  { id: 'smartlock', name: 'Smart Lock', deviceName: 'Guardian-Lock', serviceUUID: '00001802-0000-1000-8000-00805F9B34FB', txPower: -59, description: 'Advertises as a generic smart lock device', icon: '🔐' },
];

// ── Service UUID lookup ───────────────────────────────────────────────────────

export function lookupService(uuid: string): string {
  const short = uuid.replace(/-.*/, '').replace('0000', '').toUpperCase();
  return SERVICE_MAP[short] ?? SERVICE_MAP[uuid.toUpperCase()] ?? uuid.slice(0, 8).toUpperCase();
}
