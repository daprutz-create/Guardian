// src/components/DeviceCard.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DeviceResult } from '../utils/types';
import { C, threatColor, ThreatPill } from './UI';

interface Props { device: DeviceResult; index: number; onPress?: () => void; }

export default function DeviceCard({ device, onPress }: Props) {
  const tc = threatColor(device.threatLevel);
  const hasProbe = !!(device.fingerprint || device.upnpInfo || device.defaultCredResult);
  const hasCriticalVuln = device.vulnReport?.vulns.some(v => v.severity === 'critical');

  return (
    <TouchableOpacity
      style={[s.card, { borderColor: tc + (device.threatLevel === 'safe' ? '30' : '60') }]}
      onPress={onPress} activeOpacity={0.75}>
      <View style={[s.stripe, { backgroundColor: tc }]} />
      <View style={s.row}>
        <View style={[s.iconCircle, { borderColor: tc + '50' }]}>
          <Text style={s.icon}>{device.deviceIcon}</Text>
        </View>
        <View style={s.mid}>
          <View style={s.ipRow}>
            <Text style={s.ip}>{device.ip}</Text>
            {hasCriticalVuln && <Text style={s.critTag}>● CRITICAL</Text>}
          </View>
          <Text style={s.type} numberOfLines={1}>{device.deviceType}</Text>
          <Text style={s.ports} numberOfLines={1}>
            {device.portLabels.length > 0 ? device.portLabels.join(' · ') : 'No open ports'}
          </Text>
          <View style={s.tagRow}>
            {hasProbe && <View style={s.tag}><Text style={s.tagTxt}>PROBED</Text></View>}
            {device.webUiUrl && <View style={[s.tag, s.tagBlue]}><Text style={[s.tagTxt, { color: C.blue }]}>WEB UI</Text></View>}
            {device.defaultCredResult?.vulnerable && <View style={[s.tag, s.tagRed]}><Text style={[s.tagTxt, { color: C.red }]}>DEFAULT PASS!</Text></View>}
          </View>
        </View>
        <View style={s.right}>
          <ThreatPill level={device.threatLevel} />
          <Text style={s.arrow}>›</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.panel, borderWidth: 1, borderRadius: 4, marginBottom: 8, overflow: 'hidden', position: 'relative' },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingLeft: 16, gap: 10 },
  iconCircle: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, backgroundColor: 'rgba(0,255,106,0.05)', alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 18 },
  mid: { flex: 1, gap: 2 },
  ipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ip: { fontSize: 14, fontWeight: '700', color: C.text, fontFamily: 'monospace' },
  critTag: { fontSize: 8, color: '#ff1744', letterSpacing: 1, fontWeight: '700' },
  type: { fontSize: 10, color: C.dim },
  ports: { fontSize: 9, color: C.blue, fontFamily: 'monospace' },
  tagRow: { flexDirection: 'row', gap: 4, marginTop: 3, flexWrap: 'wrap' },
  tag: { backgroundColor: 'rgba(0,255,106,0.1)', borderWidth: 1, borderColor: 'rgba(0,255,106,0.25)', borderRadius: 2, paddingHorizontal: 5, paddingVertical: 1 },
  tagBlue: { backgroundColor: 'rgba(79,195,247,0.1)', borderColor: 'rgba(79,195,247,0.3)' },
  tagRed: { backgroundColor: 'rgba(255,61,61,0.12)', borderColor: 'rgba(255,61,61,0.4)' },
  tagTxt: { fontSize: 7, letterSpacing: 1, color: C.green, fontWeight: '700' },
  right: { alignItems: 'flex-end', gap: 8 },
  arrow: { fontSize: 18, color: C.dim },
});
