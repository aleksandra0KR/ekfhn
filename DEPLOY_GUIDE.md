# Гайд по деплою моста — пошагово с командами

---

## Предварительно — проверь что всё установлено

```bash
stellar --version        # должно быть >= 0.0.53
rustup target list --installed | grep wasm32v1-none
# если нет wasm32 — устанавливаешь:
rustup target add wasm32v1-none
```

---

## ШАГ 1 — Деплой naboka_token (обновлённый)

Это твой основной токен, в который добавили lock/release/set_bridge_admin.

### 1.1 — Компиляция

```bash
# Переходишь в папку контракта
cd contracts/naboka_token

# Компилируешь в wasm
cargo build --target wasm32v1-none --release
```

Wasm файл появится по пути:
`target/wasm32v1-none/release/naboka_token.wasm`

### 1.2 — Деплой на testnet

```bash
TOKEN_A=$(stellar contract deploy \
    --wasm target/wasm32v1-none/release/naboka_token.wasm \
    --source deployer --network testnet -- --admin $DEPLOYER)
    
```

> `--source admin` — это имя твоего keypair в stellar CLI.
> Если называется иначе — подставь своё имя.
> Посмотреть список: `stellar keys ls`

Вывод будет выглядеть так:
```
CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```
**Копируешь этот ID — это новый NABOKA_TOKEN_CONTRACT.**

### 1.3 — Инициализация контракта

```bash
stellar contract invoke \
  --id $TOKEN_A  \
  --source admin \
  --network testnet \
  -- \
  __constructor \
  --admin $DEPLOYER
  
  
  
  
```
cargo build --target wasm32v1-none --release


stellar contract deploy \
--wasm target/wasm32v1-none/release/wrapped_sql.wasm \
--source deployer \
--network testnet \
-- --admin $DEPLOYER \
--bridge_admin $BRIDGE_ADMIN
#
WRAPPED_SPL_CONTRACT=CC2PDJVLDGE4SVDMWJ6KUB3G3CGHBDR6IIIZVU2BRTZJXV2PI4GXZJJL

> `$DEPLOYE` — твой публичный адрес admin keypair.
> Посмотреть: `stellar keys address admin`

---

## ШАГ 2 — Деплой wrapped_spl

Это новый контракт — wrapped токен для SPL партнёров на Stellar.

### 2.1 — Компиляция

```bash
cd contracts/wrapped_spl

cargo build --target wasm32v1-none --release
```

### 2.2 — Деплой

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/wrapped_spl.wasm \
  --source admin \
  --network testnet
```

Аналогично — получаешь ID вида `CYYY...`.
**Копируешь — это WRAPPED_SPL_CONTRACT.**

### 2.3 — Инициализация

Здесь передаём два аргумента: admin и bridge_admin (оракул).

Сначала узнаём адрес оракула:
```bash
# Если keypair оракула ещё не создан — создаём:
stellar keys generate oracle --network testnet

# Смотрим G... адрес оракула:
stellar keys address oracle
```

Запомни этот G... адрес — назовём его GORACLE.

Теперь инициализируем wrapped_spl:
```bash
stellar contract invoke \
  --id CYYY... \
  --source admin \
  --network testnet \
  -- \
  __constructor \
  --admin $DEPLOYE \
  --bridge_admin GORACLE...
```

---

## ШАГ 3 — Прописываем bridge_admin

### 3.1 — На naboka_token

Вызываем set_bridge_admin — говорим контракту что оракул
имеет право вызывать release():

```bash
stellar contract invoke \
  --id $TOKEN_A \
  --source admin \
  --network testnet \
  -- \
  set_bridge_admin \
  --bridge_admin GORACLE...
```

Проверяем что записалось:
```bash
stellar contract invoke \
  --id $TOKEN_A \
  --source admin \
  --network testnet \
  -- \
  bridge_admin
```

Должен вывести тот же GORACLE адрес.

### 3.2 — Проверяем wrapped_spl

Wrapped_spl получил bridge_admin ещё при инициализации в шаге 2.3.
Но проверить не помешает:

```bash
stellar contract invoke \
  --id CYYY... \
  --source admin \
  --network testnet \
  -- \
  bridge_admin
```

---

## ШАГ 4 — Кладём simple_token.json в оракул

Этот файл у тебя уже есть — партнёры прислали в самом начале.

```bash
# Создаём папку idl внутри оракула
mkdir -p oracle/src/idl

# Копируем файл (путь подставь свой — где лежит simple_token.json)
cp simple_token.json oracle/src/idl/simple_token.json
```

---

## ШАГ 5 — Кладём заглушку wrapped_naboka.json

Пока партнёры не задеплоили — используем заглушку.
Создаём файл вручную:

```bash
cat > oracle/src/idl/wrapped_naboka.json << 'EOF'
{
  "version": "0.1.0",
  "name": "wrapped_naboka",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [],
      "args": [{ "name": "bridgeAdmin", "type": "publicKey" }]
    },
    {
      "name": "mintWrapped",
      "accounts": [],
      "args": [
        { "name": "amount", "type": "u64" },
        { "name": "mintAuthBump", "type": "u8" }
      ]
    },
    {
      "name": "burnWrapped",
      "accounts": [],
      "args": [
        { "name": "amount", "type": "u64" },
        { "name": "targetStellarAddr", "type": "string" }
      ]
    }
  ],
  "accounts": [
    {
      "name": "WrappedState",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "bridgeAdmin",  "type": "publicKey" },
          { "name": "mint",         "type": "publicKey" },
          { "name": "totalMinted",  "type": "u64" },
          { "name": "totalBurned",  "type": "u64" },
          { "name": "bump",         "type": "u8" },
          { "name": "mintAuthBump", "type": "u8" }
        ]
      }
    }
  ],
  "events": [
    {
      "name": "WrappedMinted",
      "fields": [
        { "name": "recipient", "type": "publicKey", "index": false },
        { "name": "amount",    "type": "u64",       "index": false }
      ]
    },
    {
      "name": "WrappedBurned",
      "fields": [
        { "name": "user",              "type": "publicKey", "index": false },
        { "name": "amount",            "type": "u64",       "index": false },
        { "name": "targetStellarAddr", "type": "string",    "index": false }
      ]
    }
  ],
  "metadata": {
    "address": "ЗАМЕНИТЕ_КОГДА_ПАРТНЁРЫ_ЗАДЕПЛОЯТ"
  }
}
EOF
```

---

## ШАГ 6 — Заполняем .env

```bash
cd oracle

# Копируем шаблон
cp .env.example .env
```

Открываешь `.env` в редакторе и заполняешь:

```bash
# Stellar
STELLAR_RPC=https://soroban-testnet.stellar.org
STELLAR_NETWORK=Test SDF Network ; September 2015

# Твои контракты (из шагов 1.2 и 2.2)
NABOKA_TOKEN_CONTRACT=$TOKEN_A
WRAPPED_SPL_CONTRACT=CYYY...

# Secret key оракула — смотришь так:
# stellar keys show oracle
# Выведет S... строку — вставляешь сюда
ORACLE_STELLAR_SECRET=SXXXXXXX...

# Solana (заполнишь когда партнёры дадут)
SOLANA_RPC=https://api.devnet.solana.com
SIMPLE_TOKEN_PROGRAM=EoiNSmdNamtxj6dfbf7abHbgj5smoMrr4GmmzngDwCPa
WRAPPED_NABOKA_PROGRAM=ЗАМЕНИТЕ_ПОЗЖЕ

# Путь к keypair оракула на Solana (создать в шаге 7)
ORACLE_SOLANA_KEYPAIR_PATH=./oracle-solana.json
```

Как получить ORACLE_STELLAR_SECRET:
```bash
stellar keys show oracle
# Выводит secret key вида S...
```
stellar contract invoke   --id CC7VPLSUQRTGPFJCNXF7J3ZTAAVQTMS7FEPOBYL7PI2TNCQHG3WGLHUN   --source deployer   --network testnet   --   lock   --from $(stellar keys address deployer)   --amount 10000   --target_sol_addr "BVmyHysSWcz8fnx25CcHH2PW6smWka1S7oSfeTsuh5j9"
---

## ШАГ 7 — npm install и создаём Solana keypair оракула

```bash
cd oracle

# Устанавливаем зависимости
npm install

# Создаём keypair оракула на Solana
# (нужен для подписи транзакций на Solana стороне)
solana-keygen new -o oracle-solana.json --no-bip39-passphrase

# Смотрим публичный ключ — отдаёшь партнёрам
solana-keygen pubkey oracle-solana.json
```

Этот публичный ключ партнёры пропишут как bridge_admin
в своём wrapped_naboka при инициализации.

---

## Проверка что всё работает

```bash
cd oracle

# Запуск
npm start
```

Должно вывести:
```
═══════════════════════════════════════
  Naboka Bridge Oracle started
═══════════════════════════════════════
[stellar-listener] watching NabokaToken lock events...
[stellar-listener] watching WrappedSPL bridge_burn events...
[solana-listener] watching SimpleToken lock events...
[solana-listener] watching WrappedNaboka burn events...
```

Если видишь эти строки — оракул запущен и слушает оба блокчейна.

---

## Когда партнёры дадут свои данные

Просто обновляешь две строки в .env:
```bash
WRAPPED_NABOKA_PROGRAM=реальный_program_id
```

И заменяешь заглушку на реальный IDL:
```bash
cp путь/к/wrapped_naboka.json oracle/src/idl/wrapped_naboka.json
```

Перезапускаешь:
```bash
npm start
```

Всё. Больше ничего менять не нужно.

---

## Итоговая структура что должно получиться

```
твой-репо/
├── contracts/
│   ├── naboka_token/lib.rs    ← обновлён, задеплоен → CXXXXXXX
│   ├── wrapped_spl/lib.rs     ← новый, задеплоен   → CYYY
│   ├── naboka_lp/lib.rs       ← не трогали
│   └── liquidity_pool/lib.rs  ← не трогали
└── oracle/
    ├── src/
    │   ├── idl/
    │   │   ├── simple_token.json     ← от партнёров
    │   │   └── wrapped_naboka.json   ← от партнёров (пока заглушка)
    │   ├── config.ts
    │   ├── index.ts
    │   ├── stellar-listener.ts
    │   ├── stellar-minter.ts
    │   ├── solana-listener.ts
    │   └── solana-minter.ts
    ├── oracle-solana.json   ← keypair оракула (НЕ коммитить в git!)
    ├── .env                 ← секреты (НЕ коммитить в git!)
    ├── package.json
    └── tsconfig.json
```

Добавь в .gitignore:
```
oracle/.env
oracle/oracle-solana.json
```
