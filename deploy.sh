#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  deploy.sh — Сборка и деплой всех контрактов в Stellar Testnet
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

NETWORK="testnet"
RPC="https://soroban-testnet.stellar.org"
PASSPHRASE="Test SDF Network ; September 2015"

# ─── Цвета для вывода ───
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     NabokaDEX — Contract Deployment        ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"

# ─── 1. Проверяем наличие stellar-cli ───
if ! command -v stellar &> /dev/null; then
    echo -e "${YELLOW}stellar CLI не найден. Устанавливаем...${NC}"
    cargo install --locked stellar-cli
fi

# ─── 2. Настройка аккаунта (если нет) ───
if ! stellar keys show deployer 2>/dev/null; then
    echo -e "${YELLOW}Создаём аккаунт 'deployer'...${NC}"
    stellar keys generate deployer --network $NETWORK
    echo -e "${GREEN}Аккаунт создан. Запрашиваем тестовые XLM через friendbot...${NC}"
    stellar keys fund deployer --network $NETWORK
fi

DEPLOYER=$(stellar keys address deployer)
echo -e "${GREEN}Deployer: ${DEPLOYER}${NC}"

# ─── 3. Сборка контрактов ───
echo -e "\n${CYAN}Сборка контрактов...${NC}"
stellar contract build

echo -e "${GREEN}Сборка завершена!${NC}"

# ─── 4. Деплой NabokaToken ───
echo -e "\n${CYAN}Деплой NabokaToken...${NC}"
TOKEN_A=$(stellar contract deploy \
    --wasm target/wasm32-unknown-unknown/release/naboka_token.wasm \
    --source deployer \
    --network $NETWORK)
echo -e "${GREEN}NabokaToken: ${TOKEN_A}${NC}"

# Инициализация токена
stellar contract invoke \
    --id $TOKEN_A \
    --source deployer \
    --network $NETWORK \
    -- \
    __constructor \
    --admin $DEPLOYER \
    --decimal 7 \
    --name "NabokaToken" \
    --symbol "NT"

echo -e "${GREEN}NabokaToken инициализирован${NC}"

# ─── 5. Деплой Liquidity Pool (нужен адрес для LP minter) ───
echo -e "\n${CYAN}Деплой LiquidityPool...${NC}"

# Получаем адрес SAC для нативного XLM
TOKEN_B=$(stellar contract id asset --asset native --network $NETWORK)
echo -e "${GREEN}Native XLM SAC: ${TOKEN_B}${NC}"

POOL=$(stellar contract deploy \
    --wasm target/wasm32-unknown-unknown/release/liquidity_pool.wasm \
    --source deployer \
    --network $NETWORK)
echo -e "${GREEN}LiquidityPool: ${POOL}${NC}"

# ─── 6. Деплой LP Token с minter = pool ───
echo -e "\n${CYAN}Деплой LP Token...${NC}"
LP_TOKEN=$(stellar contract deploy \
    --wasm target/wasm32-unknown-unknown/release/lp_token.wasm \
    --source deployer \
    --network $NETWORK)
echo -e "${GREEN}LP Token: ${LP_TOKEN}${NC}"

# Инициализация LP Token
stellar contract invoke \
    --id $LP_TOKEN \
    --source deployer \
    --network $NETWORK \
    -- \
    __constructor \
    --admin $DEPLOYER \
    --minter $POOL

echo -e "${GREEN}LP Token инициализирован (minter = pool)${NC}"

# ─── 7. Инициализация пула ───
echo -e "\n${CYAN}Инициализация пула...${NC}"
stellar contract invoke \
    --id $POOL \
    --source deployer \
    --network $NETWORK \
    -- \
    __constructor \
    --token_a $TOKEN_A \
    --token_b $TOKEN_B \
    --lp_token $LP_TOKEN

echo -e "${GREEN}Пул инициализирован!${NC}"

# ─── 8. Минтим токены для тестирования ───
echo -e "\n${CYAN}Минтим 10,000 NT на аккаунт deployer...${NC}"
stellar contract invoke \
    --id $TOKEN_A \
    --source deployer \
    --network $NETWORK \
    -- \
    mint \
    --to $DEPLOYER \
    --amount 100000000000  # 10000 * 10^7

echo -e "${GREEN}Готово!${NC}"

# ─── 9. Вывод конфигурации для фронтенда ───
echo -e "\n${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${CYAN}  КОНФИГУРАЦИЯ ДЛЯ frontend/index.html     ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo ""
echo -e "  tokenA:  '${GREEN}${TOKEN_A}${NC}',"
echo -e "  tokenB:  '${GREEN}${TOKEN_B}${NC}',"
echo -e "  lpToken: '${GREEN}${LP_TOKEN}${NC}',"
echo -e "  pool:    '${GREEN}${POOL}${NC}',"
echo ""
echo -e "${YELLOW}Скопируйте эти адреса в CONFIG в файле frontend/index.html${NC}"
echo ""

# Сохраняем адреса в файл
cat > .contract-addresses.env <<EOF
TOKEN_A=${TOKEN_A}
TOKEN_B=${TOKEN_B}
LP_TOKEN=${LP_TOKEN}
POOL=${POOL}
DEPLOYER=${DEPLOYER}
EOF

echo -e "${GREEN}Адреса сохранены в .contract-addresses.env${NC}"
echo -e "\n${GREEN}═══ Деплой завершён успешно! ═══${NC}"
