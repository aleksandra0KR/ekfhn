# NabokaDEX — Децентрализованный обменник на Stellar/Soroban

> **Лабораторная работа №3** — Разработка Web3 приложения  
> **Вариант 3** — Простой пул ликвидности (аналог Uniswap V2)

---

## Состав группы

| ФИО | Публичный адрес |
|-----|-----------------|
| Набока ... | `G...` |
| ... | `G...` |

**ChainId**: Stellar Testnet (`Test SDF Network ; September 2015`)

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
- **Slippage protection** — защита от проскальзывания цены

---

## Архитектура

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  NabokaToken │    │   LP Token   │    │   Native XLM │
│  (Token A)   │    │   (NLP)      │    │   SAC (B)    │
│  ERC-20 like │    │  mint/burn   │    │  Stellar     │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────┬───────┘───────────────────┘
                   │
           ┌───────▼────────┐
           │ Liquidity Pool │
           │                │
           │ • add_liquidity│
           │ • remove_liq.  │
           │ • swap_a_to_b  │
           │ • swap_b_to_a  │
           │ • quote_*      │
           │ • get_reserves │
           └───────┬────────┘
                   │
           ┌───────▼────────┐
           │   Frontend     │
           │ (index.html)   │
           │                │
           │ Freighter      │
           │ + stellar-sdk  │
           └────────────────┘
```

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

## Структура проекта

```
stellar-dex/
├── Cargo.toml                          # Workspace
├── deploy.sh                           # Скрипт деплоя
├── README.md
│
├── contracts/
│   ├── naboka-token/                   # Токен из ЛР-2
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       └── test.rs
│   │
│   ├── lp-token/                       # LP-токен
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       └── test.rs
│   │
│   └── liquidity-pool/                 # Контракт пула (AMM)
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           └── test.rs
│
└── frontend/
    └── index.html                      # dApp (SPA)
```

---

## Пошаговая инструкция

### Предварительные требования

```bash
# 1. Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# 2. Stellar CLI
cargo install --locked stellar-cli

# 3. Freighter (расширение для браузера)
# https://freighter.app
```

### Шаг 1. Клонирование и сборка

```bash
git clone <your-repo-url>
cd stellar-dex
stellar contract build
```

Это скомпилирует все три контракта в WASM:
```
target/wasm32-unknown-unknown/release/naboka_token.wasm
target/wasm32-unknown-unknown/release/lp_token.wasm
target/wasm32-unknown-unknown/release/liquidity_pool.wasm
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

Можно использовать готовый скрипт:

```bash
chmod +x deploy.sh
./deploy.sh
```

Или вручную:

```bash
DEPLOYER=$(stellar keys address deployer)

# ─── Деплой NabokaToken ───
TOKEN_A=$(stellar contract deploy \
    --wasm target/wasm32v1-none/release/naboka_token.wasm \
    --source deployer --network testnet --admin $DEPLOYER)


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

```javascript
const CONFIG = {
  network: 'testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  tokenA:  '<ВСТАВЬТЕ_АДРЕС_TOKEN_A>',
  tokenB:  '<ВСТАВЬТЕ_АДРЕС_TOKEN_B>',
  lpToken: '<ВСТАВЬТЕ_АДРЕС_LP_TOKEN>',
  pool:    '<ВСТАВЬТЕ_АДРЕС_POOL>',
  decimalsA: 7,
  decimalsB: 7,
  decimalsLP: 7,
};
```

### Шаг 5. Деплой фронтенда (GitHub Pages)

```bash
# В корне репозитория:
git add .
git commit -m "NabokaDEX: contracts + frontend"
git push origin main

# В настройках GitHub репозитория:
# Settings → Pages → Source: Deploy from branch → /frontend (или /docs)
```

Либо через **Render.com** (Static Site):
1. Подключите GitHub-репозиторий
2. Build Command: оставьте пустым
3. Publish Directory: `frontend`

### Шаг 6. Тестирование

1. Откройте dApp в браузере
2. Установите и настройте **Freighter** на Testnet
3. Нажмите «Подключить Freighter»
4. Добавьте ликвидность (например, 1000 NT + 100 XLM)
5. Выполните swap NT → XLM
6. Проверьте обновление балансов и резервов

---

## Верифицированные контракты

| Контракт | Адрес |
|----------|-------|
| NabokaToken | `C...` |
| LP Token | `C...` |
| Liquidity Pool | `C...` |

**Обозреватель**: https://stellar.expert/explorer/testnet

---

## Ссылка на приложение

🔗 **[NabokaDEX Live](https://<username>.github.io/stellar-dex/)**

---

## Скриншоты

*(добавьте скриншоты работающего приложения)*

1. Подключение кошелька
2. Добавление ликвидности
3. Выполнение swap
4. Перевод токенов
5. Обновление балансов

---

## Технологии

- **Stellar / Soroban** — блокчейн и смарт-контракты
- **Rust** — язык контрактов
- **soroban-sdk 22** — SDK для Soroban
- **Freighter** — кошелёк Stellar для браузера
- **stellar-sdk.js** — JavaScript SDK для взаимодействия
- **GitHub Pages** — хостинг фронтенда
