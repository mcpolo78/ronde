# 0005 — App technicien : choix techniques

- **Statut** : acceptée
- **Date** : 2026-10-14

## Synchronisation : une file écrite à la main plutôt qu'une bibliothèque

**Options** : cache GraphQL avec mode hors ligne (urql/graphcache), base locale synchronisée (WatermelonDB, PowerSync…), ou une petite file d'opérations.

**Choix** : la file (≈ 150 lignes, voir [0003](0003-offline-first-mobile.md)). Le périmètre modifiable hors ligne est petit et bien délimité (statut, checklist, photo, signature, compte rendu) ; une file explicite rend le comportement prévisible, testable unitairement et facile à expliquer à un client (« rien n'est perdu, tout part dans l'ordre, rien n'est appliqué deux fois »). Une base synchronisée deviendrait pertinente si les techniciens créaient eux-mêmes des données riches hors ligne.

## Signature : tracés, pas d'image

La signature est dessinée en SVG natif (react-native-svg + PanResponder, pas de WebView). Le mobile envoie **des coordonnées numériques** ; le serveur les valide (Zod) et **construit lui-même le SVG**. Un SVG fourni par un client pourrait contenir du script et serait servi depuis le domaine du back-office : ce risque d'injection est supprimé par construction. Les fichiers sont en plus servis avec `Content-Security-Policy: sandbox` et `nosniff`.

## Fichiers : stockage en base derrière une interface

Photos et signatures sont stockées dans PostgreSQL (`StoredFile`) derrière une interface `FileStore`. Suffisant pour une démo (photos compressées à ≈ 200 Ko) et sans service tiers ; passer à un stockage objet (S3, R2) ne touche que l'implémentation de l'interface. Le type réel des images est vérifié d'après leur signature binaire (JPEG/PNG), jamais d'après l'en-tête déclaré.

## Authentification : plugin Expo de Better Auth

Même serveur d'authentification que le back-office. Sur téléphone, le cookie de session est conservé dans le stockage sécurisé du système (Keychain / Keystore) et envoyé en en-tête. Un technicien qui se reconnecte garde ses actions en attente ; si un **autre** technicien se connecte sur l'appareil, les données locales sont effacées.

## Tests : l'app tourne aussi sur le web

Expo Router + react-native-web permettent d'exécuter l'app dans un navigateur. Les tests E2E Playwright l'utilisent pour piloter de vrais parcours et **couper le réseau** (`context.setOffline`) — impossible à reproduire de façon fiable avec un émulateur en CI. Les parties propres au natif (appareil photo, stockage sécurisé, fichiers) ont un équivalent web derrière les mêmes fonctions.

## Base locale de développement

PostgreSQL 17 embarqué (paquet npm `embedded-postgres`, binaires officiels) lancé par `pnpm db:dev` : un vrai serveur, sans Docker. Il remplace `prisma dev`, dont le module de réplication, téléchargé automatiquement en dernière version, s'est mis à planter en cours de projet — un outil de développement ne doit pas changer sous nos pieds.

## Interface

Zones tactiles de 54 px minimum, textes de 15 à 17 px, contrastes forts : l'app est utilisée debout, parfois avec des gants ou en plein soleil. Mêmes tokens de couleur que le back-office (mode clair et sombre). Un indicateur de synchronisation est toujours visible : le technicien doit savoir, avant de partir, que son travail est arrivé au bureau.
