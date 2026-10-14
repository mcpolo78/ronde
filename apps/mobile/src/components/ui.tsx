import { STATUS_LABELS, type InterventionStatus } from "@ronde/domain";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { RADIUS, TOUCH, useTheme } from "../theme";

export function StatusBadge({ status }: { status: InterventionStatus }) {
  const theme = useTheme();
  const { fg, bg } = theme.status[status];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: fg }]} />
      <Text style={[styles.badgeText, { color: fg }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
  accessibilityHint,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  accessibilityHint?: string;
  style?: ViewStyle;
  testID?: string;
}) {
  const theme = useTheme();
  const colors = {
    primary: { bg: theme.brand, fg: theme.brandForeground, border: theme.brand },
    secondary: { bg: theme.surface, fg: theme.foreground, border: theme.border },
    danger: { bg: theme.dangerSoft, fg: theme.danger, border: theme.danger },
  }[variant];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.bg, borderColor: colors.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.fg} /> : icon}
      <Text style={[styles.buttonText, { color: colors.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.muted }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 13, fontWeight: "600" },
  button: {
    minHeight: TOUCH,
    borderRadius: RADIUS,
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: { fontSize: 17, fontWeight: "600" },
  card: { borderRadius: RADIUS, borderWidth: 1, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 8 },
});
