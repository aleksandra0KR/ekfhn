#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, IntoVal};

const INSTANCE_BUMP: u32 = 7 * 17280;
const INSTANCE_THRESHOLD: u32 = 6 * 17280;


#[contracttype]
pub enum PoolKey {
    TokenA,
    TokenB,
    LpToken,
    ReserveA,
    ReserveB,
    TotalSwaps,
}


fn bump(e: &Env) {
    e.storage().instance().extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
}

fn get_token_a(e: &Env) -> Address {
    e.storage().instance().get(&PoolKey::TokenA).unwrap()
}
fn get_token_b(e: &Env) -> Address {
    e.storage().instance().get(&PoolKey::TokenB).unwrap()
}
fn get_lp_token(e: &Env) -> Address {
    e.storage().instance().get(&PoolKey::LpToken).unwrap()
}
fn get_reserve_a(e: &Env) -> i128 {
    e.storage().instance().get(&PoolKey::ReserveA).unwrap_or(0)
}
fn get_reserve_b(e: &Env) -> i128 {
    e.storage().instance().get(&PoolKey::ReserveB).unwrap_or(0)
}
fn get_total_swaps(e: &Env) -> u64 {
    e.storage().instance().get(&PoolKey::TotalSwaps).unwrap_or(0)
}

fn set_reserves(e: &Env, a: i128, b: i128) {
    e.storage().instance().set(&PoolKey::ReserveA, &a);
    e.storage().instance().set(&PoolKey::ReserveB, &b);
}

fn isqrt(val: i128) -> i128 {
    if val < 0 {
        panic!("sqrt of negative");
    }
    if val == 0 {
        return 0;
    }
    let mut x = val;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + val / x) / 2;
    }
    x
}


#[contract]
pub struct LiquidityPool;

#[contractimpl]
impl LiquidityPool {
    pub fn __constructor(e: Env, token_a: Address, token_b: Address, lp_token: Address) {
        e.storage().instance().set(&PoolKey::TokenA, &token_a);
        e.storage().instance().set(&PoolKey::TokenB, &token_b);
        e.storage().instance().set(&PoolKey::LpToken, &lp_token);
        set_reserves(&e, 0, 0);
        e.storage().instance().set(&PoolKey::TotalSwaps, &0u64);
    }


    pub fn get_reserves(e: Env) -> (i128, i128) {
        bump(&e);
        (get_reserve_a(&e), get_reserve_b(&e))
    }

    pub fn token_a(e: Env) -> Address {
        get_token_a(&e)
    }
    pub fn token_b(e: Env) -> Address {
        get_token_b(&e)
    }
    pub fn lp_token(e: Env) -> Address {
        get_lp_token(&e)
    }
    pub fn total_swaps(e: Env) -> u64 {
        bump(&e);
        get_total_swaps(&e)
    }

    pub fn add_liquidity(e: Env, user: Address, amount_a: i128, amount_b: i128) -> i128 {
        user.require_auth();
        if amount_a <= 0 || amount_b <= 0 {
            panic!("amounts must be positive");
        }
        bump(&e);

        let pool_addr = e.current_contract_address();

        let client_a = token::Client::new(&e, &get_token_a(&e));
        let client_b = token::Client::new(&e, &get_token_b(&e));
        client_a.transfer(&user, &pool_addr, &amount_a);
        client_b.transfer(&user, &pool_addr, &amount_b);

        let reserve_a = get_reserve_a(&e);
        let reserve_b = get_reserve_b(&e);

        let lp_addr = get_lp_token(&e);

        let lp_amount: i128;

        if reserve_a == 0 && reserve_b == 0 {
            lp_amount = isqrt(amount_a * amount_b);
        } else {
            let total_lp = Self::get_lp_supply_internal(&e, &lp_addr);

            let lp_a = (amount_a * total_lp) / reserve_a;
            let lp_b = (amount_b * total_lp) / reserve_b;
            lp_amount = if lp_a < lp_b { lp_a } else { lp_b };
        }

        if lp_amount <= 0 {
            panic!("lp amount too small");
        }

        e.invoke_contract::<()>(
            &lp_addr,
            &soroban_sdk::Symbol::new(&e, "mint"),
            soroban_sdk::vec![&e, user.to_val(), lp_amount.into_val(&e)],
        );

        set_reserves(&e, reserve_a + amount_a, reserve_b + amount_b);

        lp_amount
    }

    pub fn remove_liquidity(e: Env, user: Address, lp_amount: i128) -> (i128, i128) {
        user.require_auth();
        if lp_amount <= 0 {
            panic!("lp_amount must be positive");
        }
        bump(&e);

        let reserve_a = get_reserve_a(&e);
        let reserve_b = get_reserve_b(&e);
        let lp_addr = get_lp_token(&e);
        let total_lp = Self::get_lp_supply_internal(&e, &lp_addr);

        if total_lp == 0 {
            panic!("no liquidity");
        }

        let amount_a = (lp_amount * reserve_a) / total_lp;
        let amount_b = (lp_amount * reserve_b) / total_lp;

        if amount_a <= 0 || amount_b <= 0 {
            panic!("withdraw amount too small");
        }

        e.invoke_contract::<()>(
            &lp_addr,
            &soroban_sdk::Symbol::new(&e, "burn_from_pool"),
            soroban_sdk::vec![&e, user.to_val(), lp_amount.into_val(&e)],
        );

        let pool_addr = e.current_contract_address();
        let client_a = token::Client::new(&e, &get_token_a(&e));
        let client_b = token::Client::new(&e, &get_token_b(&e));
        client_a.transfer(&pool_addr, &user, &amount_a);
        client_b.transfer(&pool_addr, &user, &amount_b);

        set_reserves(&e, reserve_a - amount_a, reserve_b - amount_b);

        (amount_a, amount_b)
    }

    pub fn swap_a_to_b(e: Env, user: Address, amount_in: i128, min_out: i128) -> i128 {
        user.require_auth();
        if amount_in <= 0 {
            panic!("amount_in must be positive");
        }
        bump(&e);

        let reserve_a = get_reserve_a(&e);
        let reserve_b = get_reserve_b(&e);

        // Формула: out = (reserve_b * amount_in) / (reserve_a + amount_in)
        let amount_out = (reserve_b * amount_in) / (reserve_a + amount_in);

        if amount_out < min_out {
            panic!("slippage: output below minimum");
        }
        if amount_out <= 0 {
            panic!("output is zero");
        }

        let pool_addr = e.current_contract_address();
        let client_a = token::Client::new(&e, &get_token_a(&e));
        let client_b = token::Client::new(&e, &get_token_b(&e));


        client_a.transfer(&user, &pool_addr, &amount_in);
        client_b.transfer(&pool_addr, &user, &amount_out);

        set_reserves(&e, reserve_a + amount_in, reserve_b - amount_out);

        let swaps = get_total_swaps(&e);
        e.storage().instance().set(&PoolKey::TotalSwaps, &(swaps + 1));

        amount_out
    }

    pub fn swap_b_to_a(e: Env, user: Address, amount_in: i128, min_out: i128) -> i128 {
        user.require_auth();
        if amount_in <= 0 {
            panic!("amount_in must be positive");
        }
        bump(&e);

        let reserve_a = get_reserve_a(&e);
        let reserve_b = get_reserve_b(&e);

        let amount_out = (reserve_a * amount_in) / (reserve_b + amount_in);

        if amount_out < min_out {
            panic!("slippage: output below minimum");
        }
        if amount_out <= 0 {
            panic!("output is zero");
        }

        let pool_addr = e.current_contract_address();
        let client_a = token::Client::new(&e, &get_token_a(&e));
        let client_b = token::Client::new(&e, &get_token_b(&e));

        client_b.transfer(&user, &pool_addr, &amount_in);
        client_a.transfer(&pool_addr, &user, &amount_out);

        set_reserves(&e, reserve_a - amount_out, reserve_b + amount_in);

        let swaps = get_total_swaps(&e);
        e.storage().instance().set(&PoolKey::TotalSwaps, &(swaps + 1));

        amount_out
    }

    pub fn quote_a_to_b(e: Env, amount_in: i128) -> i128 {
        bump(&e);
        let ra = get_reserve_a(&e);
        let rb = get_reserve_b(&e);
        if ra == 0 || rb == 0 || amount_in <= 0 {
            return 0;
        }
        (rb * amount_in) / (ra + amount_in)
    }

    pub fn quote_b_to_a(e: Env, amount_in: i128) -> i128 {
        bump(&e);
        let ra = get_reserve_a(&e);
        let rb = get_reserve_b(&e);
        if ra == 0 || rb == 0 || amount_in <= 0 {
            return 0;
        }
        (ra * amount_in) / (rb + amount_in)
    }

    fn get_lp_supply_internal(e: &Env, lp_addr: &Address) -> i128 {
        e.invoke_contract::<i128>(
            lp_addr,
            &soroban_sdk::Symbol::new(e, "total_supply"),
            soroban_sdk::Vec::new(e),
        )
    }
}

mod test;
