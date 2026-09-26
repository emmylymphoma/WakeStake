// Proves "I own a WakeStake stake of at least `min_amount` of `token` that donates to `donation_address`",
// without revealing which stake or the wake time. Used by groups to let stakers claim a handle and vote.
//
// The verifying contract must also check:
//   - WakeStake.rootHistory(root) is true
//   - WakeStake.nullifiers(nullifier) is false, so the stake wasn't withdrawn or rolled over by wake() yet
//   - claimer == msg.sender
//   - the nullifier wasn't used for a claim before, so one stake can't claim twice
use common::{hash_all_secrets, hash_leaf, hash_nullifier, hash_secret, MAX_DEPTH, merkle_root};

fn main(
    root: pub Field,
    nullifier: pub Field,
    token: pub Field,
    min_amount: pub Field,
    donation_address: pub Field,
    // binds the proof to one address, so a copied proof can't claim for someone else
    claimer: pub Field,
    // known by group + owner
    nullifier_secret: Field,
    secret_hash: Field,
    wake_timestamp: Field,
    amount: Field,
    // known only by the owner, so the group can't claim with someone else's stake
    secret: Field,
    index: Field,
    depth: u32,
    siblings: [Field; MAX_DEPTH],
) {
    let all_secrets_hash: Field =
        hash_all_secrets(nullifier_secret, secret_hash, wake_timestamp, donation_address);
    let leaf: Field = hash_leaf(token, amount, all_secrets_hash);
    assert(merkle_root(leaf, index, depth, siblings) == root, "invalid merkle proof");

    assert(hash_secret(secret) == secret_hash, "you need to know the secret to prove you own the stake");
    assert(!amount.lt(min_amount), "stake amount is below min_amount");
    assert(nullifier == hash_nullifier(nullifier_secret), "invalid nullifier");
    assert(claimer != 0, "claimer cannot be zero");
}
