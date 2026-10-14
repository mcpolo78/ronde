import { nextStatuses, STATUS_LABELS } from '@ronde/domain';
import { StyleSheet, Text, View } from 'react-native';

// Écran provisoire (S1) : vérifie que l'app consomme bien la logique métier partagée.
// Remplacé en S3 par la liste des interventions du jour (requête `myDay`).
export default function MyDayScreen() {
  const next = nextStatuses('PLANNED', 'TECHNICIAN').map((s) => STATUS_LABELS[s]);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ronde</Text>
      <Text style={styles.body}>App technicien — en construction.</Text>
      <Text style={styles.muted}>Depuis « Planifiée », vous pourrez passer à : {next.join(', ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  title: { fontSize: 28, fontWeight: '700' },
  body: { fontSize: 16 },
  muted: { fontSize: 14, opacity: 0.6, textAlign: 'center' },
});
