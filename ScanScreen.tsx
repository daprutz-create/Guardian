// src/screens/ScanScreen.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Easing, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { probeHost, buildDevice, getSubnet } from '../utils/scanner';
import { DeviceResult } from '../utils/types';
import { C, Header, ThreatPill, ProgressBar, Btn } from '../components/UI';
import DeviceCard from '../components/DeviceCard';

const BATCH = 20;
const TIMEOUT_MS = 850;

export default function ScanScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Ready — tap SCAN');
  const [devices, setDevices] = useState<DeviceResult[]>([]);
  const [localIP, setLocalIP] = useState('—');
  const [subnet, setSubnet] = useState('—');
  const [threats, setThreats] = useState(0);
  const [continuousScan, setContinuousScan] = useState(false);
  const stopRef = useRef(false);
  const scanCount = useRef(0);
  const rotAnim = useRef(new Animated.Value(0)).current;
  const rotAnim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (scanning) {
      Animated.loop(Animated.timing(rotAnim, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })).start();
      Animated.loop(Animated.timing(rotAnim2, { toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: true })).start();
    } else {
      rotAnim.stopAnimation(); rotAnim2.stopAnimation();
    }
  }, [scanning]);

  const spin = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spin2 = rotAnim2.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  const getIP = useCallback(async (): Promise<string | null> => {
    const s = await NetInfo.fetch();
    if (s.type === 'wifi' && s.details) return (s.details as any).ipAddress ?? null;
    return null;
  }, []);

  const runScan = useCallback(async (sub: string) => {
    scanCount.current++;
    let found = 0, threatCount = 0;
    const total = 254;
    let probed = 0;

    if (scanCount.current === 1) setDevices([]);

    for (let i = 1; i <= total && !stopRef.current; i += BATCH) {
      const ips = Array.from({ length: Math.min(BATCH, total - i + 1) }, (_, j) => `${sub}.${i + j}`);
      await Promise.all(ips.map(async ip => {
        const { alive, openPorts } = await probeHost(ip, TIMEOUT_MS);
        probed++;
        setProgress(probed / total);
        setStatus(`[${scanCount.current}] Probing ${ip} — ${probed}/${total}`);
        if (alive) {
          const d = buildDevice(ip, openPorts);
          found++;
          if (d.isSuspicious) threatCount++;
          setDevices(prev => {
            const idx = prev.findIndex(x => x.ip === ip);
            if (idx >= 0) { const n = [...prev]; n[idx] = { ...prev[idx], ...d, lastSeen: Date.now() }; return n; }
            return [...prev, d];
          });
          setThreats(t => d.isSuspicious ? t + 1 : t);
        }
      }));
    }
    return { found, threats: threatCount };
  }, []);

  const startScan = useCallback(async () => {
    if (scanning) return;
    stopRef.current = false;
    setThreats(0);
    setProgress(0);
    scanCount.current = 0;

    const ip = await getIP();
    if (!ip) { Alert.alert('No WiFi', 'Please connect to a WiFi network first.'); return; }

    setLocalIP(ip);
    const sub = getSubnet(ip);
    setSubnet(sub);
    setScanning(true);

    do {
      if (scanCount.current > 0) {
        setStatus('Continuous mode — restarting scan…');
        await new Promise(r => setTimeout(r, 2000));
      }
      const { found, threats: t } = await runScan(sub);
      if (!stopRef.current) {
        setStatus(continuousScan
          ? `Pass ${scanCount.current} done — ${found} devices, ${t} threats. Rescanning…`
          : `Complete — ${found} devices found, ${t} suspicious`);
        setProgress(1);
      }
    } while (continuousScan && !stopRef.current);

    setScanning(false);
    if (stopRef.current) setStatus(`Stopped after ${scanCount.current} pass(es)`);
  }, [scanning, getIP, runScan, continuousScan]);

  const stopScan = () => { stopRef.current = true; };

  const overallThreat = threats === 0 ? 'safe' : threats <= 2 ? 'monitor' : 'suspicious' as any;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <Header
        title="GUARDIAN"
        sub="WiFi Security Scanner"
        right={
          <View style={s.threatWrap}>
            <Text style={s.threatLbl}>NETWORK</Text>
            <ThreatPill level={overallThreat} />
          </View>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={s.statsRow}>
          {[
            { lbl: 'YOUR IP', val: localIP },
            { lbl: 'SUBNET', val: subnet !== '—' ? subnet + '.x' : '—' },
            { lbl: 'DEVICES', val: String(devices.length), green: true },
            { lbl: 'THREATS', val: String(threats), red: threats > 0 },
          ].map(c => (
            <View key={c.lbl} style={[s.stat, c.red && s.statRed]}>
              <Text style={s.statLbl}>{c.lbl}</Text>
              <Text style={[s.statVal, c.green && { color: C.green }, c.red && { color: C.red }]}>{c.val}</Text>
            </View>
          ))}
        </View>

        {/* Radar */}
        <View style={s.radarWrap}>
          <View style={s.radarOuter}>
            <Animated.View style={[s.radarRing, s.radarRingOuter, { transform: [{ rotate: spin }] }]} />
            <Animated.View style={[s.radarRing, s.radarRingInner, { transform: [{ rotate: spin2 }] }]} />
            <View style={s.radarCenter}>
              <Text style={s.radarCount}>{devices.length}</Text>
              <Text style={s.radarCountLbl}>DEVICES</Text>
            </View>
            {devices.slice(0, 10).map((d, i) => {
              const angle = (i / Math.max(devices.length, 1)) * 2 * Math.PI - Math.PI / 2;
              const r = 55 + (i % 3) * 18;
              return (
                <View key={d.ip} style={[s.radarDot, {
                  left: 90 + r * Math.cos(angle) - 5,
                  top: 90 + r * Math.sin(angle) - 5,
                  backgroundColor: d.threatLevel === 'suspicious' ? C.red : d.threatLevel === 'monitor' ? C.amber : C.green,
                }]} />
              );
            })}
          </View>
        </View>

        {/* Continuous toggle */}
        <View style={s.contRow}>
          <Text style={s.contLbl}>CONTINUOUS SCAN MODE</Text>
          <TouchableOpacity
            style={[s.toggle, continuousScan && s.toggleOn]}
            onPress={() => setContinuousScan(v => !v)}>
            <Text style={[s.toggleTxt, continuousScan && { color: C.bg }]}>
              {continuousScan ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Controls */}
        <View style={s.ctrlRow}>
          {!scanning
            ? <Btn label="▶  SCAN NETWORK" onPress={startScan} variant="primary" style={{ flex: 1 }} />
            : <Btn label="■  STOP" onPress={stopScan} variant="danger" style={{ flex: 1 }} />}
        </View>

        <View style={s.progressWrap}>
          <ProgressBar value={progress} />
          <Text style={s.statusTxt}>{status}</Text>
        </View>

        {/* Devices list */}
        <View style={s.section}>
          <View style={s.secHead}>
            <Text style={s.secTitle}>■ DISCOVERED DEVICES</Text>
            <View style={s.badge}><Text style={s.badgeTxt}>{devices.length} ONLINE</Text></View>
          </View>
          {devices.length === 0
            ? <View style={s.empty}><Text style={s.emptyTxt}>[ RUN A SCAN TO DISCOVER DEVICES ]</Text><Text style={s.emptyHint}>Tap any device to probe it</Text></View>
            : [...devices].sort((a, b) => {
                const order = { suspicious: 0, monitor: 1, safe: 2 };
                return order[a.threatLevel] - order[b.threatLevel];
              }).map((d, i) => (
                <DeviceCard key={d.ip} device={d} index={i}
                  onPress={() => navigation.navigate('DeviceDetail', { device: d })} />
              ))
          }
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  threatWrap: { alignItems: 'flex-end', gap: 3 },
  threatLbl: { fontSize: 8, letterSpacing: 2, color: C.dim, textTransform: 'uppercase' },
  statsRow: { flexDirection: 'row', padding: 10, gap: 8 },
  stat: { flex: 1, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 10, alignItems: 'center' },
  statRed: { borderColor: 'rgba(255,61,61,0.35)', backgroundColor: 'rgba(255,61,61,0.04)' },
  statLbl: { fontSize: 7, letterSpacing: 1.5, color: C.dim, marginBottom: 4, textTransform: 'uppercase' },
  statVal: { fontSize: 13, fontWeight: '700', color: C.text, fontFamily: 'monospace' },
  radarWrap: { alignItems: 'center', paddingVertical: 16 },
  radarOuter: { width: 180, height: 180, position: 'relative' },
  radarRing: { position: 'absolute', borderRadius: 100, borderWidth: 1, top: '50%', left: '50%' },
  radarRingOuter: { width: 180, height: 180, borderColor: 'rgba(0,255,106,0.15)', marginLeft: -90, marginTop: -90 },
  radarRingInner: { width: 110, height: 110, borderColor: 'rgba(0,255,106,0.25)', marginLeft: -55, marginTop: -55 },
  radarCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  radarCount: { fontSize: 32, fontWeight: '900', color: C.green, fontFamily: 'monospace' },
  radarCountLbl: { fontSize: 9, letterSpacing: 3, color: C.dim },
  radarDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  contRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, marginBottom: 4 },
  contLbl: { fontSize: 10, letterSpacing: 2, color: C.dim, fontFamily: 'monospace' },
  toggle: { borderWidth: 1, borderColor: C.border, borderRadius: 3, paddingHorizontal: 14, paddingVertical: 6 },
  toggleOn: { backgroundColor: C.green, borderColor: C.green },
  toggleTxt: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: C.green },
  ctrlRow: { paddingHorizontal: 14, marginBottom: 10 },
  progressWrap: { paddingHorizontal: 14, gap: 6, marginBottom: 16 },
  statusTxt: { fontSize: 10, color: C.dim, fontFamily: 'monospace', letterSpacing: 0.5 },
  section: { paddingHorizontal: 14 },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  secTitle: { fontSize: 10, letterSpacing: 3, color: C.green, fontFamily: 'monospace' },
  badge: { backgroundColor: 'rgba(0,255,106,0.1)', borderWidth: 1, borderColor: 'rgba(0,255,106,0.3)', borderRadius: 3, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 9, letterSpacing: 2, color: C.green },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderColor: C.border, borderRadius: 4, padding: 36, alignItems: 'center', gap: 6 },
  emptyTxt: { fontSize: 10, color: C.dim, letterSpacing: 2, fontFamily: 'monospace' },
  emptyHint: { fontSize: 9, color: '#2a4030', letterSpacing: 1 },
});
