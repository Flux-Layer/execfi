# ExecFi Gaming Hub — Hackathon Playbook

## Introduction

### ExecFi OS Overview
ExecFi is a consumer crypto gaming hub delivered through a retro desktop interface. By combining Privy-managed email login with Base smart accounts, players receive instant wallets, and build persistent progress across every mini-game.

### Vision & Mission
- **Play first, learn crypto later** — zero-friction onboarding for mainstream players.
- **Shared progression layer** — unified onchain XP registry that spans all games.
- **Transparent and fair** — provably fair randomness, explorer-linked history, and auditable contracts.

### Product Pillars
- Retro “ExecFi OS” UX (dock, draggable windows, status bar, terminal).
- Modular game nodes that plug into the same account, XP, and vault infrastructure.

### Use Cases
- Casual players exploring onchain gaming safely.
- Communities, guilds, or influencers that want to host verifiable mini tournaments. Every round is recorded with transaction hashes and fairness data so participants can verify results, while the shared XP ecosystem keeps prizes and leaderboards consistent.

## Guide

### Getting Started
1. Launch ExecFi OS and explore the retro desktop interface with dock shortcuts and status bar.  
2. Tap **Connect** to authenticate via Privy; a Base smart account is created instantly.  
3. Open **Degen Shooter** or **CoinFlip** from the dock or desktop shortcut.  
4. Complete a run and watch rewards plus XP appear in the status bar tooltip.  
5. Review explorer links embedded in the history modules for proof and transparency.

### Game Modules
- **🧨 Degen Shooter** – commit/reveal fairness with escalating multipliers and instant vault settlements.
- **🪙 CoinFlip** – quick wagers driven by hashed randomness and automatic payouts.
- **🦠 Mallware** – roguelike virus-hunting quest that blends narrative events with XP-driven progression.
- **🖥️ ExecFi Terminal** – AI-powered prompt interface that can transfer, swap, and bridge assets without ever leaving the OS window.

### Development Flow
ExecFi runs as a Next.js experience backed by Privy and Base smart accounts. Configure environment variables (Privy credentials, Base RPC URL, session TTL, signing keys) as described in the repository README to bring the stack online during development.

### Demo Checklist
- ✅ Privy email login — no wallet extension required.  
- ✅ Play Degen Shooter → show XP gain + explorer hash.  
- ✅ Execute CoinFlip → verify fairness endpoint response.  
- ✅ Highlight responsive UI (status bar, dock) and unified XP tooltip.  

## Resources

### Technical Stack
- Modern React front end with TailwindCSS styling and Framer Motion animations.  
- Privy-provisioned Base smart accounts enabling gasless gameplay.  
- Session stores and XP registry for persistent player progression.  
- Explorer-facing history views for verifiable transparency.

### Contract Addresses

| Component | Address | Chain |
| --- | --- | --- |
| XP Registry Proxy | `0x9bab7f308aCCAe41eaF3ABFeEB58A16804632a3a` | Base Sepolia |
| Degenshoot Game | `0x1A6cE0f638e492F6D24f91BB9d880b2F9a704eC5` | Base Sepolia |
| Degenshoot Vault | `0x9A411f318A117caedB3643Db00FEFbD31B0d5f1C` | Base Sepolia |
| CoinFlip Game | `0xC681A5124eD27f3cfD7a902002C5A407cdE331F5` | Base Sepolia |
| CoinFlip Vault | `0x97955aD9b17D079B0503D6848b4e8B6F51fE222c` | Base Sepolia |

### Experience & Fairness Highlights
- Unified XP registry keeps progress visible in the status bar tooltip.  
- Commit–reveal randomness allows anyone to audit finished rounds.  
- History cards link directly to explorer transactions for wagers, results, and withdrawals.  
- Retro desktop UI (dock, status bar, terminal) ensures consistent multi-game navigation.

### Security
Coming soon.

### Roadmap
Coming soon.

## External Links

- **Website** – https://execfi.xyz  
- **GitHub Repository** – https://github.com/Flux-Layer/execfi

---
