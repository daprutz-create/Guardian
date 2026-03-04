// src/screens/NFCScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, FlatList, Platform, Modal, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import {
  NFCCard, detectTagType, formatUID, uidToHex, tagTypeLabel, tagTypeColor,
  buildEmployeeNDEF, parseEmployeeNDEF, buildNDEFText, saveCard, loadAllCards,
  deleteCard, newCardId, cardTypeIcon, cardTypeLabel,
} from '../utils/nfc';
import { C, Btn, Card, SectionTitle } from '../components/UI';

type Mode = 'home' | 'scan' | 'write' | 'emulate' | 'cards' | 'edit';

export default function NFCScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('home');
  const [nfcSupported, setNfcSupported] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [writing, setWriting] = useState(false);
  const [emulating, setEmulating] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [lastScanned, setLastScanned] = useState<NFCCard | null>(null);
  const [cards, setCards] = useState<NFCCard[]>([]);
  const [editCard, setEditCard] = useState<Partial<NFCCard>>({});
  const [selectedCard, setSelectedCard] = useState<NFCCard | null>(null);

  useEffect(() => {
    NfcManager.isSupported().then(supported => {
      setNfcSupported(supported);
      if (supported) NfcManager.start();
    });
    loadAllCards().then(setCards);
    return () => { NfcManager.cancelTechnologyRequest().catch(() => {}); };
  }, []);

  const refreshCards = useCallback(() => loadAllCards().then(setCards), []);

  // ── Read Card ──────────────────────────────────────────────────────────────
  const readCard = useCallback(async () => {
    if (!nfcSupported) { Alert.alert('NFC Not Available', 'This device does not support NFC.'); return; }
    setScanning(true);
    setStatusMsg('Hold card to the back of your phone…');
    try {
      await NfcManager.requestTechnology([NfcTech.Ndef, NfcTech.NfcA, NfcTech.MifareClassic], {
        alertMessage: 'Hold your NFC card to the phone',
      });
      const tag = await NfcManager.getTag();
      if (!tag) throw new Error('No tag detected');

      const uid = tag.id ? formatUID(Array.from(tag.id as any)) : 'Unknown';
      const techTypes = tag.techTypes ?? [];
      const tagType = detectTagType(techTypes);

      // Try to read NDEF
      let ndefMessage = '';
      let employeeData: Partial<NFCCard> = {};
      try {
        const ndefTag = await NfcManager.ndefHandler.getNdefMessage();
        if (ndefTag?.ndefMessage?.[0]) {
          const payload = ndefTag.ndefMessage[0].payload;
          const text = Ndef.text.decodePayload(new Uint8Array(payload));
          ndefMessage = text;
          const parsed = parseEmployeeNDEF(text);
          if (parsed) employeeData = parsed;
        }
      } catch (_) {}

      const card: NFCCard = {
        id: newCardId(),
        uid,
        tagType,
        techTypes,
        ndefMessage,
        issuedDate: new Date().toISOString(),
        cardType: employeeData.cardType ?? 'raw',
        ...employeeData,
      };

      setLastScanned(card);
      setEditCard(card);
      setStatusMsg(`✓ Card read successfully — UID: ${uid}`);
      setMode('edit');
    } catch (err: any) {
      if (!err?.message?.includes('cancel')) {
        setStatusMsg(`Error: ${err?.message ?? 'Scan failed'}`);
      }
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => {});
      setScanning(false);
    }
  }, [nfcSupported]);

  // ── Write Card ─────────────────────────────────────────────────────────────
  const writeCard = useCallback(async (card: Partial<NFCCard>) => {
    if (!nfcSupported) { Alert.alert('NFC Not Available', 'This device does not support NFC.'); return; }
    setWriting(true);
    setStatusMsg('Hold a blank NFC card to the phone…');
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: 'Hold blank NFC card to phone to write',
      });
      const ndefPayload = buildEmployeeNDEF(card);
      const bytes = Ndef.encodeMessage([Ndef.textRecord(ndefPayload)]);
      if (bytes) await NfcManager.ndefHandler.writeNdefMessage(bytes);
      setStatusMsg('✓ Card written successfully!');
      Alert.alert('✓ Written', `Card programmed for ${card.employeeName ?? 'employee'}.`);
      // Save to DB
      const fullCard: NFCCard = {
        id: card.id ?? newCardId(),
        uid: card.uid ?? 'Written',
        tagType: card.tagType ?? 'NTAG',
        techTypes: card.techTypes ?? [],
        issuedDate: card.issuedDate ?? new Date().toISOString(),
        cardType: card.cardType ?? 'employee',
        employeeName: card.employeeName,
        employeeId: card.employeeId,
        notes: card.notes,
        ndefMessage: ndefPayload,
      };
      await saveCard(fullCard);
      await refreshCards();
      setMode('cards');
    } catch (err: any) {
      if (!err?.message?.includes('cancel')) {
        Alert.alert('Write Failed', err?.message ?? 'Could not write to card. Ensure card is writable.');
      }
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => {});
      setWriting(false);
    }
  }, [nfcSupported, refreshCards]);

  // ── Emulate Card ───────────────────────────────────────────────────────────
  const startEmulate = useCallback(async (card: NFCCard) => {
    if (!nfcSupported) { Alert.alert('Not Available', 'NFC not supported.'); return; }
    setEmulating(true);
    setSelectedCard(card);
    setStatusMsg(`Emulating ${card.employeeName ?? card.uid}… Hold phone to reader.`);
    // HCE (Host Card Emulation) — requires Android HCE service setup
    // This sets the active card for the HCE service
    try {
      await NfcManager.setNdefPushMessage([Ndef.textRecord(card.ndefMessage ?? buildEmployeeNDEF(card))]);
      setStatusMsg('✓ Emulation active — hold phone to reader');
    } catch (err: any) {
      Alert.alert('Emulation Note', 'Full card emulation requires HCE service configuration. NFC beam is active for NDEF sharing.');
    }
  }, [nfcSupported]);

  const stopEmulate = useCallback(() => {
    NfcManager.setNdefPushMessage([]).catch(() => {});
    setEmulating(false);
    setSelectedCard(null);
    setStatusMsg('Emulation stopped');
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        {mode !== 'home'
          ? <TouchableOpacity onPress={() => setMode('home')}><Text style={s.back}>← BACK</Text></TouchableOpacity>
          : <View style={{ width: 60 }} />}
        <Text style={s.title}>NFC CARDS</Text>
        <TouchableOpacity onPress={() => { setMode('cards'); refreshCards(); }}>
          <Text style={s.cardsBtn}>DB ({cards.length})</Text>
        </TouchableOpacity>
      </View>

      {/* NFC not supported warning */}
      {nfcSupported === false && (
        <View style={s.warnBanner}>
          <Text style={s.warnTxt}>⚠ NFC not available on this device</Text>
        </View>
      )}

      {/* Status bar */}
      {statusMsg !== '' && (
        <View style={s.statusBar}>
          <Text style={s.statusTxt}>{statusMsg}</Text>
        </View>
      )}

      {/* HOME */}
      {mode === 'home' && (
        <ScrollView contentContainerStyle={s.homeContent}>
          <Text style={s.homeTitle}>NFC CARD MANAGER</Text>
          <Text style={s.homeSub}>Read, write, clone, and manage NFC access cards for your business</Text>

          <View style={s.actionGrid}>
            {[
              { icon: '📖', label: 'READ CARD', sub: 'Scan any NFC card', action: () => readCard() },
              { icon: '✏️', label: 'WRITE CARD', sub: 'Program a blank card', action: () => { setEditCard({ cardType: 'employee', issuedDate: new Date().toISOString() }); setMode('write'); } },
              { icon: '📋', label: 'CARD DATABASE', sub: `${cards.length} cards stored`, action: () => { setMode('cards'); refreshCards(); } },
              { icon: '📡', label: 'EMULATE CARD', sub: 'Phone as access card', action: () => { setMode('cards'); refreshCards(); } },
            ].map(item => (
              <TouchableOpacity key={item.label} style={s.actionCard} onPress={item.action}>
                <Text style={s.actionIcon}>{item.icon}</Text>
                <Text style={s.actionLabel}>{item.label}</Text>
                <Text style={s.actionSub}>{item.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Card style={s.infoCard}>
            <Text style={s.infoTitle}>💡 HOW TO USE</Text>
            <Text style={s.infoText}>• READ: Scan any existing card to see its data and save it</Text>
            <Text style={s.infoText}>• WRITE: Program a blank NTAG/MIFARE card with employee info</Text>
            <Text style={s.infoText}>• DATABASE: View, edit, and manage all issued cards</Text>
            <Text style={s.infoText}>• EMULATE: Turn your phone into an access card</Text>
            <Text style={s.infoNote}>Blank NFC cards (NTAG213/215/216) available cheaply online</Text>
          </Card>
        </ScrollView>
      )}

      {/* EDIT / SAVE CARD */}
      {(mode === 'edit' || mode === 'write') && (
        <ScrollView contentContainerStyle={{ padding: 14 }}>
          <SectionTitle>{mode === 'write' ? '✏️ PROGRAM NEW CARD' : '💾 SAVE SCANNED CARD'}</SectionTitle>

          {lastScanned && mode === 'edit' && (
            <Card style={s.scannedInfo}>
              <Text style={s.scannedLabel}>SCANNED CARD</Text>
              <Text style={s.scannedUID}>UID: {lastScanned.uid}</Text>
              <Text style={s.scannedType}>{tagTypeLabel(lastScanned.tagType)}</Text>
              {lastScanned.ndefMessage && <Text style={s.scannedNdef}>NDEF: {lastScanned.ndefMessage.slice(0, 80)}</Text>}
            </Card>
          )}

          <FieldLabel>CARD TYPE</FieldLabel>
          <View style={s.typeRow}>
            {(['employee', 'master', 'visitor', 'raw'] as NFCCard['cardType'][]).map(t => (
              <TouchableOpacity key={t}
                style={[s.typeChip, editCard.cardType === t && s.typeChipActive]}
                onPress={() => setEditCard(e => ({ ...e, cardType: t }))}>
                <Text style={s.typeChipIcon}>{cardTypeIcon(t)}</Text>
                <Text style={[s.typeChipTxt, editCard.cardType === t && { color: C.green }]}>{cardTypeLabel(t)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <FieldLabel>EMPLOYEE NAME</FieldLabel>
          <TextInput style={s.input} value={editCard.employeeName ?? ''} onChangeText={v => setEditCard(e => ({ ...e, employeeName: v }))} placeholder="Full name" placeholderTextColor={C.dim} />

          <FieldLabel>EMPLOYEE ID</FieldLabel>
          <TextInput style={s.input} value={editCard.employeeId ?? ''} onChangeText={v => setEditCard(e => ({ ...e, employeeId: v }))} placeholder="EMP-001" placeholderTextColor={C.dim} />

          <FieldLabel>NOTES</FieldLabel>
          <TextInput style={[s.input, { height: 70 }]} value={editCard.notes ?? ''} onChangeText={v => setEditCard(e => ({ ...e, notes: v }))} placeholder="Department, access level, etc." placeholderTextColor={C.dim} multiline textAlignVertical="top" />

          <View style={s.btnRow}>
            {mode === 'write' && (
              <Btn label="WRITE TO CARD" icon="✏️" variant="primary"
                loading={writing}
                onPress={() => writeCard(editCard)}
                style={{ flex: 1 }} />
            )}
            {mode === 'edit' && (
              <Btn label="SAVE TO DATABASE" icon="💾" variant="primary"
                onPress={async () => {
                  const card: NFCCard = {
                    ...(lastScanned!),
                    ...editCard,
                    id: lastScanned?.id ?? newCardId(),
                  } as NFCCard;
                  await saveCard(card);
                  await refreshCards();
                  Alert.alert('✓ Saved', 'Card saved to database.');
                  setMode('cards');
                }}
                style={{ flex: 1 }} />
            )}
          </View>

          {mode === 'edit' && (
            <Btn label="WRITE UPDATED DATA TO CARD" icon="✏️"
              loading={writing}
              onPress={() => writeCard(editCard)}
              style={{ marginTop: 8 }} />
          )}
        </ScrollView>
      )}

      {/* CARD DATABASE */}
      {mode === 'cards' && (
        <View style={{ flex: 1 }}>
          <View style={s.cardsHeader}>
            <Text style={s.cardsTitle}>{cards.length} CARDS IN DATABASE</Text>
            <Btn label="+ NEW" onPress={() => { setEditCard({ cardType: 'employee', issuedDate: new Date().toISOString() }); setMode('write'); }} style={s.newBtn} />
          </View>
          {cards.length === 0
            ? <View style={s.empty}><Text style={s.emptyTxt}>No cards yet — scan or create one</Text></View>
            : <FlatList
                data={cards}
                keyExtractor={c => c.id}
                contentContainerStyle={{ padding: 14 }}
                renderItem={({ item }) => (
                  <View style={s.cardRow}>
                    <Text style={s.cardRowIcon}>{cardTypeIcon(item.cardType)}</Text>
                    <View style={s.cardRowInfo}>
                      <Text style={s.cardRowName}>{item.employeeName ?? 'Unnamed Card'}</Text>
                      <Text style={s.cardRowUID}>UID: {item.uid}</Text>
                      <Text style={s.cardRowMeta}>{cardTypeLabel(item.cardType)} · {item.employeeId ?? '—'} · {new Date(item.issuedDate).toLocaleDateString()}</Text>
                    </View>
                    <View style={s.cardRowActions}>
                      <TouchableOpacity style={s.cardRowBtn} onPress={() => startEmulate(item)}>
                        <Text style={s.cardRowBtnTxt}>📡</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.cardRowBtn} onPress={() => {
                        Alert.alert('Delete Card', `Remove ${item.employeeName ?? item.uid}?`, [
                          { text: 'Cancel' },
                          { text: 'Delete', style: 'destructive', onPress: async () => { await deleteCard(item.id); await refreshCards(); } },
                        ]);
                      }}>
                        <Text style={[s.cardRowBtnTxt, { color: C.red }]}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />}
        </View>
      )}

      {/* EMULATE OVERLAY */}
      {emulating && selectedCard && (
        <View style={s.emulateOverlay}>
          <View style={s.emulateBox}>
            <Text style={s.emulateIcon}>📡</Text>
            <Text style={s.emulateTitle}>EMULATING CARD</Text>
            <Text style={s.emulateName}>{selectedCard.employeeName ?? selectedCard.uid}</Text>
            <Text style={s.emulateUID}>{selectedCard.uid}</Text>
            <Text style={s.emulateHint}>Hold phone to NFC reader</Text>
            <Btn label="STOP EMULATION" onPress={stopEmulate} variant="danger" style={{ marginTop: 16 }} />
          </View>
        </View>
      )}
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={{ fontSize: 9, letterSpacing: 2, color: C.dim, textTransform: 'uppercase', marginBottom: 6, marginTop: 12 }}>{children}</Text>;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.panel },
  back: { fontSize: 11, letterSpacing: 2, color: C.green, fontFamily: 'monospace' },
  title: { fontSize: 16, fontWeight: '900', letterSpacing: 3, color: C.green, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New' },
  cardsBtn: { fontSize: 10, letterSpacing: 1, color: C.blue, fontFamily: 'monospace' },
  warnBanner: { backgroundColor: 'rgba(255,179,0,0.1)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,179,0,0.3)', padding: 10 },
  warnTxt: { fontSize: 11, color: C.amber, textAlign: 'center' },
  statusBar: { backgroundColor: 'rgba(0,255,106,0.08)', borderBottomWidth: 1, borderBottomColor: 'rgba(0,255,106,0.2)', paddingHorizontal: 14, paddingVertical: 8 },
  statusTxt: { fontSize: 11, color: C.green, fontFamily: 'monospace' },
  homeContent: { padding: 16, gap: 14 },
  homeTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 3, color: C.green, fontFamily: 'monospace', textAlign: 'center' },
  homeSub: { fontSize: 12, color: C.dim, textAlign: 'center', lineHeight: 18 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: { flex: 1, minWidth: '45%', backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 16, alignItems: 'center', gap: 6 },
  actionIcon: { fontSize: 28 },
  actionLabel: { fontSize: 11, fontWeight: '700', color: C.green, letterSpacing: 2, fontFamily: 'monospace' },
  actionSub: { fontSize: 10, color: C.dim, textAlign: 'center' },
  infoCard: { gap: 6 },
  infoTitle: { fontSize: 10, letterSpacing: 2, color: C.green, marginBottom: 6 },
  infoText: { fontSize: 11, color: C.dim, lineHeight: 18 },
  infoNote: { fontSize: 10, color: C.amber, marginTop: 6, lineHeight: 16 },
  scannedInfo: { marginBottom: 4 },
  scannedLabel: { fontSize: 9, letterSpacing: 2, color: C.dim, marginBottom: 6 },
  scannedUID: { fontSize: 13, color: C.green, fontFamily: 'monospace' },
  scannedType: { fontSize: 11, color: C.dim, marginTop: 2 },
  scannedNdef: { fontSize: 10, color: C.blue, fontFamily: 'monospace', marginTop: 4 },
  typeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  typeChip: { flex: 1, minWidth: '45%', backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 10, alignItems: 'center', gap: 3 },
  typeChipActive: { borderColor: C.green, backgroundColor: 'rgba(0,255,106,0.08)' },
  typeChipIcon: { fontSize: 20 },
  typeChipTxt: { fontSize: 10, color: C.dim, letterSpacing: 1 },
  input: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 12, color: C.text, fontFamily: 'monospace', fontSize: 13, marginBottom: 4 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cardsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  cardsTitle: { fontSize: 11, letterSpacing: 2, color: C.green, fontFamily: 'monospace' },
  newBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { fontSize: 12, color: C.dim },
  cardRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 12, marginBottom: 8, gap: 10 },
  cardRowIcon: { fontSize: 24 },
  cardRowInfo: { flex: 1 },
  cardRowName: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  cardRowUID: { fontSize: 10, color: C.green, fontFamily: 'monospace', marginBottom: 1 },
  cardRowMeta: { fontSize: 9, color: C.dim },
  cardRowActions: { flexDirection: 'row', gap: 4 },
  cardRowBtn: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 3, padding: 8 },
  cardRowBtnTxt: { fontSize: 16 },
  emulateOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  emulateBox: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.green, borderRadius: 8, padding: 32, alignItems: 'center', gap: 10, width: '80%' },
  emulateIcon: { fontSize: 50 },
  emulateTitle: { fontSize: 12, letterSpacing: 3, color: C.dim, textTransform: 'uppercase' },
  emulateName: { fontSize: 20, fontWeight: '700', color: C.green, fontFamily: 'monospace' },
  emulateUID: { fontSize: 12, color: C.dim, fontFamily: 'monospace' },
  emulateHint: { fontSize: 12, color: C.amber },
});
