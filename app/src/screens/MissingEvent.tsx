import { Screen } from '../components/Screen';
import { Button } from '../components/ui';
import { useNavigation } from '../navigation/Navigation';

export function MissingEvent() {
  const { reset } = useNavigation();
  return (
    <Screen footer={<Button onClick={() => reset({ name: 'dashboard' })}>Back to dashboard</Button>}>
      <h2 className="title">Nothing to see here.</h2>
      <p className="muted">This snooze couldn’t be found.</p>
    </Screen>
  );
}
