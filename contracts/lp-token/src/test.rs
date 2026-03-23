#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};

fn create_lp<'a>(e: &Env, admin: &Address, minter: &Address) -> LpTokenContractClient<'a> {
    let id = e.register(LpTokenContract, (admin, minter));
    LpTokenContractClient::new(e, &id)
}

#[test]
fn test_mint_and_burn() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let minter = Address::generate(&e);
    let user = Address::generate(&e);
    let lp = create_lp(&e, &admin, &minter);

    lp.mint(&user, &5000);
    assert_eq!(lp.balance(&user), 5000);
    assert_eq!(lp.total_supply(), 5000);

    lp.burn_from_pool(&user, &2000);
    assert_eq!(lp.balance(&user), 3000);
    assert_eq!(lp.total_supply(), 3000);
}
