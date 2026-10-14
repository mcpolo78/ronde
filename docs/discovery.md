# Discovery

## Contexte

Une PME de maintenance de 8 à 30 techniciens en Île-de-France (entretien et dépannage de chaudières, pompes à chaleur, installation de bornes de recharge). Elle réalise 30 à 60 interventions par jour chez des particuliers, des syndics et des commerces.

## Personas

### Claire, responsable planning
- Répartit chaque jour une quarantaine d'interventions entre 8 techniciens.
- Travaille sur un tableur partagé et passe beaucoup de temps au téléphone pour savoir « où en est » chaque technicien.
- Doit répondre aux clients qui appellent pour connaître l'heure d'arrivée.

### Karim, technicien
- Enchaîne 3 à 4 interventions par jour, souvent en sous-sol ou en chaufferie, **sans réseau**.
- Remplit un bon d'intervention papier, fait signer le client, prend des photos avec son téléphone personnel.
- Ressaisit ses comptes rendus le soir ou le lendemain.

## Problèmes

1. **Planification lente et fragile** : le tableur ne montre ni les conflits de créneau ni la charge de chaque technicien.
2. **Aucune visibilité en temps réel** : Claire ne sait pas qui est en route, sur place ou en retard.
3. **Double saisie** : les bons papier sont ressaisis, avec des pertes et des erreurs ; le rapport arrive au client 1 à 2 jours plus tard.
4. **Pas de pilotage** : impossible de mesurer les retards, la durée réelle des interventions ou les retours chez un même client.

## Ce que fait Ronde (V1)

| Problème | Réponse |
|---|---|
| 1 | Planning semaine par technicien avec glisser-déposer |
| 2 | Statuts mis à jour depuis le mobile, visibles en direct sur le back-office |
| 3 | Photos, checklist et signature dans l'app ; fonctionne hors ligne et se resynchronise |
| 4 | Tableau de bord calculé à partir de l'historique horodaté des statuts |

## Indicateurs de succès

| Indicateur | Avant (estimé) | Objectif |
|---|---|---|
| Temps de planification quotidien | ~1 h 30 | < 30 min |
| Délai entre fin d'intervention et rapport client | J+1 à J+2 | immédiat |
| Appels « où en est le technicien ? » | ~15 / jour | < 3 / jour |
| Taux de résolution à la première visite | non mesuré | mesuré, puis +5 pts |

Les trois derniers sont calculés par l'application (voir `packages/domain/src/kpi.ts`).

## Hors périmètre V1

Facturation et devis, gestion multi-entreprises, stocks de pièces, géolocalisation en arrière-plan. Ces sujets apportent de la valeur mais ne sont pas nécessaires pour valider le gain principal : supprimer la double saisie et donner de la visibilité en temps réel.

## Hypothèses à valider

- Les techniciens acceptent d'utiliser l'app sur leur téléphone (ou un téléphone fourni).
- La signature sur écran est acceptée par les clients comme preuve de passage.
- Le dernier état connu suffit à résoudre les conflits de synchronisation dans la grande majorité des cas (voir [ADR 0003](adr/0003-offline-first-mobile.md)).
