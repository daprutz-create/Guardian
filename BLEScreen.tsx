// src/screens/BLEScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, Alert, Platform, Animated, Easing, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BleManager } from 'react-native-ble-plx';
import BLEAdvertiser from 'react-native-ble-advertiser';
import {
  BLEDevice, classifyDevice, parseManufacturer,
  rssiToDistance, rssiBar, rssiColor, lookupService,
  ADVERTISE_PROFILES, AdvertiseProfile,
} from '../utils/ble';
import { C, Card, SectionTitle } from '../components/UI';

const bleManager = new BleManager();

type Tab = 'scan' | 'advertise';

export default function BLEScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('scan');

  // Scanner state
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<Map<string, BLEDevice>>(new Map());
  const [filter, setFilter] = useState('');
  const scanAnim = useRef(new Animated.Value(0)).current;

  // Advertiser state
  const [advertising, setAdvertising] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<AdvertiseProfile>(ADVERTISE_PROFILES[0]);
  const [customName, setCustomName] = useState('Guardian');
  const [customUUID, setCustomUUID] = useState('0000180A-0000-1000-8000-00805F9B34FB');

  useEffect(() => {
    return () => {
      bleManager.stopDeviceScan();
      if (advertising) BLEAdvertiser.stopBroadcast().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (scanning) {
      Animated.loop(Animated.timing(scanAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true })).start();
    } else {
      scanAnim.stopAnimation();
    }
  }, [scanning]);

  const startScan = useCallback(() => {
    setScanning(true);
    bleManager.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
      if (error) {
        setScanning(false);
        if (error.message?.includes('Permission')) {
          Alert.alert('Permission Required', 'Please grant Bluetooth and Location permissions.');
        }
        return;
      }
      if (!device) return;

      const classification = classifyDevice({
        name: device.name ?? undefined,
        localName: device.localName ?? undefined,
        serviceUUIDs: device.serviceUUIDs ?? undefined,
        manufacturerData: device.manufacturerData ?? undefined,
      });

      const mfr = parseManufacturer(device.manufacturerData ?? undefined);

      const ble: BLEDevice = {
        id: device.id,
        name: device.name ?? undefined,
        localName: device.localName ?? undefined,
        rssi: device.rssi ?? -100,
        txPower: device.txPowerLevel ?? undefined,
        serviceUUIDs: device.serviceUUIDs ?? undefined,
        manufacturerData: device.manufacturerData ?? undefined,
        isConnectable: device.isConnectable ?? undefined,
        lastSeen: Date.now(),
        ...classification,
      };

      setDevices(prev => {
        const next = new Map(prev);
        next.set(device.id, ble);
        return next;
      });
    });

    // Auto-stop after 30s
    setTimeout(() => {
      bleManager.stopDeviceScan();
      setScanning(false);
    }, 30000);
  }, []);

  const stopScan = useCallback(() => {
    bleManager.stopDeviceScan();
    setScanning(false);
  }, []);

  const startAdvertise = useCallback(async () => {
    try {
      const name = customName.trim() || selectedProfile.deviceName;
      const uuid = customUUID.trim() || selectedProfile.serviceUUID;
      BLEAdvertiser.setCompanyId(0x0000);
      await BLEAdvertiser.broadcast(uuid, [{ key: 'LocalName', value: name }], {
        advertiseMode: 2,
        txPowerLevel: 3,
        connectable: false,
        includeDeviceName: true,
        includeTxPowerLevel: false,
      });
      setAdvertising(true);
    } catch (err: any) {
      Alert.alert('Advertise Error', err?.message ?? 'Could not start advertising. Check Bluetooth permissions.');
    }
  }, [customName, customUUID, selectedProfile]);

  const stopAdvertise = useCallback(async () => {
    try {
      await BLEAdvertiser.stopBroadcast();
    } catch (_) {}
    setAdvertising(false);
  }, []);

  const spin = scanAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const devList = Array.from(devices.values())
    .filter(d => !filter || (d.name ?? d.localName ?? d.id).toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => b.rssi - a.rssi);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.title}>BLUETOOTH</Text>
        <View style={s.tabs}>
          <TouchableOpacity style={[s.tab, tab === 'scan' && s.tabActive]} onPress={() => setTab('scan')}>
            <Text style={[s.tabTxt, tab === 'scan' && { color: C.green }]}>SCAN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, tab === 'advertise' && s.tabActive]} onPress={() => setTab('advertise')}>
            <Text style={[s.tabTxt, tab === 'advertise' && { color: C.green }]}>BROADCAST</Text>
          </TouchableOpacity>
        </View>
      </View>

      {tab === 'scan' && (
        <View style={{ flex: 1 }}>
          {/* Controls */}
          <View style={s.scanCtrl}>
            <TextInput style={s.filterInput} value={filter} onChangeText={setFilter} placeholder="Filter devices…" placeholderTextColor={C.dim} />
            <TouchableOpacity style={[s.scanBtn, scanning && s.scanBtnStop]} onPress={scanning ? stopScan : startScan}>
              {scanning
                ? <Animated.Text style={[s.scanBtnTxt, { transform: [{ rotate: spin }] }]}>◉</Animated.Text>
                : <Text style={s.scanBtnTxt}>▶</Text>}
            </TouchableOpacity>
          </View>

          <View style={s.statBar}>
            <Text style={s.statTxt}>{devList.length} devices</Text>
            {scanning && <Text style={s.scanningTxt}>● SCANNING</Text>}
          </View>

          <FlatList
            data={devList}
            keyExtractor={d => d.id}
            contentContainerStyle={{ padding: 12 }}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyTxt}>{scanning ? 'Scanning for BLE devices…' : 'Tap ▶ to scan for Bluetooth devices'}</Text>
              </View>
            }
            renderItem={({ item: d }) => <BLEDeviceCard device={d} />}
          />
        </View>
      )}

      {tab === 'advertise' && (
        <ScrollView contentContainerStyle={{ padding: 14 }}>
          {/* Status */}
          {advertising && (
            <View style={s.advertiseActive}>
              <Text style={s.advertiseActiveTxt}>📡 BROADCASTING AS "{customName}"</Text>
              <Text style={s.advertiseActiveUUID}>{customUUID.slice(0, 18)}…</Text>
            </View>
          )}

          <SectionTitle>■ DEVICE NAME</SectionTitle>
          <TextInput style={s.input} value={customName} onChangeText={setCustomName} placeholder="Device name to broadcast" placeholderTextColor={C.dim} maxLength={30} />

          <SectionTitle>■ SERVICE UUID</SectionTitle>
          <TextInput style={s.input} value={customUUID} onChangeText={setCustomUUID} placeholder="Service UUID" placeholderTextColor={C.dim} />

          <SectionTitle>■ QUICK PROFILES</SectionTitle>
          <View style={s.profileGrid}>
            {ADVERTISE_PROFILES.map(p => (
              <TouchableOpacity key={p.id}
                style={[s.profileCard, selectedProfile.id === p.id && s.profileCardActive]}
                onPress={() => { setSelectedProfile(p); setCustomName(p.deviceName); setCustomUUID(p.serviceUUID); }}>
                <Text style={s.profileIcon}>{p.icon}</Text>
                <Text style={[s.profileName, selectedProfile.id === p.id && { color: C.green }]}>{p.name}</Text>
                <Text style={s.profileDesc}>{p.description}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[s.advertiseBtn, advertising && s.advertiseBtnStop]}
            onPress={advertising ? stopAdvertise : startAdvertise}>
            <Text style={[s.advertiseBtnTxt, advertising && { color: C.red }]}>
              {advertising ? '■  STOP BROADCASTING' : '▶  START BROADCASTING'}
            </Text>
          </TouchableOpacity>

          <Card style={{ marginTop: 14 }}>
            <Text style={s.infoTitle}>📡 ABOUT BLE BROADCASTING</Text>
            <Text style={s.infoTxt}>Your phone will appear as the selected device type to any BLE scanner in range. Useful for security demos, testing BLE apps, and showing clients what devices advertise on your network.</Text>
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

function BLEDeviceCard({ device: d }: { device: BLEDevice }) {
  const [expanded, setExpanded] = useState(false);
  const bars = rssiBar(d.rssi);
  const rc = rssiColor(d.rssi);
  const name = d.name ?? d.localName ?? `Unknown (${d.id.slice(0, 8)})`;
  const mfr = parseManufacturer(d.manufacturerData ?? undefined);

  return (
    <TouchableOpacity style={[bs.card, d.threat === 'suspicious' && bs.danger, d.threat === 'monitor' && bs.warn]} onPress={() => setExpanded(e => !e)}>
      <View style={bs.row}>
        <Text style={bs.icon}>{d.categoryIcon}</Text>
        <View style={bs.info}>
          <Text style={bs.name} numberOfLines={1}>{name}</Text>
          <Text style={bs.meta}>{d.category} {mfr ? `· ${mfr}` : ''}</Text>
          {d.serviceUUIDs && d.serviceUUIDs.length > 0 && (
            <Text style={bs.service} numberOfLines={1}>{d.serviceUUIDs.slice(0, 2).map(lookupService).join(' · ')}</Text>
          )}
        </View>
        <View style={bs.signal}>
          <Text style={[bs.rssi, { color: rc }]}>{d.rssi} dBm</Text>
          <View style={bs.bars}>
            {[1, 2, 3, 4].map(i => (
              <View key={i} style={[bs.bar, { height: i * 5, backgroundColor: i <= bars ? rc : C.border }]} />
            ))}
          </View>
          <Text style={bs.dist}>{rssiToDistance(d.rssi, d.txPower)}</Text>
        </View>
      </View>
      {expanded && (
        <View style={bs.detail}>
          <DetailRow label="ID" value={d.id} />
          <DetailRow label="Connectable" value={d.isConnectable ? 'Yes' : 'No'} />
          {d.txPower !== undefined && <DetailRow label="TX Power" value={`${d.txPower} dBm`} />}
          {mfr && <DetailRow label="Manufacturer" value={mfr} />}
          {d.serviceUUIDs?.map((uuid, i) => (
            <DetailRow key={i} label={i === 0 ? 'Services' : ''} value={lookupService(uuid)} />
          ))}
          <Text style={bs.updated}>Last seen: {new Date(d.lastSeen).toLocaleTimeString()}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={drS.row}>
      <Text style={drS.lbl}>{label}</Text>
      <Text style={drS.val} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const drS = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: '#111d14' },
  lbl: { fontSize: 10, color: C.dim, width: 80 },
  val: { fontSize: 10, color: C.text, fontFamily: 'monospace', flex: 1 },
});

const bs = StyleSheet.create({
  card: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 12, marginBottom: 8 },
  danger: { borderColor: 'rgba(255,61,61,0.4)' },
  warn: { borderColor: 'rgba(255,179,0,0.3)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { fontSize: 22 },
  info: { flex: 1 },
  name: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 2 },
  meta: { fontSize: 10, color: C.dim },
  service: { fontSize: 9, color: C.blue, fontFamily: 'monospace', marginTop: 1 },
  signal: { alignItems: 'flex-end', gap: 3 },
  rssi: { fontSize: 11, fontFamily: 'monospace', fontWeight: '700' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: { width: 4, borderRadius: 1 },
  dist: { fontSize: 8, color: C.dim },
  detail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  updated: { fontSize: 9, color: C.dim, marginTop: 6, fontFamily: 'monospace' },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.panel },
  title: { fontSize: 18, fontWeight: '900', letterSpacing: 3, color: C.green, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New' },
  tabs: { flexDirection: 'row', backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 4, overflow: 'hidden' },
  tab: { paddingHorizontal: 14, paddingVertical: 7 },
  tabActive: { backgroundColor: 'rgba(0,255,106,0.1)' },
  tabTxt: { fontSize: 10, color: C.dim, fontFamily: 'monospace', letterSpacing: 1 },
  scanCtrl: { flexDirection: 'row', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  filterInput: { flex: 1, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 8, color: C.text, fontFamily: 'monospace', fontSize: 12 },
  scanBtn: { backgroundColor: C.green, borderRadius: 4, width: 44, alignItems: 'center', justifyContent: 'center' },
  scanBtnStop: { backgroundColor: 'rgba(255,61,61,0.15)', borderWidth: 1, borderColor: C.red },
  scanBtnTxt: { fontSize: 18, color: C.bg, fontWeight: '700' },
  statBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 6, backgroundColor: C.panel, borderBottomWidth: 1, borderBottomColor: C.border },
  statTxt: { fontSize: 10, color: C.dim, fontFamily: 'monospace' },
  scanningTxt: { fontSize: 10, color: C.green, fontFamily: 'monospace', letterSpacing: 1 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyTxt: { fontSize: 12, color: C.dim },
  advertiseActive: { backgroundColor: 'rgba(0,255,106,0.1)', borderWidth: 1, borderColor: 'rgba(0,255,106,0.4)', borderRadius: 4, padding: 14, marginBottom: 14, alignItems: 'center', gap: 4 },
  advertiseActiveTxt: { fontSize: 13, fontWeight: '700', color: C.green, letterSpacing: 1 },
  advertiseActiveUUID: { fontSize: 9, color: C.dim, fontFamily: 'monospace' },
  input: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 12, color: C.text, fontFamily: 'monospace', fontSize: 13, marginBottom: 14 },
  profileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  profileCard: { flex: 1, minWidth: '45%', backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 12, alignItems: 'center', gap: 4 },
  profileCardActive: { borderColor: C.green, backgroundColor: 'rgba(0,255,106,0.08)' },
  profileIcon: { fontSize: 24 },
  profileName: { fontSize: 11, fontWeight: '700', color: C.dim, letterSpacing: 1 },
  profileDesc: { fontSize: 9, color: C.dim, textAlign: 'center', lineHeight: 13 },
  advertiseBtn: { backgroundColor: C.green, borderRadius: 4, padding: 16, alignItems: 'center' },
  advertiseBtnStop: { backgroundColor: 'rgba(255,61,61,0.1)', borderWidth: 1, borderColor: C.red },
  advertiseBtnTxt: { fontSize: 14, fontWeight: '900', letterSpacing: 3, color: C.bg, fontFamily: 'monospace' },
  infoTitle: { fontSize: 10, letterSpacing: 2, color: C.green, marginBottom: 6 },
  infoTxt: { fontSize: 11, color: C.dim, lineHeight: 18 },
});
