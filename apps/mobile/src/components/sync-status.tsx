import { formatTime } from "@ronde/domain";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSync } from "../sync/store";
import { useTheme } from "../theme";

/**
 * Indique en permanence si tout est synchronisé : le technicien doit savoir, avant de partir,
 * que son travail est bien arrivé au bureau.
 */
export function SyncStatus() {
  const theme = useTheme();
  const pending = useSync((s) => s.queue.length);
  const reachable = useSync((s) => s.reachable);
  const syncing = useSync((s) => s.syncing);
  const fetchedAt = useSync((s) => s.fetchedAt);
  const sync = useSync((s) => s.sync);

  const offline = !reachable;
  const tone = offline ? { fg: theme.warning, bg: theme.warningSoft } : pending ? { fg: theme.foreground, bg: theme.surfaceMuted } : { fg: theme.status.DONE.fg, bg: theme.status.DONE.bg };
  const label = syncing
    ? "Synchronisation…"
    : offline
      ? pending
        ? `Hors ligne · ${pending} action${pending > 1 ? "s" : ""} en attente`
        : "Hors ligne · données du dernier passage"
      : pending
        ? `${pending} action${pending > 1 ? "s" : ""} en attente`
        : `À jour${fetchedAt ? ` · ${formatTime(fetchedAt)}` : ""}`;

  return (
    <Pressable
      testID="sync-status"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Lance une synchronisation"
      accessibilityLiveRegion="polite"
      onPress={() => void sync()}
      style={[styles.pill, { backgroundColor: tone.bg }]}
    >
      <View style={[styles.dot, { backgroundColor: tone.fg }]} />
      <Text style={[styles.text, { color: tone.fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, minHeight: 36 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 14, fontWeight: "600" },
});
