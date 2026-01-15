/// Module: bottle_contracts
/// A module for creating encrypted bottle messages on Sui
module bottle_contracts::bottle_contracts;

public struct Bottlemessage has key {
    id: UID,
    sender: address,
    encrypted_message: vector<u8>,
}

/// Seal approve function for encryption verification
public entry fun seal_approve(_id: vector<u8>, bottle: &Bottlemessage, ctx: &TxContext) {
    assert!(bottle.sender == ctx.sender(), 1);
}

/// Create a new empty bottle message (shared object)
public entry fun create_bottle(ctx: &mut TxContext) {
    let bottle = Bottlemessage {
        id: object::new(ctx),
        sender: ctx.sender(),
        encrypted_message: vector::empty(),
    };

    transfer::share_object(bottle);
}

/// Put an encrypted message into the bottle
/// Only the original sender can add a message, and only once
public fun put_message(bottle: &mut Bottlemessage, message: vector<u8>, ctx: &TxContext) {
    assert!(bottle.sender == ctx.sender(), 1);
    assert!(bottle.encrypted_message.length() == 0, 2);

    bottle.encrypted_message = message;
}
