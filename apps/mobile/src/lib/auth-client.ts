import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { API_URL } from "./config";

/**
 * Sur téléphone, le cookie de session est conservé dans le stockage sécurisé du système
 * (Keychain / Keystore) et envoyé dans un en-tête par le plugin Expo.
 * Sur le web (développement et tests), le navigateur gère le cookie lui-même.
 */
const webStorage = {
  getItem: (key: string) => globalThis.localStorage?.getItem(key) ?? null,
  getItemAsync: async (key: string) => globalThis.localStorage?.getItem(key) ?? null,
  setItem: (key: string, value: string) => globalThis.localStorage?.setItem(key, value),
  setItemAsync: async (key: string, value: string) => globalThis.localStorage?.setItem(key, value),
};

export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: Platform.OS === "web" ? { credentials: "include" } : undefined,
  plugins: [
    expoClient({
      scheme: "ronde",
      storagePrefix: "ronde",
      storage: Platform.OS === "web" ? webStorage : SecureStore,
    }),
  ],
});
