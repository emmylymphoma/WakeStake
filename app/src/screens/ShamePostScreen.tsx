import { useState } from 'react';
import { Screen } from '../components/Screen';
import { Button, MockBadge } from '../components/ui';
import { formatMoney } from '../domain/money';
import { useNavigation } from '../navigation/Navigation';
import { useServices } from '../services/ServiceContext';
import { useAppState } from '../state/AppStateContext';
import { MissingEvent } from './MissingEvent';
import { useEvent } from './useEvent';

function renderText(text: string) {
  return text.split(/(\s+)/).map((part, i) =>
    /^[#@]\w+/.test(part) ? (
      <span key={i} className="x-link">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

export function ShamePostScreen({ eventId }: { eventId: string }) {
  const { dispatch } = useAppState();
  const services = useServices();
  const { back } = useNavigation();
  const event = useEvent(eventId);
  const [posting, setPosting] = useState(false);
  if (!event) return <MissingEvent />;

  const { post } = event;
  const name = post.author.displayName || 'Sleepy';
  const created = new Date(post.createdAt);
  // Engagement is fake but stable per event.
  const seed = parseInt(event.id.slice(0, 6), 16);

  const publish = async () => {
    setPosting(true);
    try {
      const { url } = await services.social.publish(post);
      dispatch({ type: 'POST_PUBLISHED', eventId: event.id, post: { ...post, url } });
    } finally {
      setPosting(false);
    }
  };

  return (
    <Screen
      onBack={back}
      topRight={<MockBadge>MOCK</MockBadge>}
      footer={
        !post.author.handle ? (
          <p className="fine-print">No X account linked, so this stays private. For now.</p>
        ) : post.url ? (
          <p className="fine-print text-lime">✓ “Posted” (not really — mock X service). {post.url}</p>
        ) : (
          <Button size="lg" loading={posting} onClick={publish}>
            {posting ? 'Posting…' : 'Post it (mock)'}
          </Button>
        )
      }
    >
      <h2 className="title">Public shame preview</h2>
      <p className="muted">Written by our (mock) AI. This is what your followers see.</p>

      <article className="x-card">
        <header className="x-head">
          <span className="x-avatar" aria-hidden>
            {name[0]!.toUpperCase()}
          </span>
          <span className="grow">
            <strong className="x-name">{name}</strong>
            <span className="x-handle">{post.author.handle ? `@${post.author.handle}` : '@(no X linked)'}</span>
          </span>
          <span className="x-logo" aria-hidden>
            𝕏
          </span>
        </header>
        <p className="x-text">{renderText(post.text)}</p>
        <div className="x-embed">
          <div className="x-embed-amount">−{formatMoney(event.penalty)}</div>
          <div className="muted small">Proof of Snooze · {event.receipt.receiptId}</div>
        </div>
        <div className="x-meta muted small">
          {created.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} ·{' '}
          {created.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <footer className="x-actions muted small">
          <span>💬 {(seed % 40) + 3}</span>
          <span>🔁 {(seed % 90) + 12}</span>
          <span>♥ {(seed % 400) + 57}</span>
          <span>📊 {((seed % 90) + 10) / 10}K</span>
        </footer>
      </article>
    </Screen>
  );
}
