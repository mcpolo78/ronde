# 0003 — Mobile offline-first : mutations idempotentes

- **Statut** : acceptée côté API (S1), implémentation mobile en S3
- **Date** : 2026-10-14

## Contexte

Les techniciens travaillent souvent sans réseau (chaufferies, sous-sols). Ils doivent pouvoir changer le statut d'une intervention, cocher la checklist, prendre des photos et faire signer le client, puis tout resynchroniser plus tard, éventuellement en plusieurs tentatives.

## Décision

1. **Préchargement** : la requête `myDay` renvoie la journée complète du technicien, conservée dans un cache persistant sur le téléphone.
2. **File d'attente locale** : sans réseau, les mutations sont mises en file d'attente et l'interface est mise à jour immédiatement (mise à jour optimiste), avec les mêmes règles que le serveur (`packages/domain`).
3. **Idempotence** : chaque mutation porte un `clientId` (UUID généré sur le téléphone), unique en base (`StatusEvent.clientId`, `Photo.clientId`). Une mutation rejouée après une coupure renvoie l'état courant sans créer de doublon.
4. **Horodatage réel** : la mutation envoie l'heure de l'action (`at`), pas l'heure de synchronisation ; les indicateurs (retard, durée sur site) restent justes.
5. **Conflits** : le serveur revalide chaque transition. Si elle n'est plus possible (par exemple, intervention annulée par le planning pendant que le technicien était hors ligne), il renvoie le code d'erreur et l'état courant ; l'app retire la modification optimiste et affiche un bandeau explicatif.

## Conséquences

- ✅ Aucune donnée saisie sur le terrain n'est perdue, et une synchronisation répétée ne crée pas de doublons (vérifié : la même mutation `changeStatus` envoyée deux fois ne crée qu'un événement).
- ✅ Pas de moteur de synchronisation lourd (CRDT, base locale répliquée) : le périmètre modifiable hors ligne est petit et bien délimité.
- ⚠️ Modifications concurrentes sur un même champ : la dernière écriture l'emporte, sauf annulation par le planning, qui est prioritaire. Acceptable car un technicien est le seul à modifier « ses » interventions pendant qu'il est sur site.
- ⚠️ Les photos peuvent être volumineuses : elles sont envoyées en arrière-plan après les mutations de statut, pour que le planning soit à jour au plus vite.
