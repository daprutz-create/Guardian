// src/utils/scanner.ts
import {
  DeviceResult, DeviceFingerprint, UPnPInfo,
  DefaultCredResult, VulnReport, Vulnerability,
} from './types';

export const PORT_MAP: Record<number, string> = {
  21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP',
  53: 'DNS', 80: 'HTTP', 110: 'POP3', 139: 'NetBIOS',
  143: 'IMAP', 443: 'HTTPS', 445: 'SMB', 515: 'LPD',
  554: 'RTSP', 631: 'IPP', 1900: 'UPnP', 3306: 'MySQL',
  3389: 'RDP', 5000: 'UPnP-Alt', 5555: 'ADB',
  7547: 'TR-069', 8080: 'HTTP-Alt', 8443: 'HTTPS-Alt',
  8888: 'HTTP-Dev', 9000: 'HTTP-Dev2', 9090: 'HTTP-Mgmt',
  49000: 'UPnP-IGD',
};

export const SUSPICIOUS_PORTS = [23, 139, 445, 3306, 3389, 5555, 7547];
export const SCAN_PORTS = Object.keys(PORT_MAP).map(Number);

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getSubnet(ip: string): string {
  return ip.split('.').slice(0, 3).join('.');
}

export function getWebUiUrl(ip: string, ports: number[]): string | undefined {
  if (ports.includes(443)) return `https://${ip}`;
  if (ports.includes(80)) return `http://${ip}`;
  if (ports.includes(8080)) return `http://${ip}:8080`;
  if (ports.includes(8443)) return `https://${ip}:8443`;
  if (ports.includes(9090)) return `http://${ip}:9090`;
  return undefined;
}

export function getDeviceIcon(last: number, ports: number[]): string {
  if (last === 1 || last === 254) return '🔀';
  if (ports.includes(554)) return '📷';
  if (ports.includes(5555)) return '📱';
  if (ports.includes(3389)) return '🖥️';
  if (ports.includes(3306)) return '🗄️';
  if (ports.includes(22)) return '💻';
  if (ports.includes(445) || ports.includes(139)) return '🗂️';
  if (ports.includes(631) || ports.includes(515)) return '🖨️';
  if (ports.includes(80) || ports.includes(443)) return '🌐';
  if (ports.includes(21)) return '📁';
  return '📡';
}

export function getDeviceType(last: number, ports: number[]): string {
  if (last === 1 || last === 254) return 'Router / Gateway';
  if (ports.includes(554)) return 'IP Camera / NVR';
  if (ports.includes(5555)) return 'Android Device';
  if (ports.includes(3389)) return 'Windows PC';
  if (ports.includes(3306)) return 'Database Server';
  if (ports.includes(631) || ports.includes(515)) return 'Network Printer';
  if (ports.includes(445) || ports.includes(139)) return 'Windows Share';
  if (ports.includes(22)) return 'Linux / Server';
  if (ports.includes(80) || ports.includes(443)) return 'Web Device';
  return 'Network Device';
}

export function buildDevice(ip: string, openPorts: number[]): DeviceResult {
  const last = parseInt(ip.split('.')[3], 10);
  const isGateway = last === 1 || last === 254;
  const isSuspicious = openPorts.some(p => SUSPICIOUS_PORTS.includes(p));
  const portLabels = openPorts.map(p => `${p}(${PORT_MAP[p] ?? '?'})`);
  let threatLevel: DeviceResult['threatLevel'] = 'safe';
  if (isSuspicious) threatLevel = 'suspicious';
  else if (openPorts.length > 4) threatLevel = 'monitor';
  return {
    ip, openPorts, portLabels, isGateway, isSuspicious,
    deviceType: getDeviceType(last, openPorts),
    deviceIcon: getDeviceIcon(last, openPorts),
    threatLevel,
    webUiUrl: getWebUiUrl(ip, openPorts),
    lastSeen: Date.now(),
  };
}

// ── Port Probing ──────────────────────────────────────────────────────────────

async function probePort(ip: string, port: number, ms: number): Promise<boolean> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), ms);
    const t0 = Date.now();
    fetch(`http://${ip}:${port}/`, { mode: 'no-cors' })
      .then(() => { clearTimeout(timer); resolve(true); })
      .catch(() => { clearTimeout(timer); resolve(Date.now() - t0 < ms * 0.68); });
  });
}

export async function probeHost(ip: string, ms = 900): Promise<{ alive: boolean; openPorts: number[] }> {
  const res = await Promise.all(SCAN_PORTS.map(p => probePort(ip, p, ms).then(ok => ok ? p : null)));
  const openPorts = res.filter((p): p is number => p !== null);
  return { alive: openPorts.length > 0, openPorts };
}

// ── Fingerprinting ────────────────────────────────────────────────────────────

export async function fingerprintDevice(ip: string, ports: number[]): Promise<DeviceFingerprint> {
  const raw: Record<string, string> = {};
  const port = ports.includes(80) ? 80 : ports.includes(8080) ? 8080 : ports.includes(8443) ? 8443 : 80;
  const scheme = port === 8443 || port === 443 ? 'https' : 'http';

  const VENDOR_SIGS: [string, string][] = [
    ['hikvision', 'Hikvision'], ['dahua', 'Dahua'], ['tp-link', 'TP-Link'],
    ['netgear', 'Netgear'], ['asus router', 'ASUS'], ['linksys', 'Linksys'],
    ['d-link', 'D-Link'], ['synology', 'Synology'], ['ubiquiti', 'Ubiquiti'],
    ['unifi', 'Ubiquiti UniFi'], ['mikrotik', 'MikroTik'], ['openwrt', 'OpenWRT'],
    ['dd-wrt', 'DD-WRT'], ['pfsense', 'pfSense'], ['fritz', 'AVM FRITZ!Box'],
    ['tenda', 'Tenda'], ['xiaomi', 'Xiaomi Mi Router'], ['zyxel', 'ZyXEL'],
    ['aruba', 'Aruba'], ['cisco', 'Cisco'], ['raspberry', 'Raspberry Pi'],
    ['qnap', 'QNAP NAS'], ['buffalo', 'Buffalo NAS'], ['western digital', 'WD NAS'],
    ['samsung smart', 'Samsung Smart TV'], ['lg smart', 'LG Smart TV'],
    ['roku', 'Roku'], ['apple tv', 'Apple TV'], ['chromecast', 'Chromecast'],
  ];

  try {
    const res = await Promise.race([
      fetch(`${scheme}://${ip}:${port}/`, { mode: 'cors' }),
      new Promise<never>((_, r) => setTimeout(() => r(new Error('t/o')), 3500)),
    ]) as Response;

    const hdrs = ['server','x-powered-by','www-authenticate','x-generator','x-device-type','x-firmware'];
    hdrs.forEach(h => { const v = res.headers?.get(h); if (v) raw[h] = v; });

    try {
      const html = await res.text();
      const t = html.match(/<title[^>]*>([^<]{1,100})<\/title>/i);
      if (t) raw['page-title'] = t[1].trim();
      const lower = html.toLowerCase();
      for (const [sig, vendor] of VENDOR_SIGS) {
        if (lower.includes(sig)) { raw['vendor'] = vendor; break; }
      }
    } catch (_) {}
  } catch (_) {}

  const vendor = raw['vendor'] ?? parseServerVendor(raw['server']);
  return {
    vendor, pageTitle: raw['page-title'],
    serverHeader: raw['server'], wwwAuthenticate: raw['www-authenticate'],
    poweredBy: raw['x-powered-by'], raw,
  };
}

function parseServerVendor(s?: string): string | undefined {
  if (!s) return undefined;
  const l = s.toLowerCase();
  if (l.includes('nginx')) return 'nginx';
  if (l.includes('apache')) return 'Apache';
  if (l.includes('mini_httpd')) return 'Embedded (mini_httpd)';
  if (l.includes('lighttpd')) return 'lighttpd';
  if (l.includes('uc-httpd')) return 'Embedded (UC-HTTPd)';
  return s.split('/')[0].trim() || undefined;
}

// ── UPnP ──────────────────────────────────────────────────────────────────────

export async function discoverUPnP(ip: string): Promise<UPnPInfo | null> {
  const urls = [
    `http://${ip}:1900/rootDesc.xml`, `http://${ip}:49000/rootDesc.xml`,
    `http://${ip}:49000/igddesc.xml`, `http://${ip}:5000/rootDesc.xml`,
    `http://${ip}:80/rootDesc.xml`, `http://${ip}:80/description.xml`,
    `http://${ip}:80/upnp/IGD.xml`,
  ];
  for (const url of urls) {
    try {
      const res = await Promise.race([
        fetch(url, { mode: 'cors' }),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('t/o')), 2000)),
      ]) as Response;
      if (!res.ok) continue;
      const xml = await res.text();
      if (xml.includes('<root') || xml.includes('<device>')) return parseUPnP(xml);
    } catch (_) {}
  }
  return null;
}

function parseUPnP(xml: string): UPnPInfo {
  const g = (tag: string) => xml.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'))?.[1]?.trim();
  const services: string[] = [];
  for (const m of xml.matchAll(/<serviceType>([^<]+)<\/serviceType>/gi)) {
    const s = m[1].trim();
    if (!services.includes(s)) services.push(s);
  }
  return {
    friendlyName: g('friendlyName'), manufacturer: g('manufacturer'),
    modelName: g('modelName'), modelNumber: g('modelNumber'),
    serialNumber: g('serialNumber'), deviceType: g('deviceType'),
    presentationUrl: g('presentationURL'), services,
  };
}

// ── Default Credentials ───────────────────────────────────────────────────────

const DEFAULT_CREDS = [
  {user:'admin',pass:'admin'}, {user:'admin',pass:''},
  {user:'admin',pass:'password'}, {user:'admin',pass:'1234'},
  {user:'admin',pass:'12345'}, {user:'root',pass:'root'},
  {user:'root',pass:''}, {user:'user',pass:'user'},
  {user:'admin',pass:'admin123'}, {user:'1234',pass:'1234'},
  {user:'admin',pass:'Pass1234'}, {user:'support',pass:'support'},
  {user:'guest',pass:'guest'}, {user:'admin',pass:'default'},
];

export async function checkDefaultCreds(ip: string, ports: number[]): Promise<DefaultCredResult> {
  const port = ports.includes(80) ? 80 : ports.includes(8080) ? 8080 : 80;
  let tested = 0;
  for (const cred of DEFAULT_CREDS) {
    tested++;
    try {
      const res = await Promise.race([
        fetch(`http://${ip}:${port}/`, {
          mode: 'cors',
          headers: { 'Authorization': `Basic ${btoa(`${cred.user}:${cred.pass}`)}` },
        }),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('t/o')), 1500)),
      ]) as Response;
      if (res.ok && res.status !== 401 && res.status !== 403) {
        return { tested, vulnerable: true, workingCred: cred, checkedAt: new Date().toLocaleTimeString() };
      }
    } catch (_) {}
  }
  return { tested, vulnerable: false, checkedAt: new Date().toLocaleTimeString() };
}

// ── Vulnerability Assessment ──────────────────────────────────────────────────

export function assessVulnerabilities(device: DeviceResult): VulnReport {
  const vulns: Vulnerability[] = [];
  const p = device.openPorts;

  if (p.includes(23)) vulns.push({ id:'V001', severity:'critical', title:'Telnet Enabled',
    description:'Port 23 (Telnet) is open. Telnet sends all data including passwords in plain text.',
    recommendation:'Disable Telnet on this device. Use SSH (port 22) instead.', port:23 });

  if (p.includes(7547)) vulns.push({ id:'V002', severity:'critical', title:'TR-069 Exposed',
    description:'Port 7547 (TR-069) is open. This ISP management protocol has known RCE vulnerabilities (Mirai botnet used this).',
    recommendation:'Block port 7547 on your router firewall immediately.', port:7547 });

  if (p.includes(5555)) vulns.push({ id:'V003', severity:'critical', title:'Android Debug Bridge Open',
    description:'Port 5555 (ADB) is open. Anyone on your network can execute commands on this Android device.',
    recommendation:'Disable USB/network debugging on this Android device.', port:5555 });

  if (p.includes(3389)) vulns.push({ id:'V004', severity:'high', title:'RDP Exposed',
    description:'Port 3389 (RDP) is open. RDP is a common target for brute-force attacks.',
    recommendation:'Enable Network Level Authentication and use a VPN instead of exposing RDP.', port:3389 });

  if (p.includes(445)) vulns.push({ id:'V005', severity:'high', title:'SMB File Share Open',
    description:'Port 445 (SMB) is open. SMB has been exploited by EternalBlue/WannaCry ransomware.',
    recommendation:'Ensure Windows is fully updated. Disable SMBv1. Use firewall rules to restrict access.', port:445 });

  if (p.includes(3306)) vulns.push({ id:'V006', severity:'high', title:'MySQL Exposed',
    description:'Port 3306 (MySQL) is publicly accessible on the network.',
    recommendation:'Bind MySQL to localhost only. Never expose databases to the network.', port:3306 });

  if (device.defaultCredResult?.vulnerable) vulns.push({ id:'V007', severity:'critical', title:'Default Password Active',
    description:`Default credentials (${device.defaultCredResult.workingCred?.user}/${device.defaultCredResult.workingCred?.pass}) are still set on this device.`,
    recommendation:'Log into this device immediately and change the password to something strong and unique.' });

  if (p.includes(21)) vulns.push({ id:'V008', severity:'medium', title:'FTP Exposed',
    description:'Port 21 (FTP) is open. FTP sends data and credentials in plain text.',
    recommendation:'Replace FTP with SFTP or FTPS. Disable plain FTP if not needed.', port:21 });

  if (p.includes(80) && !p.includes(443)) vulns.push({ id:'V009', severity:'medium', title:'HTTP Without HTTPS',
    description:'This device serves its web interface over unencrypted HTTP only.',
    recommendation:'Enable HTTPS on this device if supported, or access it only from trusted networks.', port:80 });

  if (p.includes(1900) || p.includes(49000)) vulns.push({ id:'V010', severity:'low', title:'UPnP Enabled',
    description:'UPnP is running. Some UPnP implementations allow attackers to open ports in your firewall.',
    recommendation:'Disable UPnP if not needed, especially on internet-facing routers.', port:1900 });

  if (device.fingerprint?.wwwAuthenticate === undefined && p.includes(80)) {
    vulns.push({ id:'V011', severity:'low', title:'No Authentication on Web Interface',
      description:'The web interface on port 80 does not appear to require authentication.',
      recommendation:'Enable password protection on this device\'s web interface.', port:80 });
  }

  const severityScore: Record<string, number> = { critical:25, high:15, medium:8, low:3, info:1 };
  const score = Math.min(100, vulns.reduce((acc, v) => acc + (severityScore[v.severity] ?? 0), 0));

  return { scannedAt: new Date().toLocaleString(), vulns, score };
}

// ── Full Deep Probe ───────────────────────────────────────────────────────────

export async function deepProbeDevice(
  device: DeviceResult,
  onStep: (s: string) => void,
): Promise<DeviceResult> {
  if (device.openPorts.length === 0) return device;
  const updated = { ...device };

  onStep('Fingerprinting device…');
  try {
    updated.fingerprint = await fingerprintDevice(device.ip, device.openPorts);
    if (updated.fingerprint.vendor && !updated.deviceType.includes(updated.fingerprint.vendor)) {
      updated.deviceType = `${updated.fingerprint.vendor} · ${device.deviceType}`;
    }
  } catch (_) {}

  onStep('UPnP discovery…');
  try {
    const upnp = await discoverUPnP(device.ip);
    if (upnp) {
      updated.upnpInfo = upnp;
      if (upnp.friendlyName) updated.deviceType = upnp.friendlyName;
    }
  } catch (_) {}

  onStep('Testing default credentials…');
  try {
    if (device.openPorts.some(p => [80, 8080, 8443].includes(p))) {
      updated.defaultCredResult = await checkDefaultCreds(device.ip, device.openPorts);
      if (updated.defaultCredResult.vulnerable) {
        updated.isSuspicious = true;
        updated.threatLevel = 'suspicious';
      }
    }
  } catch (_) {}

  onStep('Running vulnerability assessment…');
  updated.vulnReport = assessVulnerabilities(updated);
  if (updated.vulnReport.score > 50) updated.threatLevel = 'suspicious';
  else if (updated.vulnReport.score > 20) updated.threatLevel = 'monitor';

  onStep('Complete ✓');
  return updated;
}
