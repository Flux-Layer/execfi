# CoinFlip Integration Notes

## Overview
- On-chain coin flip mini game that mirrors the Degenshoot signer flow.
- Game ID: **4** (registered on Base Sepolia XP Registry).
- Uses new `CoinFlipGame` (EIP-712 result verifier) and `CoinFlipVault` (wager escrow + payouts).

## Contract Addresses (Base Sepolia – chain 84532)
- `CoinFlipGame`: `0xF482E528595d3C17aD5968b098c89Eb7f58D42Bd`
- `CoinFlipVault`: `0x5C36382d356B5611ef27680D7Be44ef61ddfbC36`

Contracts deployed and verified with:
```bash
cd contracts
forge script script/coinflip/DeployCoinFlip.s.sol \
  --rpc-url $RPC_URL_BASE_SEPOLIA \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

Game registered in XP Registry via:
```bash
cd contracts
forge script script/coinflip/RegisterCoinFlipGame.s.sol \
  --rpc-url $RPC_URL_BASE_SEPOLIA \
  --broadcast
```

## Relevant Environment Variables
Populate on both `contracts/.env` and app `.env` files:
- `COINFLIP_GAME_ID=4`
- `COINFLIP_SIGNER_ADDRESS` / `COINFLIP_SIGNER_PRIVATE_KEY`
- `COINFLIP_TREASURY_ADDRESS`
- `COINFLIP_HOUSE_FEE_BPS`
- `COINFLIP_SERVER_SEED`, `COINFLIP_SERVER_SEED_EPOCH`
- Frontend: `NEXT_PUBLIC_COINFLIP_ADDRESS`, `NEXT_PUBLIC_COINFLIP_VAULT_ADDRESS`, `NEXT_PUBLIC_COINFLIP_CHAIN_ID`, `NEXT_PUBLIC_COINFLIP_GAME_ID`

## Backend TODO
- [x] Implement `/api/coinflip/start` + session store hookup (seed allocation, fairness metadata).
- [x] Implement `/api/coinflip/action` for wager registration, flip reveals, cash out.
- [x] Implement `/api/coinflip/reveal` to expose seeds/bomb data once round finalises.
- [x] Implement `/api/coinflip/sign` to generate EIP-712 signatures (reuse Degenshoot signing helpers).
- [x] Persist flip history in Prisma (`coinflip_history`) and expose `/api/coinflip/history`.
- [ ] Update cron/cleanup routines for coin flip sessions.

## Frontend TODO
- [ ] Create `useCoinFlipGameState` hook (mirroring bomb game) to orchestrate backend calls & vault interactions.
- [x] Wire `CoinFlipGame.tsx` to backend/on-chain flow with loading/error states.
- [x] Add coin flip addresses to `src/lib/contracts/addresses.ts`, wagmi config, and UI registry.
- [ ] UX polish: transaction toasts, error states, history sync with backend.

## Signer/Service Plan
- [ ] Extend the signer service to generate random outcomes, sign `CoinFlipGame.Result`, and rotate seeds.
- [ ] Monitoring: track signer availability, vault liquidity, and XP registry submissions.

## Ops / Docs
- Update this file whenever contract addresses or major flows change.
- Consider snapshotting Base Sepolia deployment artifacts for audit trail (`contracts/broadcast/coinflip/DeployCoinFlip.s.sol/...`).
