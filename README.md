# NabokaDEX — Децентрализованный обменник на Stellar/Soroban

> **Лабораторная работа №3** — Разработка Web3 приложения  
> **Вариант 3** — Простой пул ликвидности (аналог Uniswap V2)

---

## Состав группы

| ФИО         | Публичный адрес |
|-------------|-----------------|
| Крючкова АВ | |
| Крамской ВВ | |
| Васильев КВ |  |
|  | `GAO5CFERZZBT3QYPJVDCDNU3FAQV36DBVTJB2A5SVC467MOWPNIC4HUB` |
|  | `GB3GJXJTWWMD74JZAX2CEJ5QRA7TKPAW5BSOPUBJR7B3VMUBALORT6NO` |

**ChainId**: Stellar Testnet
---

## Описание проекта

**NabokaDEX** — децентрализованное приложение (dApp), реализующее простой пул ликвидности по модели **Constant Product AMM** (аналог Uniswap V2) на блокчейне **Stellar** с использованием смарт-контрактов **Soroban**.

### Возможности:
- **Подключение кошелька** Freighter
- **Просмотр баланса** NT (NabokaToken) и XLM
- **Перевод токенов** NT между адресами
- **Добавление/вывод ликвидности** в пул NT/XLM
- **Swap** — обмен NT ↔ XLM через AMM-пул
- **Котировки** — предварительный расчёт получаемой суммы (read-only)


### Смарт-контракты (Soroban / Rust):

1. **naboka-token** — Fungible Token (из лабораторной №2). Реализует стандартный `token::Interface` Soroban (transfer, approve, burn, mint).

2. **lp-token** — LP Token, выдаётся провайдерам ликвидности. Имеет специальную роль `minter` — контракт пула, который может минтить и сжигать LP-токены.

3. **liquidity-pool** — Основной контракт пула. Хранит резервы двух токенов и реализует:
   - `add_liquidity` — внесение ликвидности, получение LP-токенов
   - `remove_liquidity` — сжигание LP, возврат обоих токенов
   - `swap_a_to_b` / `swap_b_to_a` — обмен по формуле `x * y = k`
   - `quote_*` — read-only расчёт котировок
   - `get_reserves` — текущие резервы
   - `total_swaps` — счётчик свопов

### Формула AMM (Constant Product):

```
amount_out = (reserve_out × amount_in) / (reserve_in + amount_in)
```

При добавлении ликвидности:
- **Первый депозит**: `LP = sqrt(amount_a × amount_b)`
- **Последующие**: `LP = min(amount_a/reserve_a, amount_b/reserve_b) × total_supply`

---


## Пошаговая инструкция

### Предварительные требования

```bash
# 1. Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-none

# 2. Stellar CLI
cargo install --locked stellar-cli

# 3. Freighter (расширение для браузера)
# https://freighter.app
```

### Шаг 1. Клонирование и сборка

```bash
git clone https://github.com/aleksandra0KR/ekfhn/
cd stellar-dex
stellar contract build
```

Это скомпилирует все три контракта в WASM:
```
target/wasm32-none/release/naboka_token.wasm
target/wasm32-none/release/lp_token.wasm
target/wasm32-none/release/liquidity_pool.wasm
```

### Шаг 2. Настройка аккаунта

```bash
# Создать ключ для деплоя
stellar keys generate deployer --network testnet

# Пополнить тестовыми XLM через friendbot
stellar keys fund deployer --network testnet

# Проверить адрес
stellar keys address deployer
```

### Шаг 3. Деплой контрактов

```bash
DEPLOYER=$(stellar keys address deployer)

# ─── Деплой NabokaToken ───
TOKEN_A=$(stellar contract deploy \
    --wasm target/wasm32v1-none/release/naboka_token.wasm \
    --source deployer --network testnet -- --admin $DEPLOYER)


# ─── Адрес нативного XLM SAC ───
TOKEN_B=$(stellar contract id asset --asset native --network testnet)

# ─── Деплой LP Token (minter = pool) ───
LP_TOKEN=$(stellar contract deploy \
    --wasm target/wasm32v1-none/release/lp_token.wasm \
    --source deployer \
    --network testnet \
    -- --admin $DEPLOYER --minter $DEPLOYER)
    
    
# ─── Деплой Liquidity Pool ───
POOL=$(stellar contract deploy \
    --wasm target/wasm32v1-none/release/liquidity_pool.wasm \
    --source deployer --network testnet \
    -- --token_a $TOKEN_A \
    --token_b $TOKEN_B \
    --lp_token $LP_TOKEN)


# ─── Минт токенов для тестирования ───
stellar contract invoke --id $TOKEN_A --source deployer --network testnet \
    -- mint --to $DEPLOYER --amount 100000000000
```

### Шаг 4. Настройка фронтенда

Откройте `frontend/index.html` и вставьте адреса контрактов в объект `CONFIG`:

### Шаг 5. Деплой фронтенда (GitHub Pages)

https://aleksandra0kr.github.io/ekfhn/



| Контракт | Адрес |
|----------|-------|
| LP Token | https://stellar.expert/explorer/testnet/search?term=CCWEAFZNA7QXV3ADUL2DBYMTVA7DAYAQ5WMTGNFCALXYQGP2SGNFRVAZ |
| Liquidity Pool | https://stellar.expert/explorer/testnet/contract/CCFLHCOPTL7DQMANTPEVICRHYSAO2WOHNGFPXC3R357CTHIPDC3PCTCC |

---

## Скриншоты

1. Подключение кошелька
  
![alt text](https://github.com/aleksandra0KR/ekfhn/blob/master/img/1.png?raw=true)

2. Добавление ликвидности
   
   ![alt text](https://github.com/aleksandra0KR/ekfhn/blob/master/img/2.png?raw=true)
   ![alt text](https://github.com/aleksandra0KR/ekfhn/blob/master/img/3.png?raw=true)
   ![alt text](https://github.com/aleksandra0KR/ekfhn/blob/master/img/4.png?raw=true)

3. Выполнение swap
   
   ![alt text](https://github.com/aleksandra0KR/ekfhn/blob/master/img/5.png?raw=true)
   ![alt text](https://github.com/aleksandra0KR/ekfhn/blob/master/img/6.png?raw=true)
   ![alt text](https://github.com/aleksandra0KR/ekfhn/blob/master/img/7.png?raw=true)

4. Перевод токенов
   ![alt text](https://github.com/aleksandra0KR/ekfhn/blob/master/img/8.png?raw=true)
   ![alt text](https://github.com/aleksandra0KR/ekfhn/blob/master/img/9.png?raw=true)
   ![alt text](https://github.com/aleksandra0KR/ekfhn/blob/master/img/10.png?raw=true)
   ![alt text](https://github.com/aleksandra0KR/ekfhn/blob/master/img/11.png?raw=true)
   ![alt text](https://github.com/aleksandra0KR/ekfhn/blob/master/img/12.png?raw=true)

