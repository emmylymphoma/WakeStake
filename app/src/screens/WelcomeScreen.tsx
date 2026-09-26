import { useState } from 'react';
import { Logo } from '../components/Logo';
import { Screen } from '../components/Screen';
import { Button, Field } from '../components/ui';
import { SLOGAN } from '../domain/copy';
import { useNavigation } from '../navigation/Navigation';
import { useServices } from '../services/ServiceContext';
import { useAppState } from '../state/AppStateContext';

const HOW_IT_WORKS = [
  { icon: '🔒', title: 'Lock a stake', body: 'Put real money behind your alarm.' },
  { icon: '😴', title: 'Snooze late = pay', body: 'Snooze past your wake-up time and your stake goes to charity.' },
  { icon: '😈', title: 'Not your charity', body: 'We pick one you’re against, and reveal it when you snooze late.' },
  { icon: '📣', title: 'Posted on X', body: 'Late snoozes get posted to your X account.' },
];

export function WelcomeScreen() {
  const { state, dispatch } = useAppState();
  const { navigate } = useNavigation();
  const services = useServices();
  const [displayName, setDisplayName] = useState(state.profile.displayName);
  const ready = displayName.trim().length > 0;

  const start = () => {
    dispatch({ type: 'SET_PROFILE', profile: { ...state.profile, displayName: displayName.trim() } });
    navigate({ name: 'stakeSetup' });
  };

  return (
    <Screen
      footer={
        <>
          <Button size="lg" disabled={!ready} onClick={start}>
            Put money on it →
          </Button>
          <p className="fine-print">
            {services.stake.penaltyModel === 'all-or-nothing'
              ? 'Real transactions: your stake is locked in the WakeStake contract.'
              : 'No real money. This prototype runs entirely on mock services.'}
          </p>
        </>
      }
    >
      <div className="hero">
        <Logo size="lg" />
        <h1 className="hero-title">
          U Snooze
          <br />
          <span className="text-danger">U Lose.</span>
        </h1>
        <p className="hero-sub">
          The alarm clock that charges you for snoozing past your wake-up time. Your money goes to a cause you’re against.
        </p>
      </div>

      <ol className="how-list">
        {HOW_IT_WORKS.map((item) => (
          <li key={item.title} className="how-item">
            <span className="how-icon" aria-hidden>
              {item.icon}
            </span>
            <span>
              <strong>{item.title}</strong>
              <span className="muted"> {item.body}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="stack-md">
        <Field label="What should we call you?">
          <input
            className="input"
            placeholder="Your name"
            value={displayName}
            autoComplete="name"
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </Field>
      </div>
      <span className="sr-only">{SLOGAN}</span>
    </Screen>
  );
}
