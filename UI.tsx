// src/components/UI.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { ThreatLevel } from '../utils/types';

export const C = {
  bg: '#080c0a', panel: '#0c1210', border: '#1a2e20',
  green: '#00ff6a', green2: '#00c44f', amber: '#ffb300',
  red: '#ff3d3d', blue: '#4fc3f7', text: '#b8d4be', dim: '#3a5e42',
  mono: Platform.OS === 'android' ? 'monospace' : 'Courier New',
};

export const threatColor = (level: ThreatLevel | undefined): string => {
  if (level === 'suspicious') return C.red;
  if (level === 'monitor') return C.amber;
  return C.green;
};

export const severityColor = (s: string): string => {
  if (s === 'critical') return '#ff1744';
  if (s === 'high') return '#ff3d3d';
  if (s === 'medium') return C.amber;
  if (s === 'low') return C.blue;
  return C.dim;
};

interface BtnProps {
  label: string; onPress: () => void;
  variant?: 'primary' | 'danger' | 'outline' | 'ghost';
  loading?: boolean; disabled?: boolean;
  icon?: string; style?: object;
}

export function Btn({ label, onPress, variant = 'outline', loading, disabled, icon, style }: BtnProps) {
  const bg = variant === 'primary' ? C.green : variant === 'danger' ? 'rgba(255,61,61,0.12)' : 'transparent';
  const border = variant === 'primary' ? C.green : variant === 'danger' ? C.red : C.border;
  const color = variant === 'primary' ? C.bg : variant === 'danger' ? C.red : C.green;
  return (
    <TouchableOpacity
      onPress={onPress} disabled={disabled || loading}
      style={[btnS.btn, { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.4 : 1 }, style]}>
      {loading
        ? <ActivityIndicator size="small" color={color} />
        : <Text style={[btnS.txt, { color }]}>{icon ? `${icon}  ` : ''}{label}</Text>}
    </TouchableOpacity>
  );
}

const btnS = StyleSheet.create({
  btn: { borderWidth: 1, borderRadius: 4, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  txt: { fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
});

export function Header({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <View style={hdrS.wrap}>
      <View>
        <Text style={hdrS.title}>{title}</Text>
        {sub && <Text style={hdrS.sub}>{sub}</Text>}
      </View>
      {right}
    </View>
  );
}

const hdrS = StyleSheet.create({
  wrap: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.panel },
  title: { fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New', fontSize: 22, fontWeight: '900', letterSpacing: 4, color: C.green },
  sub: { fontSize: 9, letterSpacing: 3, color: C.dim, marginTop: 2, textTransform: 'uppercase' },
});

export function Card({ children, style, danger, warn }: { children: React.ReactNode; style?: object; danger?: boolean; warn?: boolean }) {
  return (
    <View style={[cardS.card, danger && cardS.danger, warn && cardS.warn, style]}>
      {children}
    </View>
  );
}

const cardS = StyleSheet.create({
  card: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 14, marginBottom: 10 },
  danger: { borderColor: 'rgba(255,61,61,0.4)', backgroundColor: 'rgba(255,61,61,0.04)' },
  warn: { borderColor: 'rgba(255,179,0,0.3)', backgroundColor: 'rgba(255,179,0,0.03)' },
});

export function SectionTitle({ children }: { children: string }) {
  return <Text style={secS.title}>{children}</Text>;
}

const secS = StyleSheet.create({
  title: { fontSize: 10, letterSpacing: 3, color: C.green, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New', marginBottom: 8, textTransform: 'uppercase' },
});

export function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={irS.row}>
      <Text style={irS.label}>{label}</Text>
      <Text style={[irS.value, highlight && { color: C.amber }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const irS = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#111d14' },
  label: { fontSize: 11, color: C.dim, flex: 1 },
  value: { fontSize: 11, color: C.text, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New', flex: 2, textAlign: 'right' },
});

export function ThreatPill({ level }: { level: ThreatLevel }) {
  const c = threatColor(level);
  return (
    <View style={[tpS.pill, { borderColor: c + '60', backgroundColor: c + '18' }]}>
      <Text style={[tpS.txt, { color: c }]}>
        {level === 'suspicious' ? '⚠ THREAT' : level === 'monitor' ? 'MONITOR' : '✓ SAFE'}
      </Text>
    </View>
  );
}

const tpS = StyleSheet.create({
  pill: { borderWidth: 1, borderRadius: 3, paddingHorizontal: 8, paddingVertical: 3 },
  txt: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
});

export function ProgressBar({ value, color = C.green }: { value: number; color?: string }) {
  return (
    <View style={pbS.track}>
      <View style={[pbS.fill, { width: `${Math.min(100, Math.round(value * 100))}%`, backgroundColor: color }]} />
    </View>
  );
}

const pbS = StyleSheet.create({
  track: { height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
});

export function VulnBadge({ severity }: { severity: string }) {
  const c = severityColor(severity);
  return (
    <View style={[vbS.badge, { borderColor: c + '60', backgroundColor: c + '18' }]}>
      <Text style={[vbS.txt, { color: c }]}>{severity.toUpperCase()}</Text>
    </View>
  );
}

const vbS = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2 },
  txt: { fontSize: 8, fontWeight: '700', letterSpacing: 1 },
});
