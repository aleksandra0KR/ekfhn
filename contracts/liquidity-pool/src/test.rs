#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;

mod token_contract {
    soroban_sdk::contractimport!(file = "../naboka-token/target/wasm32-unknown-unknown/release/naboka_token.wasm");
}

mod lp_contract {
    soroban_sdk::contractimport!(file = "../lp-token/target/wasm32-unknown-unknown/release/lp_token.wasm");
}
#[test]
fn test_isqrt() {
    assert_eq!(isqrt(0), 0);
    assert_eq!(isqrt(1), 1);
    assert_eq!(isqrt(4), 2);
    assert_eq!(isqrt(9), 3);
    assert_eq!(isqrt(10), 3);
    assert_eq!(isqrt(100), 10);
    assert_eq!(isqrt(1000000), 1000);
}
