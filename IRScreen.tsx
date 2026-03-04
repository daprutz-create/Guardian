// src/screens/IRScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, Platform, Alert, Vibration, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import IRManager from 'react-native-ir-manager';
import { BUILTIN_DEVICES, getAllDevices, IRDevice, IRCommand } from '../utils/ir';
import { C, Card, SectionTitle } from '../components/UI';

export default function IRScreen() {
  const insets = useSafeAreaInsets();
  const [irSupported, setIrSupported] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<IRDevice[]>(BUILTIN_DEVICES);
  const [selectedDevice, setSelectedDevice] = useState<IRDevice | null>(null);
  const [lastCmd, setLastCmd] = useState<string>('');
  const [sending, setSending] = useState(false);
  const flashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    IRManager.isAvailable()
      .then(avail => setIrSupported(avail))
      .catch(() => setIrSupported(false));
    getAllDevices().then(setDevices);
  }, []);

  const sendCommand = useCallback(async (cmd: IRCommand) => {
    setSending(true);
    setLastCmd(cmd.label);
    Vibration.vibrate(40);

    // Flash animation
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    try {
      if (irSupported) {
        await IRManager.transmit(cmd.frequency, cmd.pattern);
      } else {
        // Demo mode: just show what would be sent
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (err: any) {
      Alert.alert('IR Error', err?.message ?? 'Failed to transmit');
    } finally {
      setSending(false);
    }
  }, [irSupported, flashAnim]);

  const flashColor = flashAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,255,106,0)', 'rgba(0,255,106,0.25)'] });

  // ── Device List ────────────────────────────────────────────────────────────
  if (!selectedDevice) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <Text style={s.title}>IR REMOTE</Text>
          {irSupported === false && <Text style={s.noIR}>No IR blaster</Text>}
          {irSupported === true && <Text style={s.hasIR}>✓ IR Ready</Text>}
        </View>

        {irSupported === false && (
          <View style={s.demoBanner}>
            <Text style={s.demoTxt}>⚠️ This device has no IR blaster — running in demo mode. Commands will be simulated.</Text>
          </View>
        )}

        <ScrollView contentContainerStyle={{ padding: 14 }}>
          <Text style={s.sectionHdr}>SELECT DEVICE TO CONTROL</Text>
          <View style={s.deviceGrid}>
            {devices.map(d => (
              <TouchableOpacity key={d.id} style={s.deviceCard} onPress={() => setSelectedDevice(d)}>
                <Text style={s.deviceIcon}>{d.icon}</Text>
                <Text style={s.deviceName}>{d.name}</Text>
                <Text style={s.deviceBrand}>{d.brand}</Text>
                <Text style={s.deviceCmds}>{d.commands.length} buttons</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Card style={s.infoCard}>
            <Text style={s.infoTitle}>📡 ABOUT IR REMOTE</Text>
            <Text style={s.infoText}>Requires a phone with an IR blaster (common on Xiaomi, Huawei, Samsung Galaxy S series older models, LG).</Text>
            <Text style={s.infoText}>Point the TOP of your phone at the device when sending commands.</Text>
            <Text style={s.infoNote}>Samsung TV, LG TV, Sony TV, and Generic AC codes are pre-loaded. More device profiles coming soon.</Text>
          </Card>
        </ScrollView>
      </View>
    );
  }

  // ── Remote Control UI ──────────────────────────────────────────────────────
  const isTV = selectedDevice.type === 'tv';
  const isAC = selectedDevice.type === 'ac';

  const getCmd = (id: string) => selectedDevice.commands.find(c => c.id === id);
  const navCmds = ['up', 'down', 'left', 'right', 'ok'];
  const navSet = selectedDevice.commands.filter(c => navCmds.includes(c.id));
  const mainCmds = selectedDevice.commands.filter(c => !navCmds.includes(c.id));

  return (
    <Animated.View style={[s.container, { paddingTop: insets.top, backgroundColor: flashColor as any }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => setSelectedDevice(null)}>
          <Text style={s.back}>← DEVICES</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.deviceIcon2}>{selectedDevice.icon}</Text>
          <Text style={s.headerDeviceName}>{selectedDevice.name}</Text>
        </View>
        <Text style={s.lastCmdTxt}>{lastCmd || '—'}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14, gap: 14 }}>

        {/* Main command grid */}
        <SectionTitle>■ CONTROLS</SectionTitle>
        <View style={s.cmdGrid}>
          {mainCmds.map(cmd => (
            <RemoteBtn key={cmd.id} cmd={cmd} onPress={() => sendCommand(cmd)} disabled={sending} />
          ))}
        </View>

        {/* D-Pad */}
        {navSet.length >= 4 && (
          <>
            <SectionTitle>■ NAVIGATION</SectionTitle>
            <View style={s.dpad}>
              <View style={s.dpadRow}>
                <View style={s.dpadEmpty} />
                {getCmd('up') && <RemoteBtn cmd={getCmd('up')!} onPress={() => sendCommand(getCmd('up')!)} disabled={sending} large />}
                <View style={s.dpadEmpty} />
              </View>
              <View style={s.dpadRow}>
                {getCmd('left') && <RemoteBtn cmd={getCmd('left')!} onPress={() => sendCommand(getCmd('left')!)} disabled={sending} large />}
                {getCmd('ok') && <RemoteBtn cmd={getCmd('ok')!} onPress={() => sendCommand(getCmd('ok')!)} disabled={sending} center />}
                {getCmd('right') && <RemoteBtn cmd={getCmd('right')!} onPress={() => sendCommand(getCmd('right')!)} disabled={sending} large />}
              </View>
              <View style={s.dpadRow}>
                <View style={s.dpadEmpty} />
                {getCmd('down') && <RemoteBtn cmd={getCmd('down')!} onPress={() => sendCommand(getCmd('down')!)} disabled={sending} large />}
                <View style={s.dpadEmpty} />
              </View>
            </View>
          </>
        )}

        <Card>
          <Text style={s.protocolTxt}>Protocol: NEC/SIRC · Frequency: {selectedDevice.commands[0]?.frequency ?? 38000}Hz · {selectedDevice.commands.length} commands</Text>
          <Text style={s.pointTxt}>👆 Point top of phone at device</Text>
        </Card>

        <View style={{ height: 20 }} />
      </ScrollView>
    </Animated.View>
  );
}

function RemoteBtn({ cmd, onPress, disabled, large, center }: {
  cmd: IRCommand; onPress: () => void; disabled?: boolean; large?: boolean; center?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.88, duration: 60, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  const isPower = cmd.id === 'power';
  const bc = isPower ? 'rgba(255,61,61,0.4)' : cmd.color ? cmd.color + '40' : C.border;
  const bg = isPower ? 'rgba(255,61,61,0.12)' : cmd.color ? cmd.color + '12' : C.panel;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[rb.btn, { borderColor: bc, backgroundColor: bg },
          large && rb.large, center && rb.center,
          disabled && { opacity: 0.5 }]}
        onPress={press} disabled={disabled} activeOpacity={0.7}>
        <Text style={rb.icon}>{cmd.icon}</Text>
        <Text style={[rb.label, isPower && { color: C.red }]}>{cmd.label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const rb = StyleSheet.create({
  btn: { borderWidth: 1, borderRadius: 6, padding: 12, alignItems: 'center', minWidth: 72, gap: 3 },
  large: { minWidth: 64, padding: 14 },
  center: { minWidth: 64, padding: 14, backgroundColor: 'rgba(0,255,106,0.1)', borderColor: 'rgba(0,255,106,0.4)' },
  icon: { fontSize: 20 },
  label: { fontSize: 9, color: C.dim, letterSpacing: 1, textAlign: 'center' },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.panel },
  title: { fontSize: 18, fontWeight: '900', letterSpacing: 3, color: C.green, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New' },
  back: { fontSize: 11, letterSpacing: 1, color: C.green, fontFamily: 'monospace' },
  noIR: { fontSize: 10, color: C.amber, letterSpacing: 1 },
  hasIR: { fontSize: 10, color: C.green, letterSpacing: 1 },
  demoBanner: { backgroundColor: 'rgba(255,179,0,0.08)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,179,0,0.3)', padding: 10 },
  demoTxt: { fontSize: 11, color: C.amber, lineHeight: 16 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deviceIcon2: { fontSize: 22 },
  headerDeviceName: { fontSize: 14, fontWeight: '700', color: C.text, fontFamily: 'monospace' },
  lastCmdTxt: { fontSize: 10, color: C.green, fontFamily: 'monospace', minWidth: 50, textAlign: 'right' },
  sectionHdr: { fontSize: 10, letterSpacing: 3, color: C.green, fontFamily: 'monospace', marginBottom: 12, textTransform: 'uppercase' },
  deviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  deviceCard: { flex: 1, minWidth: '45%', backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 14, alignItems: 'center', gap: 4 },
  deviceIcon: { fontSize: 28 },
  deviceName: { fontSize: 12, fontWeight: '700', color: C.text, textAlign: 'center' },
  deviceBrand: { fontSize: 10, color: C.dim },
  deviceCmds: { fontSize: 9, color: C.green, letterSpacing: 1 },
  cmdGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dpad: { alignItems: 'center', gap: 6 },
  dpadRow: { flexDirection: 'row', gap: 6 },
  dpadEmpty: { width: 64, height: 64 },
  infoCard: { gap: 6 },
  infoTitle: { fontSize: 10, letterSpacing: 2, color: C.green, marginBottom: 4 },
  infoText: { fontSize: 11, color: C.dim, lineHeight: 17 },
  infoNote: { fontSize: 10, color: C.amber, marginTop: 4, lineHeight: 16 },
  protocolTxt: { fontSize: 10, color: C.dim, fontFamily: 'monospace', marginBottom: 4 },
  pointTxt: { fontSize: 11, color: C.amber },
});
