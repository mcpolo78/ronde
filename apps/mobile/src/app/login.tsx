import Head from "expo-router/head";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/ui";
import { authClient } from "../lib/auth-client";
import { useSync } from "../sync/store";
import { RADIUS, TOUCH, useTheme } from "../theme";

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email ou mot de passe incorrect.",
};

export default function LoginScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState("karim@ronde.demo");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    setLoading(true);
    const { data, error } = await authClient.signIn.email({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setError(MESSAGES[error.code ?? ""] ?? "Connexion impossible. Vérifiez votre réseau.");
      return;
    }
    // Appareil partagé : les données d'un autre technicien ne doivent pas rester visibles.
    // Le même technicien qui se reconnecte garde ses actions en attente.
    const previous = useSync.getState().technicianId;
    if (previous && previous !== data.user.id) useSync.getState().reset();
  }

  const input = [styles.input, { borderColor: theme.border, backgroundColor: theme.surface, color: theme.foreground }];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* titre de l'onglet sur le web (cet écran n'a pas d'en-tête) */}
      <Head>
        <title>Connexion — Ronde</title>
      </Head>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <Text style={[styles.logo, { color: theme.foreground }]}>
          <Text style={{ color: theme.brand }}>● </Text>Ronde
        </Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Application technicien</Text>

        <View style={styles.form}>
          <Text style={[styles.label, { color: theme.foreground }]} nativeID="email-label">
            Email
          </Text>
          <TextInput
            accessibilityLabelledBy="email-label"
            aria-label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            style={input}
          />
          <Text style={[styles.label, { color: theme.foreground }]} nativeID="password-label">
            Mot de passe
          </Text>
          <TextInput
            accessibilityLabelledBy="password-label"
            aria-label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={submit}
            style={input}
          />
          {error && (
            <Text accessibilityLiveRegion="assertive" role="alert" style={[styles.error, { color: theme.danger }]}>
              {error}
            </Text>
          )}
          <Button label="Se connecter" onPress={submit} loading={loading} disabled={!email || !password} />
        </View>

        <Text style={[styles.demo, { color: theme.muted }]}>
          Démo : karim@ronde.demo · mot de passe demo-ronde
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 8, maxWidth: 480, width: "100%", alignSelf: "center" },
  logo: { fontSize: 34, fontWeight: "700", textAlign: "center" },
  subtitle: { fontSize: 16, textAlign: "center", marginBottom: 24 },
  form: { gap: 8 },
  label: { fontSize: 15, fontWeight: "600", marginTop: 8 },
  input: { minHeight: TOUCH, borderWidth: 1, borderRadius: RADIUS, paddingHorizontal: 14, fontSize: 17 },
  error: { fontSize: 15, marginVertical: 4 },
  demo: { textAlign: "center", marginTop: 24, fontSize: 14 },
});
