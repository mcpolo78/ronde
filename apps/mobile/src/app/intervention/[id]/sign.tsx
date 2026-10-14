import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { SignaturePad, type SignatureValue } from "../../../components/signature-pad";
import { Button } from "../../../components/ui";
import { useDay, useSync } from "../../../sync/store";
import { RADIUS, TOUCH, useTheme } from "../../../theme";

export default function SignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const intervention = useDay().find((i) => i.id === id);
  const enqueue = useSync((s) => s.enqueue);
  const [signerName, setSignerName] = useState(intervention?.site.customer.name ?? "");
  const [signature, setSignature] = useState<SignatureValue | null>(null);

  const valid = signature && signerName.trim().length >= 2;

  function confirm() {
    if (!valid || !intervention) return;
    enqueue({
      kind: "signature",
      interventionId: intervention.id,
      signerName: signerName.trim(),
      signedAt: new Date().toISOString(),
      ...signature,
    });
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.intro, { color: theme.foreground }]}>
        Le client confirme la réalisation de l&apos;intervention {intervention?.reference} en signant ci-dessous.
      </Text>
      <Text style={[styles.label, { color: theme.foreground }]}>Nom du signataire</Text>
      <TextInput
        aria-label="Nom du signataire"
        accessibilityLabel="Nom du signataire"
        value={signerName}
        onChangeText={setSignerName}
        autoCapitalize="words"
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surface, color: theme.foreground }]}
      />
      <Text style={[styles.label, { color: theme.foreground }]}>Signature</Text>
      <SignaturePad onChange={setSignature} />
      <Button testID="confirm-signature" label="Valider la signature" onPress={confirm} disabled={!valid} />
      <Button label="Annuler" variant="secondary" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10, maxWidth: 720, width: "100%", alignSelf: "center" },
  intro: { fontSize: 16, marginBottom: 8 },
  label: { fontSize: 15, fontWeight: "600", marginTop: 4 },
  input: { minHeight: TOUCH, borderWidth: 1, borderRadius: RADIUS, paddingHorizontal: 14, fontSize: 17 },
});
