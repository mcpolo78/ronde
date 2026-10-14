import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { useNetworkState } from "expo-network";
import { useEffect } from "react";
import { ActivityIndicator, AppState, useColorScheme, View } from "react-native";
import { authClient } from "../lib/auth-client";
import { useSync } from "../sync/store";
import { useTheme } from "../theme";

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = useTheme();
  const { data: session, isPending } = authClient.useSession();
  const signedIn = Boolean(session);

  if (isPending) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.background }}>
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }

  return (
    <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
      {signedIn && <AutoSync />}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.foreground,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="index" options={{ title: "Ma journée" }} />
          <Stack.Screen name="intervention/[id]/index" options={{ title: "Intervention" }} />
          <Stack.Screen
            name="intervention/[id]/sign"
            options={{ title: "Signature du client", presentation: "modal" }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ title: "Connexion — Ronde", headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

/**
 * Déclenche la synchronisation : à l'ouverture, au retour du réseau, au retour au premier plan,
 * et régulièrement tant que des actions sont en attente.
 */
function AutoSync() {
  const sync = useSync((s) => s.sync);
  const pending = useSync((s) => s.queue.length);
  const network = useNetworkState();
  const online = network.isConnected !== false && network.isInternetReachable !== false;

  useEffect(() => {
    if (online) void sync();
  }, [online, sync]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    return () => subscription.remove();
  }, [sync]);

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => void sync(), 20_000);
    return () => clearInterval(timer);
  }, [pending, sync]);

  return null;
}
