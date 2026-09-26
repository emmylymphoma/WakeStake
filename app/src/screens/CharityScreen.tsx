import { useEffect, useState } from 'react';
import { Screen } from '../components/Screen';
import { Button, Eyebrow } from '../components/ui';
import type { Charity } from '../domain/types';
import { useNavigation } from '../navigation/Navigation';
import { useServices } from '../services/ServiceContext';
import { useAppState } from '../state/AppStateContext';

export function CharityScreen() {
  const { state, dispatch } = useAppState();
  const services = useServices();
  const { navigate, back } = useNavigation();
  const [charities, setCharities] = useState<Charity[] | null>(null);
  const [selected, setSelected] = useState<string | null>(state.charity?.id ?? null);

  useEffect(() => {
    let alive = true;
    services.charities.list().then((list) => alive && setCharities(list));
    return () => {
      alive = false;
    };
  }, [services]);

  const finish = () => {
    const charity = charities?.find((c) => c.id === selected);
    if (!charity) return;
    dispatch({ type: 'SET_CHARITY', charity });
    navigate({ name: 'wakeQr', mode: 'onboarding' });
  };

  return (
    <Screen
      onBack={back}
      step={{ current: 3, total: 4 }}
      footer={
        <Button size="lg" disabled={!selected} onClick={finish}>
          Next: bathroom QR
        </Button>
      }
    >
      <Eyebrow>Step 3 · The beneficiary</Eyebrow>
      <h2 className="title">Who profits from your weakness?</h2>
      <p className="muted">Every snooze sends money here. At least someone wins.</p>

      {charities === null ? (
        <div className="stack-sm" aria-busy>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton" />
          ))}
        </div>
      ) : (
        <div className="stack-sm" role="radiogroup" aria-label="Charity">
          {charities.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={selected === c.id}
              className={`charity ${selected === c.id ? 'charity-on' : ''}`}
              onClick={() => setSelected(c.id)}
            >
              <span className="charity-emoji" aria-hidden>
                {c.emoji}
              </span>
              <span className="grow">
                <span className="charity-name">{c.name}</span>
                <span className="charity-tagline">{c.tagline}</span>
              </span>
              <span className="pill">{c.category}</span>
            </button>
          ))}
        </div>
      )}
    </Screen>
  );
}
