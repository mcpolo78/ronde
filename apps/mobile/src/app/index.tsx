import { formatLongDay, formatTimeRange } from "@ronde/domain";
import { Link, Stack } from "expo-router";
import { useState } from "react";
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View, Alert } from "react-native";
import { SyncStatus } from "../components/sync-status";
import { Card, StatusBadge } from "../components/ui";
import { authClient } from "../lib/auth-client";
import type { LocalIntervention } from "../sync/engine";
import { useDay, useSync } from "../sync/store";
import { RADIUS, useTheme } from "../theme";

function confirm(message: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (globalThis.confirm?.(message)) onConfirm();
    return;
  }
  Alert.alert("Se déconnecter ?", message, [
    { text: "Annuler", style: "cancel" },
    { text: "Se déconnecter", style: "destructive", onPress: onConfirm },
  ]);
}

export default function MyDayScreen() {
  const theme = useTheme();
  const day = useDay();
  const name = useSync((s) => s.technicianName);
  const queue = useSync((s) => s.queue);
  const conflicts = useSync((s) => s.conflicts);
  const sync = useSync((s) => s.sync);
  const [refreshing, setRefreshing] = useState(false);

  const done = day.filter((i) => i.status === "DONE").length;

  function signOut() {
    const doSignOut = () => void authClient.signOut();
    if (queue.length) {
      confirm(
        `${queue.length} action(s) ne sont pas encore synchronisées. Elles seront envoyées à votre prochaine connexion.`,
        doSignOut,
      );
    } else doSignOut();
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Text accessibilityRole="button" onPress={signOut} style={[styles.headerAction, { color: theme.brand }]}>
              Déconnexion
            </Text>
          ),
        }}
      />
      <FlatList
        data={day}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await sync();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.hello, { color: theme.foreground }]}>
              Bonjour{name ? ` ${name.split(" ")[0]}` : ""}
            </Text>
            <Text style={[styles.date, { color: theme.muted }]}>
              {capitalize(formatLongDay(new Date()))} · {day.length ? `${done}/${day.length} terminée${done > 1 ? "s" : ""}` : "aucune intervention"}
            </Text>
            <SyncStatus />
          </View>
        }
        ListEmptyComponent={
          <Card>
            <Text style={{ color: theme.foreground, fontSize: 17, fontWeight: "600" }}>Aucune intervention aujourd&apos;hui</Text>
            <Text style={{ color: theme.muted, fontSize: 15 }}>Tirez vers le bas pour actualiser.</Text>
          </Card>
        }
        renderItem={({ item }) => (
          <InterventionCard
            intervention={item}
            pending={queue.filter((o) => o.interventionId === item.id).length}
            conflict={Boolean(conflicts[item.id])}
          />
        )}
      />
    </>
  );
}

function InterventionCard({ intervention: i, pending, conflict }: { intervention: LocalIntervention; pending: number; conflict: boolean }) {
  const theme = useTheme();
  const finished = i.status === "DONE";
  return (
    <Link href={{ pathname: "/intervention/[id]", params: { id: i.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${formatTimeRange(i.scheduledStart, i.scheduledEnd)}, ${i.type}, ${i.site.customer.name}, ${i.site.city}`}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: theme.surface, borderColor: conflict ? theme.danger : theme.border, opacity: pressed ? 0.85 : finished ? 0.7 : 1 },
        ]}
      >
        <View style={styles.cardTop}>
          <Text style={[styles.time, { color: theme.foreground }]}>{formatTimeRange(i.scheduledStart, i.scheduledEnd)}</Text>
          <StatusBadge status={i.status} />
        </View>
        <Text style={[styles.type, { color: theme.foreground }]}>{i.type}</Text>
        <Text style={[styles.place, { color: theme.muted }]}>
          {i.site.customer.name} · {i.site.address}, {i.site.city}
        </Text>
        {(i.priority === "URGENT" || i.priority === "HIGH" || pending > 0 || conflict) && (
          <View style={styles.tags}>
            {(i.priority === "URGENT" || i.priority === "HIGH") && (
              <Text style={[styles.tag, { color: theme.danger, backgroundColor: theme.dangerSoft }]}>
                {i.priority === "URGENT" ? "Urgente" : "Prioritaire"}
              </Text>
            )}
            {pending > 0 && (
              <Text style={[styles.tag, { color: theme.foreground, backgroundColor: theme.surfaceMuted }]}>
                {pending} en attente d&apos;envoi
              </Text>
            )}
            {conflict && <Text style={[styles.tag, { color: theme.danger, backgroundColor: theme.dangerSoft }]}>Modifiée par le bureau</Text>}
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12, maxWidth: 720, width: "100%", alignSelf: "center" },
  header: { gap: 6, marginBottom: 8 },
  hello: { fontSize: 28, fontWeight: "700" },
  date: { fontSize: 16, marginBottom: 6 },
  headerAction: { fontSize: 16, fontWeight: "600", paddingHorizontal: 12, paddingVertical: 8 },
  card: { borderWidth: 1, borderRadius: RADIUS, padding: 16, gap: 6 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  time: { fontSize: 18, fontWeight: "700", fontVariant: ["tabular-nums"] },
  type: { fontSize: 17, fontWeight: "600" },
  place: { fontSize: 15 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tag: { fontSize: 13, fontWeight: "600", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden" },
});
