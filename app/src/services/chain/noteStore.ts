import type { Note } from '../../../../src/note';

/**
 * Every note this browser ever created, including spent ones. Losing a note loses the
 * stake, so this is append-only and lives under its own key: the demo reset (↺) and
 * app-state version bumps never touch it.
 */
const KEY = 'wakestake:notes:v1';

export type NoteStatus = 'pending' | 'active' | 'spent';

export interface NoteRecord {
  chainId: number;
  contract: string;
  /** Lowercase wallet address. */
  owner: string;
  note: Note;
  /** Proves "I woke up on time". Same value as the bathroom QR code. */
  secret: bigint;
  status: NoteStatus;
  createdAt: string;
  txHash?: string;
}

export interface NoteStore {
  /** The note currently holding this wallet's stake, if any. */
  active(chainId: number, contract: string, owner: string): NoteRecord | null;
  /** Save before sending the transaction, so a crash mid-send can't lose it. */
  add(record: NoteRecord): void;
  setStatus(record: NoteRecord, status: NoteStatus, txHash?: string): void;
}

type Stored = Omit<NoteRecord, 'note' | 'secret'> & { note: Record<keyof Note, string>; secret: string };

const sameNote = (a: NoteRecord, b: NoteRecord) =>
  a.chainId === b.chainId &&
  a.contract.toLowerCase() === b.contract.toLowerCase() &&
  a.note.nullifierSecret === b.note.nullifierSecret;

function serialize(r: NoteRecord): Stored {
  const note = Object.fromEntries(Object.entries(r.note).map(([k, v]) => [k, v.toString()])) as Stored['note'];
  return { ...r, note, secret: r.secret.toString() };
}

function deserialize(s: Stored): NoteRecord {
  const note = Object.fromEntries(Object.entries(s.note).map(([k, v]) => [k, BigInt(v)])) as unknown as Note;
  return { ...s, note, secret: BigInt(s.secret) };
}

export function createNoteStore(storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): NoteStore {
  const load = (): NoteRecord[] => {
    const raw = storage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored[]).map(deserialize) : [];
  };
  const save = (records: NoteRecord[]) => storage.setItem(KEY, JSON.stringify(records.map(serialize)));

  return {
    active(chainId, contract, owner) {
      const matches = load().filter(
        (r) =>
          r.status === 'active' &&
          r.chainId === chainId &&
          r.contract === contract.toLowerCase() &&
          r.owner === owner.toLowerCase(),
      );
      return matches.at(-1) ?? null;
    },
    add(record) {
      save([...load(), { ...record, contract: record.contract.toLowerCase(), owner: record.owner.toLowerCase() }]);
    },
    setStatus(record, status, txHash) {
      save(load().map((r) => (sameNote(r, record) ? { ...r, status, txHash: txHash ?? r.txHash } : r)));
    },
  };
}
