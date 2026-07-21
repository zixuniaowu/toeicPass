import type { ReactNode } from "react";
import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";

export function Section(props: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{props.title}</Text>
      {props.children}
    </View>
  );
}

export function MetricCard(props: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{props.value}</Text>
      <Text style={styles.metricLabel}>{props.label}</Text>
    </View>
  );
}

export function ListRow(props: { title: string; body: string }) {
  return (
    <View style={styles.listRow}>
      <Text style={styles.listTitle}>{props.title}</Text>
      <Text style={styles.listBody}>{props.body}</Text>
    </View>
  );
}

export function MutedText(props: { text: string }) {
  return <Text style={styles.muted}>{props.text}</Text>;
}

export function FormInput(props: TextInputProps) {
  return (
    <TextInput
      {...props}
      autoCorrect={props.autoCorrect ?? false}
      keyboardAppearance={props.keyboardAppearance ?? "light"}
      placeholderTextColor={props.placeholderTextColor ?? "#6f7e87"}
      selectionColor={props.selectionColor ?? "#c84f2d"}
      style={[styles.input, props.style]}
    />
  );
}

export function FormNoteInput(props: TextInputProps) {
  return (
    <TextInput
      {...props}
      autoCorrect={props.autoCorrect ?? true}
      keyboardAppearance={props.keyboardAppearance ?? "light"}
      multiline={props.multiline ?? true}
      placeholderTextColor={props.placeholderTextColor ?? "#6f7e87"}
      selectionColor={props.selectionColor ?? "#c84f2d"}
      style={[styles.noteInput, props.style]}
      textAlignVertical={props.textAlignVertical ?? "top"}
    />
  );
}

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f4efe6",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4efe6",
  },
  loginContainer: {
    padding: 24,
    gap: 18,
    justifyContent: "center",
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  brand: {
    fontSize: 26,
    fontWeight: "800",
    color: "#10212b",
  },
  subtitle: {
    marginTop: 4,
    color: "#5a6a73",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  tabRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  tabButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
  },
  tabButtonActive: {
    backgroundColor: "#10212b",
  },
  tabButtonText: {
    color: "#31424c",
    fontWeight: "600",
  },
  tabButtonTextActive: {
    color: "#ffffff",
  },
  stack: {
    gap: 14,
  },
  metricRow: {
    flexDirection: "row",
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 16,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#10212b",
  },
  metricLabel: {
    marginTop: 4,
    color: "#687983",
  },
  section: {
    marginBottom: 18,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#10212b",
  },
  panel: {
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: 20,
    gap: 12,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#10212b",
  },
  input: {
    borderRadius: 16,
    backgroundColor: "#f5f8fa",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#10212b",
  },
  primaryButton: {
    borderRadius: 16,
    backgroundColor: "#c84f2d",
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 14,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: "#10212b",
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonTextDisabled: {
    color: "#9aa8b2",
  },
  listRow: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 6,
  },
  listTitle: {
    color: "#10212b",
    fontWeight: "700",
  },
  listBody: {
    color: "#53636d",
    lineHeight: 20,
  },
  muted: {
    color: "#62727b",
    lineHeight: 22,
  },
  questionMeta: {
    color: "#6a7b84",
    fontWeight: "600",
  },
  questionStem: {
    fontSize: 18,
    lineHeight: 26,
    color: "#10212b",
    fontWeight: "700",
  },
  passage: {
    color: "#42545e",
    lineHeight: 22,
  },
  optionButton: {
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 14,
  },
  optionButtonActive: {
    borderWidth: 2,
    borderColor: "#c84f2d",
  },
  optionText: {
    color: "#10212b",
    lineHeight: 22,
  },
  card: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 8,
  },
  userCard: {
    borderWidth: 1,
    borderColor: "#d8c8b7",
  },
  assistantCard: {
    borderWidth: 1,
    borderColor: "#c84f2d",
    backgroundColor: "#fff7f2",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#10212b",
  },
  cardMeta: {
    color: "#7a8b94",
    fontWeight: "600",
  },
  cardBody: {
    color: "#53636d",
    lineHeight: 20,
  },
  shadowingSentence: {
    fontSize: 20,
    lineHeight: 30,
    color: "#10212b",
    fontWeight: "700",
  },
  label: {
    color: "#10212b",
    fontWeight: "700",
  },
  noteInput: {
    minHeight: 96,
    borderRadius: 16,
    backgroundColor: "#f5f8fa",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#10212b",
    textAlignVertical: "top",
  },
  inlineActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  fieldLabel: {
    color: "#42545e",
    fontWeight: "700",
  },
  apiBase: {
    color: "#53636d",
    lineHeight: 20,
  },
  compareTokenRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  compareToken: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "700",
  },
  compareTokenCorrect: {
    color: "#0f766e",
    backgroundColor: "#ccfbf1",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "700",
  },
  compareTokenWrong: {
    color: "#b91c1c",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "700",
  },
  compareTokenMissing: {
    color: "#475569",
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "700",
  },
});
