import React from "react";
import { Pressable, Text, View } from "react-native";

import { api } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/theme";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    api
      .post("/monitoring/client-errors", {
        message: String(error?.message ?? "unknown").slice(0, 2000),
        stack: String(info?.componentStack ?? "").slice(0, 4000),
        source: "error_boundary",
      })
      .catch(() => {});
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", textAlign: "center" }}>Something went wrong</Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: "center" }}>
            Give it another try. If it keeps happening, restart the app.
          </Text>
          <Pressable
            onPress={this.reset}
            style={{ backgroundColor: colors.surfaceActive, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm }}
          >
            <Text style={{ color: colors.text, fontWeight: "600" }}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
