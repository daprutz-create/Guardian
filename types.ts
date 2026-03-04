// src/utils/types.ts

export type ThreatLevel = 'safe' | 'monitor' | 'suspicious';
export type AccessStatus = 'pending' | 'granted' | 'denied' | 'expired' | 'pre-approved';
export type RequestType = 'view' | 'files' | 'shutdown' | 'full';
export type ScanState = 'idle' | 'scanning' | 'stopped' | 'complete';

export interface DeviceResult {
  ip: string;
  openPorts: number[];
  portLabels: string[];
  isGateway: boolean;
  isSuspicious: boolean;
  deviceType: string;
  deviceIcon: string;
  threatLevel: ThreatLevel;
  webUiUrl?: string;
  lastSeen: number;
  // Deep probe
  fingerprint?: DeviceFingerprint;
  upnpInfo?: UPnPInfo;
  defaultCredResult?: DefaultCredResult;
  vulnReport?: VulnReport;
  accessStatus?: AccessStatus;
  accessToken?: string;
}

export interface DeviceFingerprint {
  vendor?: string;
  serverHeader?: string;
  wwwAuthenticate?: string;
  poweredBy?: string;
  pageTitle?: string;
  raw: Record<string, string>;
}

export interface UPnPInfo {
  friendlyName?: string;
  manufacturer?: string;
  modelName?: string;
  modelNumber?: string;
  serialNumber?: string;
  deviceType?: string;
  presentationUrl?: string;
  services: string[];
}

export interface DefaultCredResult {
  tested: number;
  vulnerable: boolean;
  workingCred?: { user: string; pass: string };
  checkedAt: string;
}

export interface VulnReport {
  scannedAt: string;
  vulns: Vulnerability[];
  score: number; // 0-100, higher = more vulnerable
}

export interface Vulnerability {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  recommendation: string;
  port?: number;
}

export interface AccessRequest {
  id: string;
  targetIP: string;
  requestType: RequestType;
  senderName: string;
  message: string;
  reason: string;
  sentAt: number;
  expiresAt: number;
  status: AccessStatus;
}

export interface RequestProfile {
  displayName: string;
  message: string;
  reason: string;
  requestType: RequestType;
  timeoutSeconds: number;
  requireConfirmation: boolean;
}

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
}
