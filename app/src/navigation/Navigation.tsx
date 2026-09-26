import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type Route =
  | { name: 'welcome' }
  | { name: 'stakeSetup' }
  | { name: 'alarmSetup' }
  | { name: 'beneficiary'; mode: 'onboarding' | 'manage' }
  | { name: 'questionnaire'; mode: 'onboarding' | 'manage' }
  | { name: 'wakeQr'; mode: 'onboarding' | 'manage' }
  | { name: 'dashboard' }
  | { name: 'settings' }
  | { name: 'alarm' }
  | { name: 'scanWake' }
  | { name: 'snoozed' }
  | { name: 'reveal' }
  | { name: 'penalty'; eventId: string }
  | { name: 'receipt'; eventId: string }
  | { name: 'shame'; eventId: string }
  | { name: 'woke'; lost: number; snoozes: number };

interface NavValue {
  route: Route;
  navigate: (route: Route) => void;
  /** Replace the whole stack (e.g. returning home after a flow). */
  reset: (route: Route) => void;
  back: () => void;
}

const NavContext = createContext<NavValue | null>(null);

/** Tiny stack navigator — enough for a prototype, easy to swap for a real router later. */
export function NavigationProvider({ initial, children }: { initial: Route; children: ReactNode }) {
  const [stack, setStack] = useState<Route[]>([initial]);

  const navigate = useCallback((route: Route) => {
    setStack((s) => [...s, route]);
  }, []);
  const reset = useCallback((route: Route) => {
    setStack([route]);
  }, []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);

  const value = useMemo<NavValue>(
    () => ({ route: stack[stack.length - 1] ?? initial, navigate, reset, back }),
    [stack, initial, navigate, reset, back],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNavigation(): NavValue {
  const value = useContext(NavContext);
  if (!value) throw new Error('useNavigation() must be used inside <NavigationProvider>');
  return value;
}
