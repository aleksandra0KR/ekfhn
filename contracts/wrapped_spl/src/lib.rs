#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, Env, String,
};
use soroban_token_sdk::metadata::TokenMetadata;
use soroban_token_sdk::TokenUtils;

// TTL константы такие же как в naboka_token
const INSTANCE_BUMP: u32 = 7 * 17280;
const INSTANCE_THRESHOLD: u32 = 6 * 17280;
const BALANCE_BUMP: u32 = 30 * 17280;
const BALANCE_THRESHOLD: u32 = 29 * 17280;

#[contracttype]
pub enum DataKey {
    Admin,          // владелец контракта
    BridgeAdmin,    // оракул — единственный кто может mint/burn
    TotalSupply,
    Balance(Address),
    Allowance(AllowanceKey),
}

// AllowanceKey, AllowanceVal — идентичны naboka_token
// get_balance, set_balance, get_allowance, set_allowance — идентичны

#[contract]
pub struct WrappedSplContract;

fn bump(e: &Env) {
    e.storage().instance().extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
}

fn set_balance(e: &Env, addr: &Address, amount: i128) {
    let key = DataKey::Balance(addr.clone());
    e.storage().persistent().set(&key, &amount);
    e.storage().persistent().extend_ttl(&key, BALANCE_THRESHOLD, BALANCE_BUMP);
}

fn get_total_supply(e: &Env) -> i128 {
    e.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0)
}

#[contractimpl]
impl WrappedSplContract {
    pub fn __constructor(e: Env, admin: Address, bridge_admin: Address) {
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::BridgeAdmin, &bridge_admin);
        set_total_supply(&e, 0);
        TokenUtils::new(&e).metadata().set_metadata(&TokenMetadata {
            decimal: 9,                              // совпадает с decimals партнёров
            name:   String::from_str(&e, "Wrapped SimpleToken"),
            symbol: String::from_str(&e, "wSPL"),
        });
    }

    // Только оракул
    pub fn bridge_mint(e: Env, to: Address, amount: i128) {
        get_bridge_admin(&e).require_auth();
        check_positive(amount);
        bump(&e);
        set_balance(&e, &to, get_balance(&e, &to) + amount);
        set_total_supply(&e, get_total_supply(&e) + amount);
        TokenUtils::new(&e).events().mint(get_bridge_admin(&e), to, amount);
    }

    // Пользователь сжигает wSPL → оракул минтит оригинальный SPL на Solana
    pub fn bridge_burn(e: Env, from: Address, amount: i128, target_sol_addr: String) {
        from.require_auth();
        check_positive(amount);
        bump(&e);

        let b = get_balance(&e, &from);
        if b < amount { panic!("insufficient balance"); }
        set_balance(&e, &from, b - amount);
        set_total_supply(&e, get_total_supply(&e) - amount);

        // Событие для оракула
        e.events().publish(
            (soroban_sdk::symbol_short!("bburn"),),
            (from.clone(), amount, target_sol_addr),
        );
        TokenUtils::new(&e).events().burn(from, amount);
    }

    pub fn total_supply(e: Env) -> i128 {
        bump(&e);
        get_total_supply(&e)
    }
}

#[contracttype]
#[derive(Clone)]
pub struct AllowanceKey {
    pub from: Address,
    pub spender: Address,
}

#[contracttype]
#[derive(Clone)]
pub struct AllowanceVal {
    pub amount: i128,
    pub expiration_ledger: u32,
}

fn check_positive(amount: i128) {
    if amount < 0 {
        panic!("negative amount");
    }
}
mod test;


fn set_total_supply(e: &Env, supply: i128) {
    e.storage().instance().set(&DataKey::TotalSupply, &supply);
}

fn get_balance(e: &Env, addr: &Address) -> i128 {
    let key = DataKey::Balance(addr.clone());
    if let Some(b) = e.storage().persistent().get::<_, i128>(&key) {
        e.storage().persistent().extend_ttl(&key, BALANCE_THRESHOLD, BALANCE_BUMP);
        b
    } else {
        0
    }
}
fn get_bridge_admin(e: &Env) -> Address {
    e.storage().instance().get(&DataKey::BridgeAdmin).unwrap()
}

