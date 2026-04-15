# ВИДЕО С ЗАЩИТОЙ https://disk.yandex.ru/i/cN9vnW4_knohHA

# NabokaDEX — Децентрализованный обменник на Stellar/Soroban

> **Лабораторная работа №3** — Разработка Web3 приложения  
> **Лабораторная работа 4** - Межсетевой мост/оракул для кросс-чейн взаимодействия

---

## Состав группы

| ФИО         |
|-------------|
| Крючкова АВ | 
| Крамской ВВ | 
| Васильев КВ |  

## Деплой naboka_token (обновлённый)

```bash

cd contracts/naboka_token

cargo build --target wasm32v1-none --release
```

### Деплой на testnet NABOKA_TOKEN_CONTRACT

```bash
TOKEN_A=$(stellar contract deploy \
    --wasm target/wasm32v1-none/release/naboka_token.wasm \
    --source deployer --network testnet -- --admin $DEPLOYER)
    
```

# Создаём keypair оракула:

```bash

stellar keys generate oracle --network testnet

stellar keys address oracle

BRIDGE_ADMIN=$(stellar keys address oracle)

```

## Деплой wrapped_spl WRAPPED_SPL_CONTRACT

```bash
cd contracts/wrapped_spl

cargo build --target wasm32v1-none --release

```

### Деплой

```bash
stellar contract deploy \
--wasm target/wasm32v1-none/release/wrapped_sql.wasm \
--source deployer \
--network testnet \
-- --admin $DEPLOYER \
--bridge_admin $BRIDGE_ADMIN
```







## Запуск

```bash
cd oracle

# Запуск
npm start
```

```
stellar contract invoke \
--id CDNYQ3QMMHMOPZVYPYOBQ4BJ5HKTY5A4Q3F7LEY35JRB7T6XHZU5LWCJ \
--source deployer \
--network testnet \
-- \
lock \
--from GBJ4QI5VW32TBVCP7EEYIWETWLVSGFVXGC6MQD4VRK27ATNQQUOB6XZN \
--amount 22222 \
--target_sol_addr "BVmyHysSWcz8fnx25CcHH2PW6smWka1S7oSfeTsuh5j9"
```

```
stellar contract invoke \
--id CAPJPYGNODNA7VGCK35V7XUNANEEOV3HK2PV6MX3ZQ7RBWP2DB3AWCEK \
--source deployer \
--network testnet \
-- \
balance \
--id GBJ4QI5VW32TBVCP7EEYIWETWLVSGFVXGC6MQD4VRK27ATNQQUOB6XZN
```

```
stellar contract invoke \
--id CAPJPYGNODNA7VGCK35V7XUNANEEOV3HK2PV6MX3ZQ7RBWP2DB3AWCEK \
--source deployer \
--network testnet \
-- \
bridge_burn \
--from GBJ4QI5VW32TBVCP7EEYIWETWLVSGFVXGC6MQD4VRK27ATNQQUOB6XZN \
--amount 222 \
--target_sol_addr "BVmyHysSWcz8fnx25CcHH2PW6smWka1S7oSfeTsuh5j9"
```

```
stellar contract invoke \
--id CAPJPYGNODNA7VGCK35V7XUNANEEOV3HK2PV6MX3ZQ7RBWP2DB3AWCEK \
--source deployer \
--network testnet \
-- \
balance \
--id GBJ4QI5VW32TBVCP7EEYIWETWLVSGFVXGC6MQD4VRK27ATNQQUOB6XZN
```


![67](https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExcmRyNW1jbGI2Mng5ZHZibDBkbmR6ZDNrZ2tjNTJyZ2xjYTB1M2w0YyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/da543xrbipZPceuf8a/giphy.gif)


