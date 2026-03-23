#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env, String};

// Для тестов нам нужны контракты токена и LP-токена.
// Используем soroban_sdk::token для регистрации стандартных тестовых токенов,
// а LP-токен эмулируем через стандартный SAC (Stellar Asset Contract).

mod token_contract {
    soroban_sdk::contractimport!(file = "../naboka-token/target/wasm32-unknown-unknown/release/naboka_token.wasm");
}

mod lp_contract {
    soroban_sdk::contractimport!(file = "../lp-token/target/wasm32-unknown-unknown/release/lp_token.wasm");
}

// Примечание: тесты ниже предполагают предварительную компиляцию
// naboka-token и lp-token в WASM. Если WASM-файлы отсутствуют,
// тесты не скомпилируются. Это нормально для CI-pipeline,
// где сначала собираются все контракты, а потом запускаются тесты.

// Для локальной отладки без WASM можно использовать интеграционные
// тесты через soroban-cli с локальной сетью.

// Ниже — заглушка, которая демонстрирует структуру тестов.
// Раскомментируйте после сборки WASM.

/*
#[test]
fn test_add_liquidity_and_swap() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user  = Address::generate(&e);

    // Регистрируем Token A (NabokaToken)
    let token_a_id = e.register(token_contract::WASM, (
        &admin, 7u32,
        String::from_str(&e, "NabokaToken"),
        String::from_str(&e, "NT"),
    ));
    let ta = token::Client::new(&e, &token_a_id);

    // Регистрируем Token B (имитируем XLM)
    let token_b_id = e.register(token_contract::WASM, (
        &admin, 7u32,
        String::from_str(&e, "TestXLM"),
        String::from_str(&e, "TXLM"),
    ));
    let tb = token::Client::new(&e, &token_b_id);

    // Регистрируем пул (пока без LP — нужен адрес пула для LP minter)
    let pool_id = e.register(LiquidityPool, (&token_a_id, &token_b_id, &admin)); // заглушка

    // Регистрируем LP-токен с minter = pool
    let lp_id = e.register(lp_contract::WASM, (&admin, &pool_id));

    // ... полноценный тест требует пересоздания пула с правильным lp_id.
    // В продакшене используйте soroban-cli для интеграционных тестов.
}
*/

// Юнит-тест для isqrt
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
