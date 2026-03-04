// src/screens/DevicesScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C, Header, ThreatPill, Btn } from '../components/UI';
import DeviceCard from '../components/DeviceCard';
import { DeviceResult } from '../utils/types';
import { getPreApproved, loadProfile } from '../utils/accessManager';

export function DevicesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<'all' | 'suspicious' | 'safe'>('all');
  const [preApproved, setPreApproved] = useState<string[]>([]);

  useEffect(() => { getPreApproved().then(setPreApproved); }, []);

  // In a real app, devices would be persisted via AsyncStorage from scan results
  // For now this screen shows instructions
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <Header title="DEVICES" sub="Your network history" />
      <View style={s.body}>
        <View style={s.infoCard}>
          <Text style={s.infoIcon}>📡</Text>
          <Text style={s.infoTitle}>Scan to Populate</Text>
          <Text style={s.infoDesc}>
            Run a scan from the Scan tab to discover devices. Tap any found device to deep probe it, send access requests, or add it to your pre-approved list.
          </Text>
        </View>
        {preApproved.length > 0 && (
          <View style={s.preApprovedBox}>
            <Text style={s.preApprovedTitle}>⚡ PRE-APPROVED DEVICES ({preApproved.length})</Text>
            {preApproved.map(ip => (
              <Text key={ip} style={s.preApprovedIP}>{ip}</Text>
            ))}
          </View>
        )}
        <View style={s.tipBox}>
          <Text style={s.tipTitle}>💡 TIPS</Text>
          <Text style={s.tip}>• Tap a device on the Scan screen to open its detail view</Text>
          <Text style={s.tip}>• Use DEEP PROBE to identify vendor, services, and vulnerabilities</Text>
          <Text style={s.tip}>• REQUEST ACCESS to send a consent-based access request</Text>
          <Text style={s.tip}>• PRE-APPROVE your own devices for quick access</Text>
          <Text style={s.tip}>• Enable Continuous Scan to monitor your network non-stop</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  body: { flex: 1, padding: 16, gap: 14 },
  infoCard: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 20, alignItems: 'center', gap: 10 },
  infoIcon: { fontSize: 40 },
  infoTitle: { fontSize: 16, fontWeight: '700', color: C.green, fontFamily: 'monospace', letterSpacing: 2 },
  infoDesc: { fontSize: 12, color: C.dim, textAlign: 'center', lineHeight: 18 },
  preApprovedBox: { backgroundColor: 'rgba(255,179,0,0.06)', borderWidth: 1, borderColor: 'rgba(255,179,0,0.3)', borderRadius: 4, padding: 14 },
  preApprovedTitle: { fontSize: 10, letterSpacing: 2, color: C.amber, marginBottom: 10, fontFamily: 'monospace' },
  preApprovedIP: { fontSize: 13, color: C.text, fontFamily: 'monospace', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.border },
  tipBox: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 14, gap: 8 },
  tipTitle: { fontSize: 10, letterSpacing: 2, color: C.green, marginBottom: 4 },
  tip: { fontSize: 11, color: C.dim, lineHeight: 18 },
});

// ── Security Screen ───────────────────────────────────────────────────────────

const TIPS = [
  { icon:'🔐', sev:'critical', title:'Change Default Router Password', desc:'Most routers ship with admin/admin. Change it in your router settings (usually 192.168.1.1).'},
  { icon:'📶', sev:'high', title:'Use WPA3 or WPA2 Encryption', desc:'WEP is crackable in minutes. Check your WiFi settings and upgrade if needed.'},
  { icon:'🔄', sev:'high', title:'Update Router Firmware', desc:'Unpatched routers are a top attack vector. Check for firmware updates regularly.'},
  { icon:'🚫', sev:'high', title:'Disable Telnet (Port 23)', desc:'Telnet sends all data in plain text. Disable it on any device that has it open.'},
  { icon:'📵', sev:'medium', title:'Disable WPS', desc:'WiFi Protected Setup has known PIN brute-force vulnerabilities.'},
  { icon:'👶', sev:'medium', title:'Use Guest Network for Kids', desc:'Isolate children\'s devices on a separate guest network away from sensitive devices.'},
  { icon:'🌐', sev:'medium', title:'Use Cloudflare Family DNS', desc:'Set router DNS to 1.1.1.3 to block malware and adult content network-wide.'},
  { icon:'🔍', sev:'low', title:'Scan Weekly', desc:'Run GUARDIAN weekly to spot new unknown devices that may have joined your network.'},
  { icon:'📱', sev:'low', title:'Disable ADB on Android', desc:'Android Debug Bridge (port 5555) gives full device access. Disable it when not needed.'},
  { icon:'🛡️', sev:'low', title:'Enable Firewall on All PCs', desc:'Ensure Windows Firewall or equivalent is active on all computers.'},
];

const SEV_COLOR: Record<string, string> = { critical: '#ff1744', high: C.red, medium: C.amber, low: C.blue };

export function SecurityScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[ss.container, { paddingTop: insets.top }]}>
      <Header title="SECURITY" sub="Home network hardening guide" />
      <FlatList
        data={TIPS}
        keyExtractor={i => i.title}
        contentContainerStyle={{ padding: 14 }}
        renderItem={({ item }) => (
          <View style={[ss.tip, { borderLeftColor: SEV_COLOR[item.sev] }]}>
            <View style={ss.tipTop}>
              <Text style={ss.tipIcon}>{item.icon}</Text>
              <Text style={ss.tipTitle}>{item.title}</Text>
              <View style={[ss.sevPill, { borderColor: SEV_COLOR[item.sev] + '60', backgroundColor: SEV_COLOR[item.sev] + '18' }]}>
                <Text style={[ss.sevTxt, { color: SEV_COLOR[item.sev] }]}>{item.sev.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={ss.tipDesc}>{item.desc}</Text>
          </View>
        )}
        ListFooterComponent={<View style={{ height: 20 }} />}
      />
    </View>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  tip: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderLeftWidth: 3, borderRadius: 4, padding: 14, marginBottom: 8 },
  tipTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' },
  tipIcon: { fontSize: 20 },
  tipTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: C.text },
  sevPill: { borderWidth: 1, borderRadius: 2, paddingHorizontal: 6, paddingVertical: 2 },
  sevTxt: { fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  tipDesc: { fontSize: 11, color: C.dim, lineHeight: 17, marginLeft: 30 },
});

// ── Settings Screen ───────────────────────────────────────────────────────────

export function SettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState({
    displayName: 'Network Admin',
    message: 'Requesting access for network management.',
    reason: 'Home network security audit',
  });

  useEffect(() => {
    loadProfile().then(p => setProfile(p as any));
  }, []);

  const clear = async () => {
    await AsyncStorage.clear();
    setProfile({ displayName: 'Network Admin', message: 'Requesting access for network management.', reason: 'Home network security audit' });
  };

  return (
    <View style={[cs.container, { paddingTop: insets.top }]}>
      <Header title="SETTINGS" sub="App configuration" />
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <View style={{ padding: 14, gap: 14 }}>
            <View style={cs.section}>
              <Text style={cs.secTitle}>DEFAULT IDENTITY</Text>
              <View style={cs.row}><Text style={cs.lbl}>Display Name</Text><Text style={cs.val}>{profile.displayName}</Text></View>
              <View style={cs.row}><Text style={cs.lbl}>Default Message</Text><Text style={cs.val} numberOfLines={2}>{profile.message}</Text></View>
              <View style={cs.row}><Text style={cs.lbl}>Default Reason</Text><Text style={cs.val}>{profile.reason}</Text></View>
              <Text style={cs.hint}>Edit these from the Request Designer screen when sending a request.</Text>
            </View>

            <View style={cs.section}>
              <Text style={cs.secTitle}>GUARDIAN AGENT</Text>
              <Text style={cs.agentDesc}>
                Install the Guardian Agent on your own devices to enable full remote control (shutdown/restart/sleep), instant access approval, and real-time alerts when new devices join your network.
              </Text>
              <Text style={cs.agentStep}>1. Enable SSH on your PC/Mac/Linux</Text>
              <Text style={cs.agentStep}>2. Enable ADB on Android (Developer Options)</Text>
              <Text style={cs.agentStep}>3. Enable Remote Desktop on Windows PCs</Text>
              <Text style={cs.agentStep}>4. Enable Wake-on-LAN in your PC BIOS</Text>
              <Text style={cs.agentStep}>5. Open your router admin page to manage port access</Text>
            </View>

            <View style={cs.section}>
              <Text style={cs.secTitle}>APP INFO</Text>
              <View style={cs.row}><Text style={cs.lbl}>Version</Text><Text style={cs.val}>3.0.0</Text></View>
              <View style={cs.row}><Text style={cs.lbl}>Build</Text><Text style={cs.val}>Guardian v3</Text></View>
              <View style={cs.row}><Text style={cs.lbl}>Legal</Text><Text style={cs.val}>For use on networks you own</Text></View>
            </View>

            <TouchableOpacity style={cs.clearBtn} onPress={() => clear()}>
              <Text style={cs.clearTxt}>🗑  CLEAR ALL SAVED DATA</Text>
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </View>
        }
      />
    </View>
  );
}

const cs = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  section: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 14 },
  secTitle: { fontSize: 9, letterSpacing: 3, color: C.green, textTransform: 'uppercase', marginBottom: 12, fontFamily: 'monospace' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#111d14' },
  lbl: { fontSize: 12, color: C.dim, flex: 1 },
  val: { fontSize: 12, color: C.text, fontFamily: 'monospace', flex: 2, textAlign: 'right' },
  hint: { fontSize: 10, color: C.dim, marginTop: 8, lineHeight: 15 },
  agentDesc: { fontSize: 11, color: C.dim, lineHeight: 18, marginBottom: 10 },
  agentStep: { fontSize: 12, color: C.text, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.border },
  clearBtn: { backgroundColor: 'rgba(255,61,61,0.08)', borderWidth: 1, borderColor: 'rgba(255,61,61,0.3)', borderRadius: 4, padding: 14, alignItems: 'center' },
  clearTxt: { fontSize: 12, color: C.red, letterSpacing: 2, fontFamily: 'monospace' },
});
