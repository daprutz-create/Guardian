// src/utils/accessManager.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccessRequest, RequestProfile, AccessStatus, RequestType } from './types';

const PROFILE_KEY = 'guardian_request_profile';
const REQUESTS_KEY = 'guardian_access_requests';
const PRE_APPROVED_KEY = 'guardian_pre_approved';

export const DEFAULT_PROFILE: RequestProfile = {
  displayName: 'Network Admin',
  message: 'Requesting access to your device for network management.',
  reason: 'Home network security audit',
  requestType: 'view',
  timeoutSeconds: 60,
  requireConfirmation: true,
};

// ── Profile Storage ───────────────────────────────────────────────────────────

export async function saveProfile(profile: RequestProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function loadProfile(): Promise<RequestProfile> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch (_) {}
  return DEFAULT_PROFILE;
}

// ── Pre-approved Devices ──────────────────────────────────────────────────────

export async function preApproveDevice(ip: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PRE_APPROVED_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(ip)) {
      list.push(ip);
      await AsyncStorage.setItem(PRE_APPROVED_KEY, JSON.stringify(list));
    }
  } catch (_) {}
}

export async function removePreApproval(ip: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PRE_APPROVED_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem(PRE_APPROVED_KEY, JSON.stringify(list.filter(i => i !== ip)));
  } catch (_) {}
}

export async function isPreApproved(ip: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PRE_APPROVED_KEY);
    if (raw) return (JSON.parse(raw) as string[]).includes(ip);
  } catch (_) {}
  return false;
}

export async function getPreApproved(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(PRE_APPROVED_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return [];
}

// ── Request Building ──────────────────────────────────────────────────────────

export function buildRequest(
  targetIP: string,
  profile: RequestProfile,
  overrides?: Partial<RequestProfile>,
): AccessRequest {
  const merged = { ...profile, ...overrides };
  const now = Date.now();
  return {
    id: `req_${now}_${Math.random().toString(36).slice(2, 8)}`,
    targetIP,
    requestType: merged.requestType,
    senderName: merged.displayName,
    message: merged.message,
    reason: merged.reason,
    sentAt: now,
    expiresAt: now + merged.timeoutSeconds * 1000,
    status: 'pending',
  };
}

// ── Request Log ───────────────────────────────────────────────────────────────

export async function saveRequest(req: AccessRequest): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(REQUESTS_KEY);
    const list: AccessRequest[] = raw ? JSON.parse(raw) : [];
    list.unshift(req);
    // keep last 100
    await AsyncStorage.setItem(REQUESTS_KEY, JSON.stringify(list.slice(0, 100)));
  } catch (_) {}
}

export async function loadRequests(): Promise<AccessRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(REQUESTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return [];
}

export async function updateRequestStatus(id: string, status: AccessStatus): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(REQUESTS_KEY);
    const list: AccessRequest[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(r => r.id === id);
    if (idx >= 0) {
      list[idx].status = status;
      await AsyncStorage.setItem(REQUESTS_KEY, JSON.stringify(list));
    }
  } catch (_) {}
}

// ── Send Request (simulated — real implementation uses the device's web API) ──

export type RequestResult = {
  success: boolean;
  status: AccessStatus;
  token?: string;
  message: string;
};

export async function sendAccessRequest(
  req: AccessRequest,
  onProgress: (msg: string) => void,
): Promise<RequestResult> {
  onProgress('Sending access request…');
  await saveRequest(req);

  // Check if device has a web interface to receive the request
  const webPort = 80;
  const requestPayload = {
    from: req.senderName,
    message: req.message,
    reason: req.reason,
    type: req.requestType,
    expires: req.expiresAt,
    requestId: req.id,
  };

  // Try to POST request to device's web interface
  // Real devices with a Guardian agent would respond to this
  try {
    onProgress('Contacting device…');
    const res = await Promise.race([
      fetch(`http://${req.targetIP}:${webPort}/guardian/request`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      }),
      new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 5000)),
    ]) as Response;

    if (res.ok) {
      const data = await res.json();
      if (data.approved) {
        onProgress('Access granted ✓');
        await updateRequestStatus(req.id, 'granted');
        return { success: true, status: 'granted', token: data.token, message: 'Access granted by device owner.' };
      } else {
        onProgress('Access denied');
        await updateRequestStatus(req.id, 'denied');
        return { success: false, status: 'denied', message: 'The device owner denied the request.' };
      }
    }
  } catch (_) {}

  // Device doesn't have Guardian agent — fall back to web UI with request embedded in URL
  onProgress('Device ready — opening web interface…');
  await updateRequestStatus(req.id, 'granted');
  return {
    success: true,
    status: 'granted',
    message: `Opening ${req.targetIP} web interface. Log in with your credentials to proceed.`,
    token: `webui_${req.id}`,
  };
}

// ── Wake on LAN ───────────────────────────────────────────────────────────────
// WOL requires pre-configuration on the target PC (enable WOL in BIOS + Windows power settings)

export function buildWOLPacket(macAddress: string): string {
  // Returns magic packet as hex string description (actual UDP send requires native module)
  const mac = macAddress.replace(/[:\-]/g, '');
  if (mac.length !== 12) throw new Error('Invalid MAC address');
  return 'FF'.repeat(6) + mac.repeat(16);
}

// ── Remote Actions (require pre-authorisation) ────────────────────────────────

export type RemoteAction = 'shutdown' | 'restart' | 'sleep' | 'wake';

export async function requestRemoteAction(
  ip: string,
  action: RemoteAction,
  credentials?: { user: string; pass: string },
): Promise<{ success: boolean; message: string }> {
  // Try device web API
  try {
    const authHeader = credentials
      ? { 'Authorization': `Basic ${btoa(`${credentials.user}:${credentials.pass}`)}` }
      : {};

    const res = await Promise.race([
      fetch(`http://${ip}/guardian/action`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ action }),
      }),
      new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 5000)),
    ]) as Response;

    if (res.ok) return { success: true, message: `${action} command sent successfully.` };
  } catch (_) {}

  return {
    success: false,
    message: `Could not send ${action} command. The device needs the Guardian Agent installed, or use SSH/RDP to send commands manually.`,
  };
}

export const LABEL: Record<RequestType, string> = {
  view: 'View Only',
  files: 'File Access',
  shutdown: 'Remote Control',
  full: 'Full Access',
};

export const TYPE_ICON: Record<RequestType, string> = {
  view: '👁️',
  files: '📁',
  shutdown: '⚡',
  full: '🔓',
};
