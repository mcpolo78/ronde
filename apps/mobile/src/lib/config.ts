import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * URL de l'API.
 * - `EXPO_PUBLIC_API_URL` si elle est définie (build de production, démo) ;
 * - sinon en développement : la machine qui sert le bundle Expo, port 4000
 *   (fonctionne tel quel avec Expo Go sur un téléphone du même réseau Wi-Fi).
 */
function resolveApiUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (Platform.OS === "web") return "http://localhost:4000";
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return `http://${host ?? "localhost"}:4000`;
}

export const API_URL = resolveApiUrl();
