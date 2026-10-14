import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";

/**
 * Prépare une photo prise sur le terrain : redimensionnée et compressée (≈ 200 Ko au lieu de
 * plusieurs Mo, l'envoi passe même en 3G), puis copiée dans le stockage durable de l'app pour
 * survivre à un redémarrage tant qu'elle n'est pas synchronisée.
 */
export async function preparePhoto(sourceUri: string, id: string): Promise<string> {
  const image = await ImageManipulator.manipulate(sourceUri).resize({ width: 1600 }).renderAsync();
  const result = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  if (Platform.OS === "web") return result.uri;

  const directory = new Directory(Paths.document, "photos");
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  const destination = new File(directory, `${id}.jpg`);
  new File(result.uri).copy(destination);
  return destination.uri;
}

/** Supprime la copie locale une fois la photo envoyée. */
export function discardLocalPhoto(uri: string) {
  if (Platform.OS === "web" || !uri.startsWith("file:")) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // sans gravité : le fichier sera écrasé ou nettoyé plus tard
  }
}
