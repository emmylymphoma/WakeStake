// Shared by every WakeStake circuit, so the note format can't drift between them.
use binary_merkle_root::binary_merkle_root;
use poseidon::poseidon::bn254 as poseidon;

// Maximum tree depth the circuits support. 32 levels = ~4 billion leaves.
pub global MAX_DEPTH: u32 = 32;

// Hashing functions. Keep these in sync with src/hashing.ts.

pub fn hash_secret(secret: Field) -> Field {
    poseidon::hash_1([secret])
}

pub fn hash_nullifier(nullifier_secret: Field) -> Field {
    poseidon::hash_1([nullifier_secret])
}

pub fn hash_all_secrets(
    nullifier_secret: Field,
    secret_hash: Field,
    wake_timestamp: Field,
    donation_address: Field,
) -> Field {
    poseidon::hash_4([nullifier_secret, secret_hash, wake_timestamp, donation_address])
}

pub fn hash_leaf(token: Field, amount: Field, all_secrets_hash: Field) -> Field {
    poseidon::hash_3([token, amount, all_secrets_hash])
}

fn hash_merkle_node(children: [Field; 2]) -> Field {
    poseidon::hash_2(children)
}

/// Root of the WakeStake LeanIMT that `leaf` sits in at `index`.
pub fn merkle_root(leaf: Field, index: Field, depth: u32, siblings: [Field; MAX_DEPTH]) -> Field {
    let indices: [bool; MAX_DEPTH] = index.to_le_bits();
    binary_merkle_root(hash_merkle_node, leaf, depth, indices, siblings)
}
