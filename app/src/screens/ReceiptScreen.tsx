import { Screen } from '../components/Screen';
import { MockBadge } from '../components/ui';
import { formatMoney } from '../domain/money';
import { useNavigation } from '../navigation/Navigation';
import { useAppState } from '../state/AppStateContext';
import { MissingEvent } from './MissingEvent';
import { useEvent } from './useEvent';

const short = (hex: string, n = 6) => `${hex.slice(0, n + 2)}…${hex.slice(-n)}`;

/** Decorative 12×12 pattern derived from the proof hash — a stand-in for a real QR/verifier link. */
function HashPattern({ hash }: { hash: string }) {
  const bits = hash
    .slice(2)
    .split('')
    .flatMap((c) => parseInt(c, 16).toString(2).padStart(4, '0').split(''));
  return (
    <div className="hash-pattern" aria-hidden>
      {bits.slice(0, 144).map((b, i) => (
        <span key={i} data-on={b === '1'} />
      ))}
    </div>
  );
}

export function ReceiptScreen({ eventId }: { eventId: string }) {
  const { state } = useAppState();
  const { back } = useNavigation();
  const event = useEvent(eventId);
  if (!event) return <MissingEvent />;
  const r = event.receipt;

  const rows: [string, string][] = [
    ['Receipt', r.receiptId],
    ['Issued', new Date(r.issuedAt).toLocaleString()],
    ['Offender', `@${state.profile.handle}`],
    ['Wallet', short(r.walletAddress, 4)],
    ['Snooze #', String(r.snoozeNumber)],
    ['Beneficiary', r.charityName],
    ['Network', r.network],
    ['Block', r.blockNumber.toLocaleString()],
    ['Tx hash', short(r.txHash)],
    ['Proof', short(r.proofHash)],
  ];

  return (
    <Screen onBack={back} topRight={<MockBadge>MOCK</MockBadge>}>
      <div className="receipt">
        <div className="receipt-head">
          <div className="receipt-brand">WAKESTAKE</div>
          <div className="receipt-title">PROOF OF SNOOZE</div>
          <div className="receipt-sub">Certified evidence of weakness</div>
        </div>
        <div className="receipt-rule" />
        <dl className="receipt-rows">
          {rows.map(([k, v]) => (
            <div key={k} className="receipt-row">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="receipt-rule" />
        <div className="receipt-total">
          <span>AMOUNT FORFEITED</span>
          <strong>{formatMoney(r.amount)}</strong>
        </div>
        <div className="receipt-rule" />
        <HashPattern hash={r.proofHash} />
        <div className="receipt-stamp">SNOOZED</div>
        <p className="receipt-foot">
          Demo receipt. Not a real transaction. In production, this is a verifiable on-chain / ZK proof.
        </p>
      </div>
    </Screen>
  );
}
