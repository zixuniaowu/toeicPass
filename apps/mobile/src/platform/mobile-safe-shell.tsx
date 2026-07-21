import { StatusBar as ExpoStatusBar, type StatusBarStyle } from "expo-status-bar";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar as NativeStatusBar,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../ui";

export const MOBILE_APP_BACKGROUND = "#f4efe6";
export const MOBILE_SURFACE_BACKGROUND = "#fffaf3";
export const MOBILE_BORDER_COLOR = "#eadfce";
export const MOBILE_ACCENT = "#c84f2d";
export const MOBILE_TEXT = "#10212b";

export function MobileSafeAreaProvider(props: { children: ReactNode }) {
  return <SafeAreaProvider>{props.children}</SafeAreaProvider>;
}

export function MobileStatusBar(props?: { style?: StatusBarStyle }) {
  const style = props?.style ?? "dark";
  const nativeBarStyle = style === "light" ? "light-content" : "dark-content";

  return (
    <>
      {Platform.OS === "android" ? (
        <NativeStatusBar backgroundColor={MOBILE_APP_BACKGROUND} barStyle={nativeBarStyle} />
      ) : null}
      <ExpoStatusBar animated style={style} />
    </>
  );
}

export function MobileScreenShell(props: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {props.children}
    </SafeAreaView>
  );
}

export function MobileCenteredShell(props: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.center} edges={["top", "right", "bottom", "left"]}>
      {props.children}
    </SafeAreaView>
  );
}

export function MobileKeyboardPane(props: { children: ReactNode; keyboardVerticalOffset?: number }) {
  const { children, keyboardVerticalOffset = 0 } = props;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

export function MobileScrollPane(props: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  includeBottomInset?: boolean;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
}) {
  const {
    children,
    contentContainerStyle,
    includeBottomInset = true,
    onRefresh,
    refreshing = false,
  } = props;
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: 40 + (includeBottomInset ? insets.bottom : 0) },
        contentContainerStyle,
      ]}
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            onRefresh={() => {
              void onRefresh();
            }}
            refreshing={refreshing}
            tintColor={MOBILE_ACCENT}
            colors={[MOBILE_ACCENT]}
            progressBackgroundColor={MOBILE_SURFACE_BACKGROUND}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}
