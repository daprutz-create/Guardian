// src/screens/RequestDesignerScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeviceResult, RequestType } from '../utils/types';
import {
  loadProfile, saveProfile, buildRequest,
  sendAccessRequest, LABEL, TYPE_ICON, RequestProfile,
} from '../utils/accessManager';
import { C, Btn, Card } from '../components/UI';

const REQUEST_TYPES: RequestType[] = ['view', 'files', 'shutdown', 'full'];
const TIMEOUT_OPTIONS = [30, 60, 120, 300];
const PRESET_MESSAGES = [
  'Requesting access for home network security check.',
  'Hi! This is a connection request from my phone.',
  'Network admin requesting temporary access.',
  'Parental monitoring check — please approve.',
  'Running a routine security audit on our home network.',
];
const PRESET_REASONS = [
  'Home network security audit',
  'Parental controls check',
  'Device troubleshooting',
  'File transfer',
  'Remote management',
];

export default function RequestDesignerScreen({ route, navigation }: any) {
  const { device } = route.params as { device: DeviceResult };
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<RequestProfile>({
    displayName: 'Network Admin',
    message: 'Requesting access to your device for network management.',
    reason: 'Home network security audit',
    requestType: 'view',
    timeoutSeconds: 60,
    requireConfirmation: true,
  });
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState('');
  const [preview, setPreview] = useState(false);

  useEffect(() => { loadProfile().then(setProfile); }, []);

  const update = (key: keyof RequestProfile, val: any) => setProfile(p => ({ ...p, [key]: val }));

  const send = async () => {
    if (!profile.displayName.trim()) { Alert.alert('Missing', 'Enter your display name.'); return; }
    if (!profile.message.trim()) { Alert.alert('Missing', 'Enter a request message.'); return; }
    setSending(true);
    try {
      await saveProfile(profile);
      const req = buildRequest(device.ip, profile);
      const result = await sendAccessRequest(req, setStep);
      Alert.alert(result.success ? '✓ Request Sent' : 'Result', result.message, [{
        text: 'OK',
        onPress: () => { if (result.success) navigation.goBack(); },
      }]);
    } finally { setSending(false); setStep(''); }
  };

  const requestPreviewText = `FROM: ${profile.displayName}
TO: ${device.ip} (${device.deviceType})
TYPE: ${LABEL[profile.requestType]}
MESSAGE: ${profile.message}
REASON: ${profile.reason}
EXPIRES: ${profile.timeoutSeconds}s after sending`;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← BACK</Text>
        </TouchableOpacity>
        <Text style={s.title}>REQUEST DESIGNER</Text>
        <TouchableOpacity onPress={() => setPreview(v => !v)}>
          <Text style={[s.previewToggle, preview && { color: C.amber }]}>{preview ? 'EDIT' : 'PREVIEW'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14 }}>

        {/* Target */}
        <Card style={s.targetCard}>
          <Text style={s.targetIcon}>{device.deviceIcon}</Text>
          <View>
            <Text style={s.targetIP}>{device.ip}</Text>
            <Text style={s.targetType}>{device.deviceType}</Text>
          </View>
        </Card>

        {preview ? (
          // Preview Mode
          <Card>
            <Text style={s.sectionLbl}>REQUEST PREVIEW</Text>
            <Text style={s.previewText}>{requestPreviewText}</Text>
            <Text style={s.previewNote}>
              This is what will be sent to the device. On devices with the Guardian Agent installed, the owner will see a notification with ACCEPT/DENY buttons.
            </Text>
          </Card>
        ) : (
          <>
            {/* Display Name */}
            <Text style={s.fieldLbl}>YOUR DISPLAY NAME</Text>
            <TextInput
              style={s.input} value={profile.displayName}
              onChangeText={v => update('displayName', v)}
              placeholder="e.g. Dad's Phone" placeholderTextColor={C.dim}
              maxLength={40}
            />

            {/* Request Type */}
            <Text style={s.fieldLbl}>REQUEST TYPE</Text>
            <View style={s.typeRow}>
              {REQUEST_TYPES.map(t => (
                <TouchableOpacity key={t}
                  style={[s.typeBtn, profile.requestType === t && s.typeBtnActive]}
                  onPress={() => update('requestType', t)}>
                  <Text style={s.typeIcon}>{TYPE_ICON[t]}</Text>
                  <Text style={[s.typeTxt, profile.requestType === t && { color: C.green }]}>
                    {LABEL[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Message */}
            <Text style={s.fieldLbl}>MESSAGE (shown to device owner)</Text>
            <TextInput
              style={[s.input, s.inputMulti]} value={profile.message}
              onChangeText={v => update('message', v)}
              multiline numberOfLines={3}
              placeholder="Your message…" placeholderTextColor={C.dim}
              maxLength={200}
            />
            <Text style={s.charCount}>{profile.message.length}/200</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.presets}>
              {PRESET_MESSAGES.map((m, i) => (
                <TouchableOpacity key={i} style={s.presetChip} onPress={() => update('message', m)}>
                  <Text style={s.presetTxt}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Reason */}
            <Text style={s.fieldLbl}>REASON</Text>
            <TextInput
              style={s.input} value={profile.reason}
              onChangeText={v => update('reason', v)}
              placeholder="Why are you requesting access?" placeholderTextColor={C.dim}
              maxLength={100}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.presets}>
              {PRESET_REASONS.map((r, i) => (
                <TouchableOpacity key={i} style={s.presetChip} onPress={() => update('reason', r)}>
                  <Text style={s.presetTxt}>{r}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Timeout */}
            <Text style={s.fieldLbl}>REQUEST TIMEOUT</Text>
            <View style={s.timeoutRow}>
              {TIMEOUT_OPTIONS.map(t => (
                <TouchableOpacity key={t}
                  style={[s.timeoutBtn, profile.timeoutSeconds === t && s.timeoutBtnActive]}
                  onPress={() => update('timeoutSeconds', t)}>
                  <Text style={[s.timeoutTxt, profile.timeoutSeconds === t && { color: C.green }]}>
                    {t < 60 ? `${t}s` : `${t / 60}m`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Require Confirmation Toggle */}
            <View style={s.confirmRow}>
              <View>
                <Text style={s.fieldLbl}>REQUIRE CONFIRMATION</Text>
                <Text style={s.confirmSub}>Device owner must tap Accept/Deny</Text>
              </View>
              <TouchableOpacity
                style={[s.toggle, profile.requireConfirmation && s.toggleOn]}
                onPress={() => update('requireConfirmation', !profile.requireConfirmation)}>
                <Text style={[s.toggleTxt, profile.requireConfirmation && { color: C.bg }]}>
                  {profile.requireConfirmation ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Save as Default */}
            <TouchableOpacity style={s.saveDefault} onPress={() => saveProfile(profile).then(() => Alert.alert('✓ Saved', 'Profile saved as default.'))}>
              <Text style={s.saveDefaultTxt}>💾  SAVE AS DEFAULT PROFILE</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Send Button */}
        {step !== '' && (
          <View style={s.stepBanner}>
            <Text style={s.stepTxt}>{step}</Text>
          </View>
        )}
        <Btn label="SEND REQUEST" icon="📤" onPress={send} variant="primary" loading={sending} style={{ marginTop: 8 }} />

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.panel },
  back: { fontSize: 11, letterSpacing: 2, color: C.green, fontFamily: 'monospace' },
  title: { fontSize: 14, fontWeight: '900', letterSpacing: 2, color: C.green, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New' },
  previewToggle: { fontSize: 10, letterSpacing: 2, color: C.dim, fontFamily: 'monospace' },
  targetCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  targetIcon: { fontSize: 32 },
  targetIP: { fontSize: 18, fontWeight: '700', color: C.text, fontFamily: 'monospace' },
  targetType: { fontSize: 11, color: C.dim, marginTop: 2 },
  sectionLbl: { fontSize: 9, letterSpacing: 3, color: C.dim, textTransform: 'uppercase', marginBottom: 10 },
  previewText: { fontFamily: 'monospace', fontSize: 12, color: C.green, lineHeight: 20, backgroundColor: '#020806', padding: 12, borderRadius: 3, marginBottom: 10 },
  previewNote: { fontSize: 10, color: C.dim, lineHeight: 16 },
  fieldLbl: { fontSize: 9, letterSpacing: 2, color: C.dim, textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 12, color: C.text, fontFamily: 'monospace', fontSize: 13 },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  charCount: { fontSize: 9, color: C.dim, textAlign: 'right', marginTop: 3 },
  presets: { marginTop: 6, marginBottom: 2 },
  presetChip: { backgroundColor: 'rgba(0,255,106,0.07)', borderWidth: 1, borderColor: 'rgba(0,255,106,0.2)', borderRadius: 3, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 },
  presetTxt: { fontSize: 10, color: C.dim, maxWidth: 200 },
  typeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeBtn: { flex: 1, minWidth: '45%', backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 10, alignItems: 'center', gap: 4 },
  typeBtnActive: { borderColor: C.green, backgroundColor: 'rgba(0,255,106,0.08)' },
  typeIcon: { fontSize: 20 },
  typeTxt: { fontSize: 10, color: C.dim, letterSpacing: 1 },
  timeoutRow: { flexDirection: 'row', gap: 8 },
  timeoutBtn: { flex: 1, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 3, padding: 10, alignItems: 'center' },
  timeoutBtnActive: { borderColor: C.green, backgroundColor: 'rgba(0,255,106,0.08)' },
  timeoutTxt: { fontSize: 13, fontWeight: '700', color: C.dim, fontFamily: 'monospace' },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 12 },
  confirmSub: { fontSize: 9, color: C.dim, marginTop: 2 },
  toggle: { borderWidth: 1, borderColor: C.border, borderRadius: 3, paddingHorizontal: 16, paddingVertical: 8 },
  toggleOn: { backgroundColor: C.green, borderColor: C.green },
  toggleTxt: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: C.green },
  saveDefault: { marginTop: 12, backgroundColor: 'rgba(0,255,106,0.06)', borderWidth: 1, borderColor: 'rgba(0,255,106,0.2)', borderRadius: 4, padding: 12, alignItems: 'center' },
  saveDefaultTxt: { fontSize: 11, color: C.green, letterSpacing: 2, fontFamily: 'monospace' },
  stepBanner: { backgroundColor: 'rgba(0,255,106,0.08)', borderWidth: 1, borderColor: 'rgba(0,255,106,0.2)', borderRadius: 4, padding: 10, marginTop: 8 },
  stepTxt: { fontSize: 11, color: C.green, fontFamily: 'monospace' },
});
