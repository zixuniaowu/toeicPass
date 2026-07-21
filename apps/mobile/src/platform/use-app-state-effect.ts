import { AppState, type AppStateStatus } from "react-native";
import { useEffect, useRef } from "react";

type UseAppStateEffectParams = {
  enabled?: boolean;
  onActive?: () => void | Promise<void>;
  onInactive?: () => void | Promise<void>;
};

function isInactiveState(status: AppStateStatus) {
  return status === "inactive" || status === "background";
}

export function useAppStateEffect(params: UseAppStateEffectParams) {
  const { enabled = true, onActive, onInactive } = params;
  const lastStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!enabled) {
      lastStateRef.current = AppState.currentState;
      return;
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = lastStateRef.current;
      lastStateRef.current = nextState;

      if (previousState !== "active" && nextState === "active") {
        if (onActive) {
          void onActive();
        }
        return;
      }

      if (previousState === "active" && isInactiveState(nextState)) {
        if (onInactive) {
          void onInactive();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, onActive, onInactive]);
}
