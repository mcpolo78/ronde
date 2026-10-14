import { formatLongDay, formatTime, formatTimeRange, type InterventionStatus } from "@ronde/domain";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SyncStatus } from "../../../components/sync-status";
import { Button, Card, SectionTitle, StatusBadge } from "../../../components/ui";
import { fileSource } from "../../../lib/api";
import { useDay, useSync } from "../../../sync/store";
import { RADIUS, TOUCH, useTheme } from "../../../theme";

const NEXT_ACTION: Partial<Record<InterventionStatus, { to: InterventionStatus; label: string }>> = {
  PLANNED: { to: "EN_ROUTE", label: "Je pars" },
  EN_ROUTE: { to: "ON_SITE", label: "Je suis arrivé" },
  ON_SITE: { to: "DONE", label: "Clôturer l'intervention" },
};

export default function InterventionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const intervention = useDay().find((i) => i.id === id);
  const pending = useSync((s) => s.queue.filter((o) => o.interventionId === id).length);
  const conflict = useSync((s) => s.conflicts[id]);
  const { changeStatus, enqueue, addPhoto, dismissConflict } = useSync.getState();
  // brouillon local : null tant que le technicien n'a rien modifié (on affiche alors la valeur enregistrée)
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!intervention) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.muted, fontSize: 16 }}>Intervention introuvable.</Text>
      </View>
    );
  }
  const i = intervention;
  const report = draft ?? i.report ?? "";
  const onSite = i.status === "ON_SITE";
  const editable = onSite || i.status === "DONE";
  const next = NEXT_ACTION[i.status];
  const needsSignature = i.status === "ON_SITE" && !i.signature;

  function advance() {
    if (!next) return;
    const result = changeStatus(i.id, next.to);
    setMessage(result.ok ? null : result.reason === "MISSING_SIGNATURE" ? "Faites d'abord signer le client." : "Action impossible.");
  }

  async function takePhoto(source: "camera" | "library") {
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1 };
    if (source === "camera" && Platform.OS !== "web") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return setMessage("Autorisez l'appareil photo dans les réglages du téléphone.");
    }
    const result =
      source === "camera" && Platform.OS !== "web"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets[0]) await addPhoto(i.id, result.assets[0].uri);
  }

  const openDirections = () =>
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${i.site.latitude},${i.site.longitude}`);

  return (
    <>
      <Stack.Screen options={{ title: i.reference }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {conflict && (
          <View role="alert" style={[styles.banner, { backgroundColor: theme.dangerSoft, borderColor: theme.danger }]}>
            <Text style={{ color: theme.danger, fontSize: 15, flex: 1 }}>{conflict}</Text>
            <Text accessibilityRole="button" onPress={() => dismissConflict(i.id)} style={{ color: theme.danger, fontWeight: "700", padding: 4 }}>
              OK
            </Text>
          </View>
        )}

        <View style={styles.header}>
          <StatusBadge status={i.status} />
          <Text accessibilityRole="header" style={[styles.title, { color: theme.foreground }]}>
            {i.type}
          </Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            {capitalize(formatLongDay(i.scheduledStart))} · {formatTimeRange(i.scheduledStart, i.scheduledEnd)}
          </Text>
          {pending > 0 && (
            <Text style={{ color: theme.muted, fontSize: 14 }}>
              {pending} action{pending > 1 ? "s" : ""} en attente d&apos;envoi — elles partiront dès que le réseau revient.
            </Text>
          )}
          <SyncStatus />
        </View>

        {next && !(needsSignature && next.to === "DONE") && (
          <Button testID="main-action" label={next.label} onPress={advance} />
        )}
        {needsSignature && (
          <Button
            testID="main-action"
            label="Faire signer le client"
            onPress={() => router.push({ pathname: "/intervention/[id]/sign", params: { id: i.id } })}
          />
        )}
        {i.status === "DONE" && (
          <Text style={[styles.doneText, { color: theme.status.DONE.fg, backgroundColor: theme.status.DONE.bg }]}>
            Intervention terminée{i.signature ? ` · signée par ${i.signature.signerName}` : ""}
          </Text>
        )}
        {i.status === "CANCELLED" && (
          <Text style={[styles.doneText, { color: theme.status.CANCELLED.fg, backgroundColor: theme.status.CANCELLED.bg }]}>
            Intervention annulée par le bureau
          </Text>
        )}
        {message && (
          <Text role="alert" style={{ color: theme.danger, fontSize: 15 }}>
            {message}
          </Text>
        )}

        <SectionTitle>Client</SectionTitle>
        <Card>
          <Text style={[styles.strong, { color: theme.foreground }]}>{i.site.customer.name}</Text>
          <Text style={{ color: theme.foreground, fontSize: 16 }}>
            {i.site.address}, {i.site.postalCode} {i.site.city}
          </Text>
          {i.site.accessNotes && (
            <Text style={[styles.note, { backgroundColor: theme.surfaceMuted, color: theme.foreground }]}>Accès : {i.site.accessNotes}</Text>
          )}
          <View style={styles.row}>
            <Button label="Itinéraire" variant="secondary" onPress={openDirections} style={{ flex: 1 }} />
            {i.site.customer.phone && (
              <Button
                label="Appeler"
                variant="secondary"
                onPress={() => Linking.openURL(`tel:${i.site.customer.phone!.replace(/\s/g, "")}`)}
                style={{ flex: 1 }}
              />
            )}
          </View>
        </Card>

        {i.description && (
          <>
            <SectionTitle>Demande</SectionTitle>
            <Card>
              <Text style={{ color: theme.foreground, fontSize: 16 }}>{i.description}</Text>
            </Card>
          </>
        )}

        {i.checklist.length > 0 && (
          <>
            <SectionTitle>Checklist</SectionTitle>
            <Card style={{ gap: 0, paddingVertical: 4 }}>
              {i.checklist.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.checked, disabled: !onSite }}
                  disabled={!onSite}
                  onPress={() => enqueue({ kind: "checklist", interventionId: i.id, itemId: item.id, checked: !item.checked })}
                  style={styles.checkRow}
                >
                  <Text style={{ color: theme.foreground, fontSize: 16, flex: 1 }}>{item.label}</Text>
                  <Switch
                    value={item.checked}
                    disabled={!onSite}
                    onValueChange={(checked) => enqueue({ kind: "checklist", interventionId: i.id, itemId: item.id, checked })}
                    accessibilityLabel={item.label}
                    trackColor={{ true: theme.brand }}
                  />
                </Pressable>
              ))}
            </Card>
          </>
        )}

        <SectionTitle>Photos ({i.photos.length})</SectionTitle>
        {i.photos.length > 0 && (
          <View style={styles.photos}>
            {i.photos.map((photo) => (
              <RemotePhoto key={photo.id} url={photo.url} pending={photo.pending} />
            ))}
          </View>
        )}
        {editable && (
          <View style={styles.row}>
            <Button label="Prendre une photo" variant="secondary" onPress={() => void takePhoto("camera")} style={{ flex: 1 }} />
            {Platform.OS !== "web" && (
              <Button label="Galerie" variant="secondary" onPress={() => void takePhoto("library")} style={{ flex: 1 }} />
            )}
          </View>
        )}

        {editable && (
          <>
            <SectionTitle>Compte rendu</SectionTitle>
            <TextInput
              aria-label="Compte rendu"
              accessibilityLabel="Compte rendu"
              value={report}
              onChangeText={setDraft}
              multiline
              placeholder="Travaux réalisés, pièces changées, recommandations…"
              placeholderTextColor={theme.muted}
              style={[styles.report, { borderColor: theme.border, backgroundColor: theme.surface, color: theme.foreground }]}
            />
            <Button
              label="Enregistrer le compte rendu"
              variant="secondary"
              disabled={report.trim() === (i.report ?? "").trim()}
              onPress={() => {
                enqueue({ kind: "report", interventionId: i.id, report });
                setDraft(null);
              }}
            />
          </>
        )}

        {i.signature && (
          <Text style={{ color: theme.muted, fontSize: 14, marginTop: 8 }}>
            Signé par {i.signature.signerName} à {formatTime(i.signature.signedAt)}
            {i.signature.pending ? " · en attente d'envoi" : ""}
          </Text>
        )}
      </ScrollView>
    </>
  );
}

function RemotePhoto({ url, pending }: { url: string; pending?: boolean }) {
  const theme = useTheme();
  const [source, setSource] = useState<{ uri: string; headers?: Record<string, string> } | null>(null);
  useEffect(() => {
    void fileSource(url).then(setSource);
  }, [url]);
  return (
    <View style={[styles.photo, { borderColor: theme.border }]}>
      {source && <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Photo d'intervention" />}
      {pending && <Text style={[styles.photoBadge, { backgroundColor: theme.warningSoft, color: theme.warning }]}>En attente</Text>}
    </View>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 12, maxWidth: 720, width: "100%", alignSelf: "center", paddingBottom: 48 },
  banner: { flexDirection: "row", gap: 8, alignItems: "center", borderWidth: 1, borderRadius: RADIUS, padding: 12 },
  header: { gap: 6 },
  title: { fontSize: 24, fontWeight: "700" },
  subtitle: { fontSize: 16 },
  doneText: { fontSize: 16, fontWeight: "600", borderRadius: RADIUS, padding: 14, overflow: "hidden", textAlign: "center" },
  strong: { fontSize: 17, fontWeight: "600" },
  note: { fontSize: 15, borderRadius: 8, padding: 10, overflow: "hidden" },
  row: { flexDirection: "row", gap: 10 },
  checkRow: { minHeight: TOUCH, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photo: { width: 104, height: 104, borderRadius: 10, overflow: "hidden", borderWidth: 1 },
  photoBadge: { position: "absolute", bottom: 4, left: 4, fontSize: 11, fontWeight: "700", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, overflow: "hidden" },
  report: { minHeight: 120, borderWidth: 1, borderRadius: RADIUS, padding: 12, fontSize: 16, textAlignVertical: "top" },
});
