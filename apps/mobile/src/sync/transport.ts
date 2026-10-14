import { ApiError, gql, NetworkError, uploadFile } from "../lib/api";
import {
  AddPhotoMutation,
  ChangeStatusMutation,
  SaveReportMutation,
  SignMutation,
  ToggleChecklistMutation,
} from "../lib/queries";
import type { Op, SendResult } from "./engine";
import { discardLocalPhoto } from "./photos";

/** Envoie une opération de la file au serveur. */
export async function send(op: Op): Promise<SendResult> {
  try {
    switch (op.kind) {
      case "status":
        await gql(ChangeStatusMutation, {
          input: { interventionId: op.interventionId, status: op.status, at: op.at, clientId: op.id },
        });
        break;
      case "checklist":
        await gql(ToggleChecklistMutation, { id: op.itemId, checked: op.checked });
        break;
      case "photo": {
        // deux étapes, toutes deux idempotentes grâce à op.id : un rejeu ne crée pas de doublon
        const file = await uploadFile(op.localUri, op.id);
        await gql(AddPhotoMutation, {
          input: {
            interventionId: op.interventionId,
            clientId: op.id,
            fileId: file.id,
            caption: op.caption,
            takenAt: op.takenAt,
          },
        });
        discardLocalPhoto(op.localUri);
        break;
      }
      case "signature":
        await gql(SignMutation, {
          input: {
            interventionId: op.interventionId,
            signerName: op.signerName,
            signedAt: op.signedAt,
            width: op.width,
            height: op.height,
            strokes: op.strokes.map((points) => ({ points })),
          },
        });
        break;
      case "report":
        await gql(SaveReportMutation, { interventionId: op.interventionId, report: op.report });
        break;
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof NetworkError) return { ok: false, retry: true };
    // session expirée : on garde l'opération, elle repartira après reconnexion
    if (error instanceof ApiError && error.code === "UNAUTHENTICATED") return { ok: false, retry: true };
    if (error instanceof ApiError) return { ok: false, retry: false, code: error.code, message: error.message };
    return { ok: false, retry: true };
  }
}
