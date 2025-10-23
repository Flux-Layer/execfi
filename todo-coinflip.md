# CoinFlip On-Chain Integration TODO

## Smart Contracts
- [ ] Finalize gameplay requirements (bet limits, payout table, randomness/oracle strategy)
- [x] Scaffold `CoinFlipGame` contract mirroring Degenshoot result verification
- [x] Decide on vault approach (re-use `WagerVault` or create `CoinFlipVault`) and implement wager settlement
- [x] Write Foundry tests for bet placement, outcome settlement, fee path, and pause/role controls
- [x] Extend deployment scripts + config to deploy CoinFlip game + vault and register addresses

## Game Signer Service
- [ ] Decide randomness strategy for the signer (e.g. secure PRNG with seed rotation)
- [ ] Implement signer service to observe sessions and submit signed coin flip outcomes
- [ ] Add monitoring/alerting for signer availability and treasury balances

## Backend API Layer
- [x] Create session store + models for CoinFlip rounds (seed, wager, result)
- [x] Implement `/coinflip/start` to allocate session seeds and return layout/config
- [x] Implement `/coinflip/action` to register wagers and orchestrate flip/playback
- [x] Implement `/coinflip/reveal` for fairness proof (server/client seed reveal)
- [x] Implement `/coinflip/sign` to EIP-712 sign result + XP payloads
- [x] Persist coin flip history in DB and expose `/coinflip/history`
- [ ] Add cron/cleanup endpoints mirroring Degenshoot session lifecycle

## Frontend Integration
- [x] Add coin flip contract ABIs/types + viem clients
- [ ] Build coin flip hook (session management, on-chain bet flow, history)
- [x] Wire `CoinFlipGame.tsx` to backend/on-chain flow with loading/error states
- [ ] Add toast/notification + XP feedback for completed flips

## Testing & QA
- [ ] Mock oracle + vault for integration tests across API + hook
- [ ] Run end-to-end manual and automated tests on testnet (win, loss, edge cases)
- [ ] Perform security review and document assumptions (randomness, signer custody)

## Launch Prep
- [x] Update address registry, env vars, and wagmi config for CoinFlip contracts
- [ ] Document gameplay, oracle flow, payout math in `greenvale.md`
- [ ] Plan treasury funding + monitoring handoff + support playbook
