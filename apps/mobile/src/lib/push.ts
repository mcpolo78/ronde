import { graphql } from "@ronde/graphql";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { gql } from "./api";

const RegisterPushToken = graphql(`
  mutation RegisterPushToken($token: String!, $platform: String!) {
    registerPushToken(token: $token, platform: $platform)
  }
`);

const UnregisterPushToken = graphql(`
  mutation UnregisterPushToken($token: String!) {
    unregisterPushToken(token: $token)
  }
`);

let registeredToken: string | null = null;

// Notification reçue app ouverte : on l'affiche quand même (bandeau + son)
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Inscrit l'appareil aux notifications (nouvelle intervention, replanification, annulation).
 * Ne fait rien sur le web, sur simulateur, sans projet EAS ou si le technicien refuse :
 * l'app reste pleinement utilisable, la synchronisation suffit.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === "web" || !Device.isDevice) return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("interventions", {
      name: "Interventions",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await gql(RegisterPushToken, { token, platform: Platform.OS });
  registeredToken = token;
  return token;
}

/** À la déconnexion : l'appareil ne doit plus recevoir les notifications de ce technicien. */
export async function unregisterPushNotifications() {
  if (!registeredToken) return;
  await gql(UnregisterPushToken, { token: registeredToken }).catch(() => {});
  registeredToken = null;
}
