import {
  BaseError,
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  http,
  keccak256,
  parseAbi,
  toHex,
  type Address,
  type EIP1193Provider,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import type { CircuitInputs } from '../../../../src/circuit';
import { hashSecret } from '../../../../src/hashing';
import { fetchMerkleTree } from '../../../../src/merkleTree';
import { noteAllSecretsHash, randomFieldElement, type Note } from '../../../../src/note';
import type { Cents, TxResult, WakeCode } from '../../domain/types';
import type { StakeService, WalletService } from '../types';
import type { ChainConfig } from './config';
import { createNoteStore, type NoteRecord, type NoteStore } from './noteStore';
import { fromUnixSeconds, planSlash, planWake, toUnixSeconds } from './timing';

const wakeStakeAbi = parseAbi([
  'function stake(address _token, uint256 _amount, uint256 _allSecretsHash)',
  'function wake(uint256 _newleaf, uint256 _root, uint256 _nullifier, uint256 _pastTimeStamp, uint256 _futureTimeStamp, bytes _proof)',
  'function withdraw(address _recipient, address _token, uint256 _amount, uint256 _root, uint256 _nullifier, uint256 _pastTimeStamp, uint256 _futureTimeStamp, bool _lose, bytes _proof)',
]);

const tokenAbi = parseAbi([
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address, address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  // MockERC20 only
  'function mint(address, uint256)',
]);

type Proof = { proof: Hex; root: bigint; nullifier: bigint; newLeaf: bigint; lose: boolean };

export interface ChainDeps {
  publicClient: PublicClient;
  /** A wallet client for `account`, already on the right chain. */
  walletClient(account: Address): Promise<WalletClient>;
  notes: NoteStore;
  prove(inputs: CircuitInputs): Promise<Proof>;
}

function injectedProvider(): EIP1193Provider {
  const provider = (globalThis as { ethereum?: EIP1193Provider }).ethereum;
  if (!provider) throw new Error('No wallet found. Install MetaMask, or open WakeStake in your wallet’s browser.');
  return provider;
}

async function ensureChain(client: WalletClient, cfg: ChainConfig) {
  if ((await client.getChainId()) === cfg.chain.id) return;
  try {
    await client.switchChain({ id: cfg.chain.id });
  } catch {
    // Unknown to the wallet (e.g. a local Hardhat node): add it, which also switches.
    await client.addChain({ chain: cfg.chain });
  }
}

/** Loads the prover (bb.js + noir_js, a few MB of wasm) only when a proof is actually needed. */
async function proveInBrowser(inputs: CircuitInputs): Promise<Proof> {
  const [{ generateProof }, circuit] = await Promise.all([
    import('../../../../src/circuit'),
    import('./wakestake.circuit.json'),
  ]);
  return generateProof(circuit.default as Parameters<typeof generateProof>[0], inputs);
}

export function createBrowserChainDeps(cfg: ChainConfig): ChainDeps {
  return {
    publicClient: createPublicClient({ chain: cfg.chain, transport: http(cfg.rpcUrl) }),
    async walletClient(account) {
      const client = createWalletClient({ account, chain: cfg.chain, transport: custom(injectedProvider()) });
      await ensureChain(client, cfg);
      return client;
    },
    notes: createNoteStore(),
    prove: proveInBrowser,
  };
}

export function createInjectedWalletService(cfg: ChainConfig): WalletService {
  return {
    async connect() {
      const client = createWalletClient({ chain: cfg.chain, transport: custom(injectedProvider()) });
      const [address] = await client.requestAddresses();
      if (!address) throw new Error('The wallet didn’t share an account.');
      await ensureChain(client, cfg);
      return { address, network: cfg.chain.name };
    },
  };
}

/** The bathroom QR code *is* the circuit's `secret`: only someone standing at the QR can prove they're up. */
function wakeSecret(code: WakeCode): bigint {
  if (!/^[0-9a-f]{1,62}$/i.test(code.id)) throw new Error('This wake code can’t be used on-chain. Generate a new one.');
  return BigInt(`0x${code.id}`);
}

const addressOf = (field: bigint) => getAddress(toHex(field, { size: 20 }));

const errorMessage = (e: unknown) =>
  e instanceof BaseError ? e.shortMessage : e instanceof Error ? e.message : 'Transaction failed';

export function createChainStakeService(cfg: ChainConfig, deps: ChainDeps = createBrowserChainDeps(cfg)): StakeService {
  const { publicClient, notes } = deps;
  let decimals: Promise<number> | null = null;

  const toUnits = async (amount: Cents) => {
    decimals ??= publicClient.readContract({ address: cfg.token, abi: tokenAbi, functionName: 'decimals' });
    return (BigInt(amount) * 10n ** BigInt(await decimals)) / 100n;
  };

  /** Chain time can lag the wall clock (a local node only mines on demand), so use whichever is later. */
  const now = async () => {
    const block = await publicClient.getBlock();
    const wall = toUnixSeconds(new Date());
    return block.timestamp > wall ? block.timestamp : wall;
  };

  const activeNote = (owner: Address) => notes.active(cfg.chain.id, cfg.wakeStake, owner);

  const newRecord = (owner: Address, note: Note, secret: bigint): NoteRecord => ({
    chainId: cfg.chain.id,
    contract: cfg.wakeStake,
    owner,
    note,
    secret,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

  /** Simulates first so a revert surfaces with the contract's reason instead of a wallet popup. */
  async function send(
    owner: Address,
    call: {
      address: Address;
      abi: typeof wakeStakeAbi | typeof tokenAbi;
      functionName: string;
      args: readonly unknown[];
    },
  ): Promise<TxResult> {
    try {
      const wallet = await deps.walletClient(owner);
      const { request } = await publicClient.simulateContract({ ...call, account: owner } as never);
      const hash = await wallet.writeContract(request as never);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Transaction reverted');
      const explorer = cfg.chain.blockExplorers?.default.url;
      return {
        txHash: hash,
        blockNumber: Number(receipt.blockNumber),
        network: cfg.chain.name,
        onChain: true,
        explorerUrl: explorer ? `${explorer}/tx/${hash}` : undefined,
      };
    } catch (e) {
      throw new Error(errorMessage(e));
    }
  }

  async function ensureFunds(owner: Address, units: bigint) {
    const read = <T>(functionName: 'balanceOf' | 'allowance', args: readonly Address[]) =>
      publicClient.readContract({ address: cfg.token, abi: tokenAbi, functionName, args } as never) as Promise<T>;
    const balance = await read<bigint>('balanceOf', [owner]);
    if (balance < units) {
      if (!cfg.mintTestTokens) {
        const symbol = await publicClient.readContract({ address: cfg.token, abi: tokenAbi, functionName: 'symbol' });
        throw new Error(`Not enough ${symbol} in your wallet to stake this much.`);
      }
      await send(owner, { address: cfg.token, abi: tokenAbi, functionName: 'mint', args: [owner, units - balance] });
    }
    if ((await read<bigint>('allowance', [owner, cfg.wakeStake])) < units) {
      await send(owner, { address: cfg.token, abi: tokenAbi, functionName: 'approve', args: [cfg.wakeStake, units] });
    }
  }

  return {
    penaltyModel: 'all-or-nothing',

    async deposit({ wallet, amount, deadline, wakeCode }) {
      const owner = getAddress(wallet.address);
      const units = await toUnits(amount);
      const wakeTimestamp = toUnixSeconds(deadline);
      if (wakeTimestamp <= (await now())) throw new Error('That wake-up time has already passed.');
      const secret = wakeSecret(wakeCode);
      const note: Note = {
        token: BigInt(cfg.token),
        amount: units,
        nullifierSecret: randomFieldElement(),
        secretHash: hashSecret(secret),
        wakeTimestamp,
        donationAddress: BigInt(cfg.donation),
      };

      await ensureFunds(owner, units);
      const record = newRecord(owner, note, secret);
      notes.add(record);
      const tx = await send(owner, {
        address: cfg.wakeStake,
        abi: wakeStakeAbi,
        functionName: 'stake',
        args: [cfg.token, units, noteAllSecretsHash(note)],
      });
      notes.setStatus(record, 'active', tx.txHash);
      return tx;
    },

    async wake({ wallet, wakeCode, nextDeadline }) {
      const owner = getAddress(wallet.address);
      const current = activeNote(owner);
      if (!current) return null;
      const deadline = fromUnixSeconds(current.note.wakeTimestamp);

      const plan = planWake(await now(), current.note.wakeTimestamp);
      if (plan.kind === 'too-early') return null;
      if (plan.kind === 'late') {
        throw new Error(
          `Too late: you had to be up by ${deadline.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. ` +
            'The contract won’t accept an on-time proof anymore, so your stake belongs to the charity.',
        );
      }

      const secret = wakeSecret(wakeCode);
      if (hashSecret(secret) !== current.note.secretHash) throw new Error('This QR code doesn’t match your stake.');
      const next = nextDeadline(deadline);
      if (!next) throw new Error('Your alarm has no days left to roll the stake over to.');
      const noteAfterWake: Note = {
        ...current.note,
        nullifierSecret: randomFieldElement(),
        wakeTimestamp: toUnixSeconds(next),
      };

      const proof = await deps.prove({
        merkleTree: await fetchMerkleTree(publicClient, cfg.wakeStake),
        note: current.note,
        secret,
        pastTimestamp: plan.pastTimestamp,
        futureTimestamp: plan.futureTimestamp,
        noteAfterWake,
      });
      const record = newRecord(owner, noteAfterWake, secret);
      notes.add(record);
      const tx = await send(owner, {
        address: cfg.wakeStake,
        abi: wakeStakeAbi,
        functionName: 'wake',
        args: [proof.newLeaf, proof.root, proof.nullifier, plan.pastTimestamp, plan.futureTimestamp, proof.proof],
      });
      notes.setStatus(current, 'spent', tx.txHash);
      notes.setStatus(record, 'active', tx.txHash);
      return { ...tx, proofHash: keccak256(proof.proof) };
    },

    // All-or-nothing: `amount` is ignored, the contract only moves the whole stake.
    async slash({ wallet }) {
      const owner = getAddress(wallet.address);
      const current = activeNote(owner);
      if (!current) throw new Error('No stake is locked on-chain for this wallet.');
      const { note } = current;

      const plan = planSlash(await now(), note.wakeTimestamp);
      if (plan.kind === 'too-early') {
        const deadline = fromUnixSeconds(note.wakeTimestamp).toLocaleString([], {
          weekday: 'short',
          hour: 'numeric',
          minute: '2-digit',
        });
        throw new Error(`Not yet: the contract only releases your stake after your deadline (${deadline}).`);
      }

      const proof = await deps.prove({
        merkleTree: await fetchMerkleTree(publicClient, cfg.wakeStake),
        note,
        secret: current.secret,
        pastTimestamp: plan.pastTimestamp,
        futureTimestamp: plan.futureTimestamp,
        withdrawal: { recipient: note.donationAddress, token: note.token, amount: note.amount },
      });
      const tx = await send(owner, {
        address: cfg.wakeStake,
        abi: wakeStakeAbi,
        functionName: 'withdraw',
        args: [
          addressOf(note.donationAddress),
          addressOf(note.token),
          note.amount,
          proof.root,
          proof.nullifier,
          plan.pastTimestamp,
          plan.futureTimestamp,
          proof.lose,
          proof.proof,
        ],
      });
      notes.setStatus(current, 'spent', tx.txHash);
      return { ...tx, proofHash: keccak256(proof.proof) };
    },
  };
}
