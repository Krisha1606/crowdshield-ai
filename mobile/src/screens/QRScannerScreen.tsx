import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  ScrollView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { useVolunteerStore } from '../store/useVolunteerStore';
import api from '../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type ResultCode =
  | 'ALLOWED'
  | 'ALREADY_SCANNED'
  | 'WRONG_GATE'
  | 'INVALID_QR'
  | 'EXPIRED_TICKET'
  | 'CANCELLED_TICKET';

interface ScanEntry {
  id: string;
  timestamp: Date;
  qrToken: string;
  result: ResultCode;
  message: string;
  attendeeName?: string;
  ticketId?: string;
  expectedGate?: string;
}

// ─── Result Config ────────────────────────────────────────────────────────────

const RESULT_CONFIG: Record<
  ResultCode,
  { icon: keyof typeof Ionicons.glyphMap; label: string; colorKey: 'green' | 'orange' | 'red' }
> = {
  ALLOWED:          { icon: 'checkmark-circle',     label: 'Entry Allowed',      colorKey: 'green'  },
  ALREADY_SCANNED:  { icon: 'alert-circle',         label: 'Already Scanned',    colorKey: 'orange' },
  WRONG_GATE:       { icon: 'git-branch-outline',   label: 'Wrong Gate',         colorKey: 'orange' },
  INVALID_QR:       { icon: 'close-circle',         label: 'Invalid QR',         colorKey: 'red'    },
  EXPIRED_TICKET:   { icon: 'time',                 label: 'Expired Ticket',     colorKey: 'red'    },
  CANCELLED_TICKET: { icon: 'ban-outline',          label: 'Cancelled Ticket',   colorKey: 'red'    },
};

// Map backend result strings to our internal ResultCode
function mapResult(raw: string, message?: string): ResultCode {
  if (raw === 'ALLOWED')         return 'ALLOWED';
  if (raw === 'ALREADY_SCANNED') return 'ALREADY_SCANNED';
  if (raw === 'WRONG_GATE')      return 'WRONG_GATE';
  if (raw === 'INVALID_QR')      return 'INVALID_QR';
  if (raw === 'EXPIRED_TICKET') {
    if (message?.toLowerCase().includes('cancelled')) {
      return 'CANCELLED_TICKET';
    }
    return 'EXPIRED_TICKET';
  }
  if (raw === 'CANCELLED_TICKET') return 'CANCELLED_TICKET';
  // Treat unknown as INVALID_QR
  return 'INVALID_QR';
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── Permission Screen ────────────────────────────────────────────────────────

function PermissionScreen({
  onRequest,
  colors,
}: {
  onRequest: () => void;
  colors: any;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.navy, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
      <Ionicons name="camera-outline" size={72} color={colors.blue} />
      <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: 'bold', marginTop: 20, textAlign: 'center' }}>
        Camera Access Required
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 12, textAlign: 'center', lineHeight: 20 }}>
        CrowdShield needs camera access to scan QR tickets. Please grant permission to continue.
      </Text>
      <TouchableOpacity
        onPress={onRequest}
        style={{ marginTop: 28, backgroundColor: colors.blue, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 10 }}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Grant Camera Permission</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function QRScannerScreen() {
  const colors = useThemeColors();
  const { assignedGateId, volunteerId, volunteerName, systemMode } = useVolunteerStore();

  // Camera permission
  const [permission, requestPermission] = useCameraPermissions();

  // Scan state
  const [scanning, setScanning] = useState(true);   // false → scanner paused
  const [loading, setLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<ScanEntry | null>(null);
  const [history, setHistory] = useState<ScanEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Duplicate prevention: track scanned tokens per session
  const scannedTokens = useRef<Set<string>>(new Set());

  // Animations
  const resultSlide = useRef(new Animated.Value(300)).current;   // result card slide-up
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const scanPulse = useRef(new Animated.Value(1)).current;

  // ── Scan frame pulse animation ────────────────────────────────────────────
  useEffect(() => {
    if (scanning && !loading) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(scanPulse, { toValue: 1.04, duration: 800, useNativeDriver: true }),
          Animated.timing(scanPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [scanning, loading]);

  // ── Show result card with animation ───────────────────────────────────────
  const showResult = useCallback((entry: ScanEntry) => {
    setCurrentResult(entry);
    resultSlide.setValue(300);
    resultOpacity.setValue(0);
    iconScale.setValue(0);

    Animated.parallel([
      Animated.timing(resultSlide, { toValue: 0, duration: 350, useNativeDriver: true }),
      Animated.timing(resultOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
    ]).start();
  }, [resultSlide, resultOpacity, iconScale]);

  // ── Dismiss result and resume scanning ────────────────────────────────────
  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(resultSlide, { toValue: 300, duration: 250, useNativeDriver: true }),
      Animated.timing(resultOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setCurrentResult(null);
      setScanning(true);
    });
  }, [resultSlide, resultOpacity]);

  // ── Core scan handler ─────────────────────────────────────────────────────
  const handleBarCodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (!scanning || loading) return;

      // Duplicate prevention (per session)
      if (scannedTokens.current.has(data)) return;
      scannedTokens.current.add(data);

      setScanning(false);
      setLoading(true);

      const entryBase: Omit<ScanEntry, 'result' | 'message'> = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        qrToken: data,
      };

      try {
        const response = await api.post('/live/qr/validate', {
          qr_token: data,
          gate_id: assignedGateId ?? 0,
          volunteer_id: volunteerId ?? undefined,
          scan_source: 'mobile',
        });

        const { result: rawResult, message, attendee, expected_gate } = response.data;
        const result = mapResult(rawResult, message);

        const entry: ScanEntry = {
          ...entryBase,
          result,
          message: message || rawResult,
          attendeeName: attendee?.attendee_name,
          ticketId: attendee?.ticket_id,
          expectedGate: expected_gate,
        };

        setHistory((prev) => [entry, ...prev.slice(0, 49)]); // keep last 50
        showResult(entry);
      } catch (err: any) {
        const serverMsg =
          err.response?.data?.detail ||
          err.response?.data?.message ||
          'Failed to validate QR. Check your connection.';

        const entry: ScanEntry = {
          ...entryBase,
          result: 'INVALID_QR',
          message: serverMsg,
        };

        setHistory((prev) => [entry, ...prev.slice(0, 49)]);
        showResult(entry);
      } finally {
        setLoading(false);
        // Auto-dismiss after 3 s for non-allowed results, 2.5 s for allowed
      }
    },
    [scanning, loading, assignedGateId, volunteerId, showResult]
  );

  // ── Auto-dismiss timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentResult) return;
    const delay = currentResult.result === 'ALLOWED' ? 2500 : 3500;
    const timer = setTimeout(() => dismiss(), delay);
    return () => clearTimeout(timer);
  }, [currentResult, dismiss]);

  const styles = getStyles(colors);

  // ── Permission not yet determined ─────────────────────────────────────────
  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: colors.navy }]}>
        <ActivityIndicator color={colors.blue} size="large" />
      </View>
    );
  }

  // ── Permission denied ─────────────────────────────────────────────────────
  if (!permission.granted) {
    return <PermissionScreen onRequest={requestPermission} colors={colors} />;
  }

  // ── Gate info ─────────────────────────────────────────────────────────────
  const gateLabel = assignedGateId ? `Gate #${assignedGateId}` : 'No Gate Assigned';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* ── Camera ── */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanning && !loading ? handleBarCodeScanned : undefined}
      />

      {/* ── Dark overlay (top & bottom bars) ── */}
      <View style={styles.overlay} pointerEvents="box-none">

        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.modeBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.modeBadgeText}>LIVE MODE</Text>
          </View>
          <Text style={styles.gateText}>{gateLabel}</Text>
          <TouchableOpacity
            style={styles.historyToggle}
            onPress={() => setShowHistory((v) => !v)}
          >
            <Ionicons name="list-outline" size={20} color="#fff" />
            {history.length > 0 && (
              <View style={styles.historyBadge}>
                <Text style={styles.historyBadgeText}>{history.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Middle — scan frame */}
        <View style={styles.middle}>
          <View style={styles.sideBlur} />
          <Animated.View style={[styles.scanFrame, { transform: [{ scale: scanPulse }] }]}>
            {/* Corner brackets */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {/* Loading spinner inside frame */}
            {loading && (
              <View style={styles.frameLoading}>
                <ActivityIndicator color="#fff" size="large" />
                <Text style={styles.frameLoadingText}>Validating…</Text>
              </View>
            )}
          </Animated.View>
          <View style={styles.sideBlur} />
        </View>

        {/* Hint text */}
        <View style={styles.hintArea}>
          <Text style={styles.hintText}>
            {loading ? 'Checking ticket…' : scanning ? 'Point camera at QR code' : 'Processing…'}
          </Text>
        </View>

        {/* History panel */}
        {showHistory && (
          <View style={styles.historyPanel}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Session History ({history.length})</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.historyList} keyboardShouldPersistTaps="handled">
              {history.length === 0 ? (
                <Text style={styles.historyEmpty}>No scans yet this session.</Text>
              ) : (
                history.map((entry) => (
                  <HistoryRow key={entry.id} entry={entry} colors={colors} />
                ))
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* ── Result Card (slide-up overlay) ── */}
      {currentResult && (
        <Animated.View
          style={[
            styles.resultCard,
            {
              transform: [{ translateY: resultSlide }],
              opacity: resultOpacity,
            },
          ]}
        >
          <ResultCard
            entry={currentResult}
            colors={colors}
            iconScale={iconScale}
            onDismiss={dismiss}
          />
        </Animated.View>
      )}
    </View>
  );
}

// ─── Result Card Component ────────────────────────────────────────────────────

function ResultCard({
  entry,
  colors,
  iconScale,
  onDismiss,
}: {
  entry: ScanEntry;
  colors: any;
  iconScale: Animated.Value;
  onDismiss: () => void;
}) {
  const cfg = RESULT_CONFIG[entry.result];
  const accentColor = colors[cfg.colorKey];

  return (
    <View style={[rcStyles.card, { borderTopColor: accentColor }]}>
      {/* Icon */}
      <Animated.View style={{ transform: [{ scale: iconScale }], marginBottom: 10 }}>
        <Ionicons name={cfg.icon} size={56} color={accentColor} />
      </Animated.View>

      {/* Label */}
      <Text style={[rcStyles.label, { color: accentColor }]}>{cfg.label}</Text>

      {/* Attendee info */}
      {entry.attendeeName && (
        <Text style={rcStyles.attendeeName}>{entry.attendeeName}</Text>
      )}
      {entry.ticketId && (
        <Text style={rcStyles.ticketId}>Ticket #{entry.ticketId}</Text>
      )}
      {entry.expectedGate && (
        <Text style={rcStyles.expectedGate}>→ Redirect to: {entry.expectedGate}</Text>
      )}

      {/* Message */}
      <Text style={rcStyles.message}>{entry.message}</Text>

      {/* Time */}
      <Text style={rcStyles.time}>{formatTime(entry.timestamp)}</Text>

      {/* Dismiss button */}
      <TouchableOpacity style={[rcStyles.dismissBtn, { borderColor: accentColor }]} onPress={onDismiss}>
        <Text style={[rcStyles.dismissText, { color: accentColor }]}>Scan Next</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── History Row Component ────────────────────────────────────────────────────

function HistoryRow({ entry, colors }: { entry: ScanEntry; colors: any }) {
  const cfg = RESULT_CONFIG[entry.result];
  const accentColor = colors[cfg.colorKey];

  return (
    <View style={hrStyles.row}>
      <Ionicons name={cfg.icon} size={18} color={accentColor} style={{ marginRight: 8, marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[hrStyles.label, { color: accentColor }]}>{cfg.label}</Text>
          <Text style={hrStyles.time}>{formatTime(entry.timestamp)}</Text>
        </View>
        {entry.attendeeName ? (
          <Text style={hrStyles.name}>{entry.attendeeName}</Text>
        ) : (
          <Text style={hrStyles.name} numberOfLines={1}>{entry.qrToken.slice(0, 30)}…</Text>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const FRAME_SIZE = 240;
const CORNER_LEN = 26;
const CORNER_THICK = 3;
const CORNER_RADIUS = 6;
const CORNER_COLOR = '#fff';

const getStyles = (colors: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#000',
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // ── Overlay ──
    overlay: {
      flex: 1,
    },

    // ── Top bar ──
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'ios' ? 52 : 16,
      paddingBottom: 12,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    modeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(99,102,241,0.25)',
      borderWidth: 1,
      borderColor: 'rgba(99,102,241,0.5)',
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: '#818cf8',
      marginRight: 5,
    },
    modeBadgeText: {
      color: '#a5b4fc',
      fontSize: 11,
      fontWeight: 'bold',
      letterSpacing: 0.8,
    },
    gateText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
    },
    historyToggle: {
      padding: 6,
    },
    historyBadge: {
      position: 'absolute',
      top: 2,
      right: 2,
      backgroundColor: colors.blue,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 2,
    },
    historyBadgeText: {
      color: '#fff',
      fontSize: 9,
      fontWeight: 'bold',
    },

    // ── Middle / Frame ──
    middle: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    sideBlur: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignSelf: 'stretch',
    },
    scanFrame: {
      width: FRAME_SIZE,
      height: FRAME_SIZE,
      justifyContent: 'center',
      alignItems: 'center',
    },
    corner: {
      position: 'absolute',
      width: CORNER_LEN,
      height: CORNER_LEN,
    },
    cornerTL: {
      top: 0,
      left: 0,
      borderTopWidth: CORNER_THICK,
      borderLeftWidth: CORNER_THICK,
      borderTopLeftRadius: CORNER_RADIUS,
      borderColor: CORNER_COLOR,
    },
    cornerTR: {
      top: 0,
      right: 0,
      borderTopWidth: CORNER_THICK,
      borderRightWidth: CORNER_THICK,
      borderTopRightRadius: CORNER_RADIUS,
      borderColor: CORNER_COLOR,
    },
    cornerBL: {
      bottom: 0,
      left: 0,
      borderBottomWidth: CORNER_THICK,
      borderLeftWidth: CORNER_THICK,
      borderBottomLeftRadius: CORNER_RADIUS,
      borderColor: CORNER_COLOR,
    },
    cornerBR: {
      bottom: 0,
      right: 0,
      borderBottomWidth: CORNER_THICK,
      borderRightWidth: CORNER_THICK,
      borderBottomRightRadius: CORNER_RADIUS,
      borderColor: CORNER_COLOR,
    },
    frameLoading: {
      alignItems: 'center',
    },
    frameLoadingText: {
      color: '#fff',
      marginTop: 10,
      fontSize: 13,
      fontWeight: '600',
    },

    // ── Hint ──
    hintArea: {
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingVertical: 18,
      alignItems: 'center',
    },
    hintText: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 14,
      fontWeight: '500',
    },

    // ── History Panel ──
    historyPanel: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 96 : 60,
      right: 0,
      width: 300,
      maxHeight: 320,
      backgroundColor: 'rgba(13,15,26,0.95)',
      borderLeftWidth: 1,
      borderBottomLeftRadius: 12,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    historyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    historyTitle: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 13,
    },
    historyList: {
      maxHeight: 270,
    },
    historyEmpty: {
      color: 'rgba(255,255,255,0.4)',
      fontSize: 13,
      textAlign: 'center',
      padding: 16,
    },

    // ── Result card positioned at bottom ──
    resultCard: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
  });

const rcStyles = StyleSheet.create({
  card: {
    backgroundColor: '#0D0F1A',
    borderTopWidth: 3,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 28,
    paddingBottom: 36,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 20,
  },
  label: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  attendeeName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#EEF0F8',
    marginTop: 6,
    textAlign: 'center',
  },
  ticketId: {
    fontSize: 12,
    color: '#8891A8',
    marginTop: 2,
  },
  expectedGate: {
    fontSize: 13,
    color: '#F59E0B',
    marginTop: 4,
    fontWeight: '600',
  },
  message: {
    fontSize: 14,
    color: '#8891A8',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  time: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 6,
  },
  dismissBtn: {
    marginTop: 18,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  dismissText: {
    fontWeight: 'bold',
    fontSize: 15,
  },
});

const hrStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  time: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },
  name: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 1,
  },
});
