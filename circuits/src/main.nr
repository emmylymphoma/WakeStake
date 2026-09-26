use binary_merkle_root::binary_merkle_root;
use poseidon::poseidon::bn254 as poseidon;

// Maximum tree depth the circuit supports. 32 levels = ~4 billion leaves.
global MAX_DEPTH: u32 = 32;

fn main(
    root: pub Field,
    nullifier: pub Field,
    new_leaf: pub Field,
    // withdraw (if not wake())
    withdraw_amount: pub Field,
    withdraw_recipient: pub Field,
    withdraw_token: pub Field,
    // timestamps
    // we cant get the current time in zk
    // so we get a these 2 timestamps instead. So we have a range of where the current time is
    future_timestamp: pub Field, // always in the future (contract checks it)
    past_timestamp: pub Field, // always in the past (contract checks it)
    // known by only group + owner
    nullifier_secret: Field,
    secret_hash: Field,
    wake_timestamp: Field,
    donation_address: Field,
    // known only by owner, who needs to wake up!!
    secret: Field,
    secret_amount: Field,
    secret_token: Field,
    new_nullifier_secret: Field,
    new_secret_hash: Field,
    new_wake_timestamp: Field,
    index: Field,
    depth: u32,
    siblings: [Field; MAX_DEPTH],
) {
    let all_secrets_hash: Field = poseidon::hash_4([
        nullifier_secret,
        secret_hash,
        wake_timestamp,
        donation_address,
    ]);
    let leaf: Field = poseidon::hash_3([secret_token, secret_amount, all_secrets_hash]);
    let indices: [bool; MAX_DEPTH] = index.to_le_bits();
    let computed_root: Field = binary_merkle_root(poseidon::hash_2, leaf, depth, indices, siblings);
    assert(computed_root == root, "invalid merkle proof");

    // wake_timestamp is lower then past_timestamp
    let wake_is_in_past: bool = wake_timestamp.lt(past_timestamp);

    // future_timestamp is lower then the wake_timestamp
    let wake_is_in_future: bool = future_timestamp.lt(wake_timestamp);
    assert(wake_is_in_past | wake_is_in_future, "timestamp window must not contain wake_timestamp");


    if (wake_is_in_past) {
        //     current time can be between these 2
        //                      /                  \
        // |--------------------|-------------------|
        // 0          past_timestamp      future_timestamp
        //  \                   /
        //  wake_timestamp can only be between these
        assert(
            donation_address == withdraw_recipient,
            "You woke up too late, you can only withdraw to donation_address now",
        );
    }

    if (wake_is_in_future) {
        //     current time can be between these 2
        //                      /                  \
        // |--------------------|-------------------|------------------- end of time
        // 0          past_timestamp      future_timestamp              /
        //                                         \                   /
        //                                wake_timestamp can only be between these

        // others dont know secret, so this way owner can only withdraw when they are on time!
        let secret_hash_recreated: Field = poseidon::hash_1([secret]);
        assert(
            secret_hash == secret_hash_recreated,
            "you need to know the secret if wake up in time",
        );
        // wake_timestamp is even further in the past then past_timestamp
        // you woke up too late, you lose!!!

    }

    // check if we are withdrawing
    if (withdraw_token == 0x00) {
        let new_all_secrets_hash: Field = poseidon::hash_4([
            new_nullifier_secret,
            new_secret_hash,
            new_wake_timestamp,
            donation_address,
        ]);
        let new_leaf_recreated: Field =
            poseidon::hash_3([secret_token, secret_amount, new_all_secrets_hash]);
        assert(
            new_leaf == new_leaf_recreated,
            "could not recreate new_leaf from hashing: secret_token,secret_amount,all_secrets_hash",
        )
    } else {
        assert(
            withdraw_token == secret_token,
            "withdraw_token was not set to 0, so it needs to equal secret_token",
        );
        assert(
            withdraw_amount == secret_amount,
            "withdraw_token was not set to 0, so withdraw_amount needs to equal secret_amount",
        );
    }

    assert(nullifier == poseidon::hash_1([nullifier_secret]));
}
