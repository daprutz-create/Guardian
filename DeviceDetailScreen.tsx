// src/screens/DeviceDetailScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeviceResult } from '../utils/types';
import { deepProbeDevice } from '../utils/scanner';
import {
  loadProfile, buildRequest, sendAccessRequest, isPreApproved,
  preApproveDevice, removePreApproval, requestRemoteAction, LABEL, TYPE_ICON,
} from '../utils/accessManager';
import { C, Btn, Card, SectionTitle, InfoRow, ThreatPill, VulnBadge, severityColor } from '../components/UI';

export default function DeviceDetailScreen({ route, navigation }: any) {
  const { device: init } = route.params as { device: DeviceResult };
  const [device, setDevice] = useState<DeviceResult>(init);
  const [probing, setProbing] = useState(false);
  const [probeStep, setProbeStep] = useState('');
  const [showWebUi, setShowWebUi] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [preApproved, setPreApproved] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    isPreApproved(device.ip).then(setPreApproved);
  }, [device.ip]);

  const runDeepProbe = useCallback(async () => {
    setProbing(true);
    try {
      const result = await deepProbeDevice(device, step => setProbeStep(step));
      setDevice(result);
      if (result.defaultCredResult?.vulnerable) {
        Alert.alert('🚨 Critical Security Risk',
          `Default password is active!\n\nUser: ${result.defaultCredResult.workingCred?.user}\nPass: "${result.defaultCredResult.workingCred?.pass}"\n\nChange this immediately.`,
          [{ text: 'Understood', style: 'destructive' }]);
      }
      const criticals = result.vulnReport?.vulns.filter(v => v.severity === 'critical').length ?? 0;
      if (criticals > 0) {
        Alert.alert('⚠️ Critical Vulnerabilities', `Found ${criticals} critical vulnerability(s). See the report below.`, [{ text: 'View Report' }]);
      }
    } finally { setProbing(false); setProbeStep(''); }
  }, [device]);

  const sendRequest = useCallback(async (reqType?: any) => {
    setRequesting(true);
    try {
      const profile = await loadProfile();
      const req = buildRequest(device.ip, profile, reqType ? { requestType: reqType } : undefined);
      const result = await sendAccessRequest(req, msg => setProbeStep(msg));
      Alert.alert(result.success ? '✓ Request Sent' : 'Request Status', result.message,
        [{ text: 'OK', onPress: () => { if (result.success && device.webUiUrl) setShowWebUi(true); } }]);
    } finally { setRequesting(false); setProbeStep(''); }
  }, [device]);

  const doRemoteAction = useCallback(async (action: 'shutdown' | 'restart' | 'sleep') => {
    Alert.alert(`Confirm ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      `Send ${action} command to ${device.ip}?\n\nThis requires the Guardian Agent or SSH to be configured on the target device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', style: 'destructive', onPress: async () => {
          setActionBusy(true);
          const r = await requestRemoteAction(device.ip, action);
          setActionBusy(false);
          Alert.alert(r.success ? '✓ Done' : 'Not Available', r.message);
        }},
      ]);
  }, [device]);

  const togglePreApprove = useCallback(async () => {
    if (preApproved) {
      await removePreApproval(device.ip);
      setPreApproved(false);
      Alert.alert('Removed', `${device.ip} removed from pre-approved list.`);
    } else {
      await preApproveDevice(device.ip);
      setPreApproved(true);
      Alert.alert('✓ Pre-approved', `${device.ip} will be accessed without confirmation prompts.`);
    }
  }, [device.ip, preApproved]);

  const tc = device.threatLevel === 'suspicious' ? C.red : device.threatLevel === 'monitor' ? C.amber : C.green;

  // ── Web UI View ──
  if (showWebUi && device.webUiUrl) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.webBar}>
          <TouchableOpacity onPress={() => setShowWebUi(false)} style={s.webBack}>
            <Text style={s.webBackTxt}>← BACK</Text>
          </TouchableOpacity>
          <Text style={s.webUrl} numberOfLines={1}>{device.webUiUrl}</Text>
          <TouchableOpacity onPress={() => Linking.openURL(device.webUiUrl!)}>
            <Text style={s.webExt}>↗</Text>
          </TouchableOpacity>
        </View>
        <WebView
          source={{ uri: device.webUiUrl }}
          style={{ flex: 1 }}
          allowsInlineMediaPlayback
          javaScriptEnabled
          domStorageEnabled
          onError={() => Alert.alert('Cannot Load', 'Try opening in browser instead.')}
          renderLoading={() => (
            <View style={s.webLoader}>
              <ActivityIndicator color={C.green} size="large" />
              <Text style={s.webLoaderTxt}>Loading {device.webUiUrl}…</Text>
            </View>
          )}
          startInLoadingState
        />
      </View>
    );
  }

  // ── Main View ──
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← BACK</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>DEVICE DETAIL</Text>
        <ThreatPill level={device.threatLevel} />
      </View>

      {(probing || requesting || actionBusy) && (
        <View style={s.probeBanner}>
          <ActivityIndicator size="small" color={C.green} />
          <Text style={s.probeTxt}>{probeStep || 'Working…'}</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14 }}>

        {/* Identity */}
        <Card style={{ borderLeftWidth: 3, borderLeftColor: tc }}>
          <View style={s.identRow}>
            <Text style={s.bigIcon}>{device.deviceIcon}</Text>
            <View style={s.identInfo}>
              <Text style={s.bigIP}>{device.ip}</Text>
              <Text style={s.bigType}>{device.deviceType}</Text>
              <Text style={s.bigPorts}>{device.portLabels.length > 0 ? device.portLabels.join(' · ') : 'No open ports detected'}</Text>
              {device.webUiUrl && <Text style={s.webUiLine}>🌐 {device.webUiUrl}</Text>}
              {preApproved && <Text style={s.preAppTag}>⚡ PRE-APPROVED</Text>}
            </View>
          </View>
        </Card>

        {/* Vuln Score */}
        {device.vulnReport && (
          <View style={s.scoreRow}>
            <View style={[s.scoreBox, { borderColor: device.vulnReport.score > 50 ? C.red : device.vulnReport.score > 20 ? C.amber : C.green }]}>
              <Text style={[s.scoreNum, { color: device.vulnReport.score > 50 ? C.red : device.vulnReport.score > 20 ? C.amber : C.green }]}>
                {device.vulnReport.score}
              </Text>
              <Text style={s.scoreLbl}>RISK SCORE</Text>
            </View>
            <View style={s.vulnCounts}>
              {['critical','high','medium','low'].map(sev => {
                const count = device.vulnReport!.vulns.filter(v => v.severity === sev).length;
                return count > 0 ? (
                  <View key={sev} style={s.vulnCountRow}>
                    <Text style={[s.vulnCountN, { color: severityColor(sev) }]}>{count}</Text>
                    <Text style={s.vulnCountLbl}>{sev}</Text>
                  </View>
                ) : null;
              })}
              {device.vulnReport.vulns.length === 0 && <Text style={s.noVulns}>No vulnerabilities found ✓</Text>}
            </View>
          </View>
        )}

        {/* Primary Actions */}
        <SectionTitle>■ ACTIONS</SectionTitle>
        <View style={s.actGrid}>
          <Btn label="DEEP PROBE" icon="🔬" onPress={runDeepProbe} loading={probing} variant="primary" style={s.actBtn} />
          {device.webUiUrl &&
            <Btn label="VIEW WEB UI" icon="🌐" onPress={() => sendRequest('view').then(() => setShowWebUi(!!device.webUiUrl))} style={s.actBtn} />}
          <Btn label="REQUEST ACCESS" icon="🔑" onPress={() => navigation.navigate('RequestDesigner', { device })} style={s.actBtn} />
          <Btn label={preApproved ? 'REMOVE PRE-APPROVAL' : 'PRE-APPROVE'} icon="⚡"
            onPress={togglePreApprove} variant={preApproved ? 'danger' : 'outline'} style={s.actBtn} />
        </View>

        {/* Remote Control */}
        <SectionTitle>⚡ REMOTE CONTROL</SectionTitle>
        <Card>
          <Text style={s.remoteNote}>
            Requires Guardian Agent or SSH pre-configured on target device.
            For your own devices, set up the agent to enable these controls.
          </Text>
          <View style={s.remoteRow}>
            <Btn label="SHUTDOWN" icon="⏻" onPress={() => doRemoteAction('shutdown')} variant="danger" style={s.remoteBtn} loading={actionBusy} />
            <Btn label="RESTART" icon="↺" onPress={() => doRemoteAction('restart')} style={s.remoteBtn} loading={actionBusy} />
            <Btn label="SLEEP" icon="🌙" onPress={() => doRemoteAction('sleep')} style={s.remoteBtn} loading={actionBusy} />
          </View>
          <Btn label="OPEN WEB INTERFACE (MANUAL CONTROL)" icon="🖥️" onPress={() => device.webUiUrl ? setShowWebUi(true) : Alert.alert('No Web UI', 'This device has no detected web interface.')} style={{ marginTop: 8 }} />
        </Card>

        {/* Open Ports */}
        <SectionTitle>■ OPEN PORTS</SectionTitle>
        <Card>
          {device.openPorts.length === 0
            ? <Text style={s.dimTxt}>No open ports detected</Text>
            : <View style={s.portsGrid}>
                {device.openPorts.map(p => {
                  const susp = [23, 445, 3389, 5555, 7547, 3306].includes(p);
                  return (
                    <View key={p} style={[s.portChip, susp && s.portChipDanger]}>
                      <Text style={[s.portNum, susp && { color: C.red }]}>{p}</Text>
                      <Text style={[s.portName, susp && { color: '#ff6b6b' }]}>
                        {device.portLabels.find(l => l.startsWith(`${p}(`))?.replace(`${p}(`, '').replace(')', '') ?? '?'}
                      </Text>
                      {susp && <Text style={s.portWarn}>⚠</Text>}
                    </View>
                  );
                })}
              </View>}
        </Card>

        {/* Fingerprint */}
        {device.fingerprint && (
          <>
            <SectionTitle>🔍 FINGERPRINT</SectionTitle>
            <Card>
              <InfoRow label="Vendor" value={device.fingerprint.vendor ?? '—'} />
              <InfoRow label="Server" value={device.fingerprint.serverHeader ?? '—'} />
              <InfoRow label="Page Title" value={device.fingerprint.pageTitle ?? '—'} />
              <InfoRow label="Powered By" value={device.fingerprint.poweredBy ?? '—'} />
              {device.fingerprint.wwwAuthenticate && <InfoRow label="Auth" value={device.fingerprint.wwwAuthenticate} highlight />}
            </Card>
          </>
        )}

        {/* UPnP */}
        {device.upnpInfo && (
          <>
            <SectionTitle>📡 UPNP DISCOVERY</SectionTitle>
            <Card>
              <InfoRow label="Name" value={device.upnpInfo.friendlyName ?? '—'} />
              <InfoRow label="Manufacturer" value={device.upnpInfo.manufacturer ?? '—'} />
              <InfoRow label="Model" value={`${device.upnpInfo.modelName ?? '—'} ${device.upnpInfo.modelNumber ?? ''}`} />
              <InfoRow label="Serial" value={device.upnpInfo.serialNumber ?? '—'} />
              {device.upnpInfo.services.slice(0, 5).map((sv, i) => (
                <InfoRow key={i} label={i === 0 ? 'Services' : ''} value={sv.split(':').slice(-2).join(':')} />
              ))}
            </Card>
          </>
        )}

        {/* Default Creds */}
        {device.defaultCredResult && (
          <>
            <SectionTitle>🔑 DEFAULT CREDENTIALS</SectionTitle>
            <Card danger={device.defaultCredResult.vulnerable}>
              {device.defaultCredResult.vulnerable
                ? <>
                    <Text style={s.credVuln}>⚠️ DEFAULT PASSWORD WORKS!</Text>
                    <InfoRow label="Username" value={device.defaultCredResult.workingCred!.user} highlight />
                    <InfoRow label="Password" value={`"${device.defaultCredResult.workingCred!.pass}"`} highlight />
                    <Text style={s.credAdvice}>Change this password immediately in the device settings!</Text>
                  </>
                : <Text style={s.credSafe}>✓ Tested {device.defaultCredResult.tested} common passwords — none worked.</Text>}
              <Text style={s.checkedAt}>Checked {device.defaultCredResult.checkedAt}</Text>
            </Card>
          </>
        )}

        {/* Vulnerability Report */}
        {device.vulnReport && device.vulnReport.vulns.length > 0 && (
          <>
            <SectionTitle>⚠ VULNERABILITY REPORT</SectionTitle>
            {device.vulnReport.vulns.map(v => (
              <Card key={v.id} danger={v.severity === 'critical' || v.severity === 'high'} warn={v.severity === 'medium'}>
                <View style={s.vulnHead}>
                  <Text style={s.vulnTitle}>{v.title}</Text>
                  <VulnBadge severity={v.severity} />
                </View>
                {v.port && <Text style={s.vulnPort}>Port {v.port}</Text>}
                <Text style={s.vulnDesc}>{v.description}</Text>
                <View style={s.vulnFix}>
                  <Text style={s.vulnFixLbl}>FIX: </Text>
                  <Text style={s.vulnFixTxt}>{v.recommendation}</Text>
                </View>
              </Card>
            ))}
          </>
        )}

        {!device.fingerprint && !device.vulnReport && (
          <Card>
            <Text style={s.promptTxt}>
              Tap DEEP PROBE to identify this device, discover UPnP services, test for default credentials, and run a full vulnerability assessment.
            </Text>
          </Card>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.panel },
  back: { fontSize: 11, letterSpacing: 2, color: C.green, fontFamily: 'monospace' },
  headerTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 3, color: C.green, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New' },
  probeBanner: { backgroundColor: 'rgba(0,255,106,0.08)', borderBottomWidth: 1, borderBottomColor: 'rgba(0,255,106,0.2)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 10 },
  probeTxt: { fontSize: 11, color: C.green, fontFamily: 'monospace', flex: 1 },
  identRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  bigIcon: { fontSize: 40 },
  identInfo: { flex: 1, gap: 3 },
  bigIP: { fontSize: 20, fontWeight: '700', color: C.text, fontFamily: 'monospace' },
  bigType: { fontSize: 11, color: C.dim },
  bigPorts: { fontSize: 9, color: C.blue, fontFamily: 'monospace' },
  webUiLine: { fontSize: 10, color: C.blue },
  preAppTag: { fontSize: 9, color: C.amber, letterSpacing: 1 },
  scoreRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 14 },
  scoreBox: { borderWidth: 2, borderRadius: 8, padding: 12, alignItems: 'center', minWidth: 80 },
  scoreNum: { fontSize: 32, fontWeight: '900', fontFamily: 'monospace' },
  scoreLbl: { fontSize: 8, letterSpacing: 2, color: C.dim, textTransform: 'uppercase' },
  vulnCounts: { flex: 1, gap: 6 },
  vulnCountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vulnCountN: { fontSize: 18, fontWeight: '900', fontFamily: 'monospace', minWidth: 24 },
  vulnCountLbl: { fontSize: 11, color: C.dim, textTransform: 'uppercase', letterSpacing: 1 },
  noVulns: { fontSize: 12, color: C.green },
  actGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  actBtn: { flex: 1, minWidth: '45%' },
  remoteNote: { fontSize: 10, color: C.dim, lineHeight: 16, marginBottom: 10 },
  remoteRow: { flexDirection: 'row', gap: 8, marginBottom: 0 },
  remoteBtn: { flex: 1 },
  dimTxt: { fontSize: 11, color: C.dim, fontFamily: 'monospace' },
  portsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  portChip: { alignItems: 'center', backgroundColor: 'rgba(0,255,106,0.07)', borderWidth: 1, borderColor: 'rgba(0,255,106,0.2)', borderRadius: 3, paddingHorizontal: 10, paddingVertical: 7, minWidth: 60 },
  portChipDanger: { backgroundColor: 'rgba(255,61,61,0.08)', borderColor: 'rgba(255,61,61,0.3)' },
  portNum: { fontSize: 14, fontWeight: '700', color: C.green, fontFamily: 'monospace' },
  portName: { fontSize: 8, color: C.dim, marginTop: 1 },
  portWarn: { fontSize: 10, marginTop: 2 },
  credVuln: { fontSize: 13, fontWeight: '700', color: C.red, marginBottom: 8 },
  credAdvice: { fontSize: 11, color: C.amber, marginTop: 8, lineHeight: 16 },
  credSafe: { fontSize: 12, color: C.green, lineHeight: 18 },
  checkedAt: { fontSize: 9, color: C.dim, fontFamily: 'monospace', marginTop: 6 },
  vulnHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  vulnTitle: { fontSize: 13, fontWeight: '700', color: C.text, flex: 1, marginRight: 8 },
  vulnPort: { fontSize: 10, color: C.blue, fontFamily: 'monospace', marginBottom: 4 },
  vulnDesc: { fontSize: 11, color: C.dim, lineHeight: 17, marginBottom: 8 },
  vulnFix: { flexDirection: 'row', backgroundColor: 'rgba(0,255,106,0.05)', borderRadius: 3, padding: 8 },
  vulnFixLbl: { fontSize: 10, color: C.green, fontWeight: '700', flexShrink: 0 },
  vulnFixTxt: { fontSize: 10, color: '#7aaa80', flex: 1, lineHeight: 16 },
  promptTxt: { fontSize: 12, color: C.dim, lineHeight: 20 },
  webBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.panel, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 },
  webBack: {},
  webBackTxt: { fontSize: 11, color: C.green, fontFamily: 'monospace', letterSpacing: 1 },
  webUrl: { flex: 1, fontSize: 10, color: C.blue, fontFamily: 'monospace' },
  webExt: { fontSize: 18, color: C.green },
  webLoader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: C.bg },
  webLoaderTxt: { fontSize: 12, color: C.dim, fontFamily: 'monospace' },
});
