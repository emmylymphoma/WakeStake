import { useMemo } from 'react';
import { NavigationProvider, useNavigation, type Route } from './navigation/Navigation';
import { AlarmScreen } from './screens/AlarmScreen';
import { AlarmSetupScreen } from './screens/AlarmSetupScreen';
import { BeneficiaryScreen } from './screens/BeneficiaryScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { PenaltyScreen } from './screens/PenaltyScreen';
import { QuestionnaireScreen } from './screens/QuestionnaireScreen';
import { ReceiptScreen } from './screens/ReceiptScreen';
import { RevealScreen } from './screens/RevealScreen';
import { ScanWakeScreen } from './screens/ScanWakeScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ShamePostScreen } from './screens/ShamePostScreen';
import { SnoozedScreen } from './screens/SnoozedScreen';
import { StakeSetupScreen } from './screens/StakeSetupScreen';
import { WakeQrScreen } from './screens/WakeQrScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { WokeScreen } from './screens/WokeScreen';
import { createMockServices } from './services/createServices';
import { ServiceProvider } from './services/ServiceContext';
import type { Services } from './services/types';
import { AppStateProvider, useAppState } from './state/AppStateContext';

function Router() {
  const { route } = useNavigation();
  switch (route.name) {
    case 'welcome':
      return <WelcomeScreen />;
    case 'stakeSetup':
      return <StakeSetupScreen />;
    case 'alarmSetup':
      return <AlarmSetupScreen />;
    case 'beneficiary':
      return <BeneficiaryScreen mode={route.mode} />;
    case 'questionnaire':
      return <QuestionnaireScreen mode={route.mode} />;
    case 'wakeQr':
      return <WakeQrScreen mode={route.mode} />;
    case 'dashboard':
      return <DashboardScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'alarm':
      return <AlarmScreen />;
    case 'scanWake':
      return <ScanWakeScreen />;
    case 'reveal':
      return <RevealScreen />;
    case 'snoozed':
      return <SnoozedScreen />;
    case 'penalty':
      return <PenaltyScreen key={route.eventId} eventId={route.eventId} />;
    case 'receipt':
      return <ReceiptScreen eventId={route.eventId} />;
    case 'shame':
      return <ShamePostScreen eventId={route.eventId} />;
    case 'woke':
      return <WokeScreen lost={route.lost} snoozes={route.snoozes} />;
  }
}

function Shell() {
  const { state } = useAppState();
  // Only evaluated on mount: persisted users land on the dashboard.
  const initial = useMemo<Route>(() => ({ name: state.onboarded ? 'dashboard' : 'welcome' }), []);
  return (
    <div className="device">
      <div className="device-screen">
        <NavigationProvider initial={initial}>
          <Router />
        </NavigationProvider>
      </div>
    </div>
  );
}

export function App({ services }: { services?: Services }) {
  const resolved = useMemo(() => services ?? createMockServices(), [services]);
  return (
    <ServiceProvider services={resolved}>
      <AppStateProvider>
        <Shell />
      </AppStateProvider>
    </ServiceProvider>
  );
}
