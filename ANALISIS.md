# Analisis End‑to‑End Kode Basis

Dokumen ini merangkum arsitektur, alur end‑to‑end, modul utama, API, UI/State, dependensi, environment variables, serta cara menjalankan proyek Anda.

## Ringkasan Proyek

- Framework: `Next.js 15` (App Router, TypeScript)
- UI: React 19, Tailwind (via postcss), framer-motion/motion
- Web3: Privy (auth + smart wallets), wagmi + viem
- DeFi: Integrasi LI.FI SDK untuk routes/quotes/status dan pencarian token multi‑provider
- State: Store internal (CLI/HSM) + React Query
- AI: Parsing intent via OpenRouter (GPT‑4o‑mini) ke skema Zod
- Tujuan: “Terminal” interaktif untuk mengubah natural language menjadi aksi on‑chain (transfer, swap/bridge roadmap) dengan Smart Account Privy.

## Struktur Proyek (tingkat tinggi)

- `src/app` — Halaman Next.js, root layout, dan API routes
  - `src/app/page.tsx:1` — Halaman utama dengan komponen Terminal dan Notes
  - `src/app/layout.tsx:1` — Provider tree: Privy, EOA, Dock, Chain, Wagmi, React Query, Toaster
  - `src/app/execfi/page.tsx:1` — Laman dokumentasi ringkas ExecFi
  - `src/app/api/*` — Endpoints server: intent, tokens, lifi (quote/prepare/status/routes), relay, swap, balance, prompt
- `src/components` — UI (terminal, dock, loader, dsb.)
- `src/cli` — Mesin perintah terminal (parser, commands, state, effects, views)
- `src/lib` — Integrasi dan util inti: LI.FI client, token query engine, AI prompts/schema, chains registry, utils
- `src/hooks` — Hook wallet/smart account, session signer, chain selection
- `src/providers` — Providers: Privy, Wagmi, React Query, EOA context
- `src/constants` — Konstanta, chainIds, meta‑prompt
- `src/types` — Tipe untuk token/provider/terminal
- `wagmiConfig.ts:1` — Konfigurasi wagmi berbasis registry chains

## Alur End‑to‑End (utama)

1) Pengguna membuka aplikasi dan login/siap via Privy
- Layout menginisialisasi provider: `src/app/layout.tsx:1`
- Dock menampilkan akses ke “Terminal” dan “Docs”

2) Pengguna mengetik prompt di Terminal
- UI terminal: `src/components/terminal/HSMPromptTerminal.tsx:1` (mengelola window/minimize/fullscreen, interaksi input melalui store CLI)
- Store/Effects untuk alur HSM/CLI: `src/cli/state/*`

3) Prompt → Parsing Intent (server)
- Frontend memanggil `POST /api/intent` dengan string prompt: `src/lib/ai/intent.ts:1`
- Endpoint `src/app/api/intent/route.ts:1` memanggil OpenRouter (`openai/gpt-4o-mini`) dengan system prompt ketat: `src/lib/ai/prompts.ts`
- Response AI di‑parse ke JSON terstruktur, diverifikasi shape dan skema Zod: `src/lib/ai/parse.ts`, `src/lib/ai/schema.ts:1`
- Hasil diskriminasi intent: success (transfer/swap/bridge), tokenSelection (ambigu), chat (non‑transaksi)

4) Normalisasi/Validasi/Simulasi/Eksekusi (kerangka)
- Komponen alur tersedia di `src/lib/*` dan `src/cli/effects/*` (normalize, validate, simulate, execute, monitor, idempotency)
- Untuk DeFi route/quote/status menggunakan LI.FI client: `src/lib/lifi-client.ts:1` (rate limiting, retry, validasi Zod)

5) Eksekusi transaksi
- Mode awal: transfer native/erc20 (roadmap swap/bridge)
- Smart Account Privy dan EOA: `src/hooks/useSmartWallet.tsx:1`, `src/providers/EOAProvider.tsx:1`
- Chain selection/switch: `src/hooks/useChainSelection.tsx:1` + registry: `src/lib/chains/registry.ts:1`

6) Monitoring dan feedback
- Status/monitor via LI.FI dan state CLI: `src/lib/monitor.ts`, `src/app/api/lifi/status/route.ts`
- UI menampilkan hasil, rekomendasi, explorer link/summary (komponen terminal)

## API Routes (server)

- `POST /api/intent` → Parsing intent via OpenRouter
  - File: `src/app/api/intent/route.ts:1`
  - Env: `OPENROUTER_API_KEY`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_PROJECT_ID`
  - Output: Discriminated union intent (success/tokenSelection/chat) tervalidasi Zod

- LI.FI endpoints (menggunakan `src/lib/lifi-client.ts:1`)
  - `GET /api/lifi/routes` — Rekomendasi rute (jika ada; lihat `src/app/api/lifi/routes/route.ts`)
  - `POST /api/lifi/quote` — Validasi kesegaran quote + analisis perbandingan rute: `src/app/api/lifi/quote/route.ts:1`
  - `GET /api/lifi/status` — Status transaksi: `src/app/api/lifi/status/route.ts`
  - `POST /api/lifi/prepare` — Persiapan eksekusi (jika diterapkan): `src/app/api/lifi/prepare/route.ts`

- Token search (multi‑provider)
  - `GET /api/tokens/search` — Query token gabungan: `src/app/api/tokens/search/route.ts` menggunakan `src/lib/token-query-engine.ts:1`
  - Provider: `src/lib/token-providers/*` (lifi, relay, local, coingecko)

- Lainnya
  - `GET /api/balance` — Info saldo (impl. simple): `src/app/api/balance/route.ts`
  - `POST /api/prompt` — Util prompt (opsional): `src/app/api/prompt/route.ts`
  - `POST /api/swap` — Stub alur swap: `src/app/api/swap/route.ts`
  - `POST /api/relay` — Stub relayer: `src/app/api/relay/route.ts`

Catatan: Beberapa route stub/lanjutan mungkin hanya kerangka/roadmap.

## Integrasi LI.FI (Client Kustom)

- File pusat: `src/lib/lifi-client.ts:1`
  - Konfigurasi: `LIFI_API_URL`, `LIFI_API_KEY`, rate limit per menit
  - `lifiRequest` dengan retry + exponential backoff + Zod validation
  - Wrapper SDK: `getRoutes`, `getTokens`, juga `getStatus`
  - `validateQuote(route)` membandingkan ulang rute untuk cek slippage/toleransi
  - `pickBestRoute(preference)` memilih rute tercepat/termurah/rekomendasi
  - `healthCheck()` memanggil endpoint ringan `/chains`

- Endpoint validasi quote: `src/app/api/lifi/quote/route.ts:1`
  - Input: `route`, opsi slippage/freshness/tools
  - Output: `valid`, `freshRoute`, `analysis` (perubahan harga, step/tools, durasi, rekomendasi)

## Pencarian Token Multi‑Provider

- Orkestrator: `src/lib/token-query-engine.ts:1`
  - Seleksi provider aktif, eksekusi paralel dengan timeout, agregasi hasil
  - Dedup, sort, limit, caching TTL
  - Output: `MultiProviderResult` dengan ringkasan per provider

- Provider registry: `src/lib/token-providers/registry.ts:1`
  - Provider: LiFi, Relay, Local, CoinGecko (tiap provider output ke `UnifiedToken`)

- Tipe menyatu: `src/types/unified-token.ts:1`, `src/types/provider-types.ts:1`

## Terminal CLI & State (HSM)

- Commands: `src/cli/commands/*` (core: help, whoami, balance, chain, token, transaction, session, registry, developer, contact)
- Parser & flags: `src/cli/commands/parser.ts:1`
- State & efek: `src/cli/state/{types,reducer,effects,events,flows,store}.ts`
  - `createStore` + DevTools integration, serializer BigInt aman
  - Tik internal untuk overlay cleanup
- Views: `src/cli/commands/views/*`, Renderer: `src/cli/render.ts`
- Komponen UI terminal: `src/components/terminal/*`

## Wallet, Chain, dan Provider

- Privy
  - Provider: `src/providers/privy-provider.tsx:1`
  - Smart Wallets: `@privy-io/react-auth/smart-wallets`, hook: `src/hooks/useSmartWallet.tsx:1`
  - EOA context: `src/providers/EOAProvider.tsx:1`, hook: `src/hooks/useEOA.ts:1`

- Wagmi/Viem
  - Konfigurasi Wagmi (global): `wagmiConfig.ts:1` berbasis `src/lib/chains/registry.ts:1`
  - Provider app sederhana: `src/providers/wagmi-provider.tsx:1` (chain Base default) dan `src/providers/query-client.provider.tsx:1`

- Chain selection
  - Hook & context: `src/hooks/useChainSelection.tsx:1` (persist localStorage, validasi chain, event listener `chain-switch-request`)
  - Registry chain dan token dasar per chain: `src/lib/chains/registry.ts:1`

## UI/UX

- Dock + Windowing: `src/components/dock/index.tsx:1`, context: `src/context/DockContext.tsx:1`
  - Terminal/Docs dapat dibuka/tutup/minimize/fullscreen (saling menonaktifkan saat fullscreen)
- Loader/Intro: `src/components/loader/*`, `src/app/layout.tsx:1` memunculkan overlay PathFinderLoader 5 detik pertama
- Notes window: `src/components/apps/ExecFiNotes.tsx:1` dan tampilan miniature saat minimized
- Terminal layout: header, chat history, current line, overlays

## Konfigurasi & Build

- `package.json:1`
  - Scripts: `dev`, `build`, `start`, `lint`
  - Dependencies: `@lifi/sdk`, `@privy-io/react-auth`, `@privy-io/wagmi`, `wagmi`, `viem`, `@tanstack/react-query`, `pino`, `zod`, `react-hot-toast`, dll.
- `next.config.ts:1` — Strict mode off; konfigurasi minimal
- `tsconfig.json:1` — Path alias: `@/*`, `@lib/*`, `@components/*`, dsb.
- `eslint.config.mjs:1` — Konfigurasi lint

## Environment Variables

Contoh pada `./.env.example:1` (tambahan lain digunakan di kode):

- UI/General
  - `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_PROJECT_ID`

- Privy & Smart Wallet
  - `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_PRIVY_CLIENT_ID` (atau SECRET untuk server)
  - `NEXT_PUBLIC_PRIVY_SESSION_SIGNER_IDS`, `NEXT_PUBLIC_PRIVY_SESSION_POLICY_IDS`

- RPC/Infra
  - `NEXT_PUBLIC_ALCHEMY_KEY`, `NEXT_PUBLIC_INFURA_KEY`

- DeFi/LI.FI
  - `LIFI_API_URL`, `LIFI_API_KEY` (server)
  - `NEXT_PUBLIC_LIFI_API_KEY` (client, di `src/services/lifiService.ts:1`)

- Harga/Sumber lain
  - `NEXT_PUBLIC_COIN_GECKO_API_KEY`

- OpenRouter (AI)
  - `OPENROUTER_API_KEY`

Pastikan untuk tidak mengekspos secret server‑only ke client.

## Cara Menjalankan Lokal

- Persiapan
  - Isi `.env` berdasarkan `.env.example`
  - Pastikan kunci OpenRouter/Privy/RPC siap jika ingin fitur lengkap

- Perintah
  - Development: `npm run dev`
  - Build: `npm run build`
  - Start (prod): `npm run start`

- Akses
  - Buka `http://localhost:3000`
  - Buka Terminal melalui Dock, coba perintah seperti: `send 0.01 ETH on base to 0x...` atau `/help`

## Validasi & Keandalan

- Validasi skema kuat (Zod) untuk intent dan LI.FI responses
- Rate limit & retry pada LI.FI client
- Idempotency guard (lihat `src/lib/idempotency.ts`) untuk mencegah duplikasi eksekusi
- DevTools siap untuk store CLI (time‑travel aman serialize BigInt)

## Catatan Keamanan

- Jangan commit `.env` berisi secret (sudah di `.gitignore:1`)
- Bedakan secara ketat variabel `NEXT_PUBLIC_*` (terekspos client) dan secret server‑only
- Verifikasi alamat penerima, jumlah, dan chain sebelum eksekusi; gunakan overlay konfirmasi
- Pertimbangkan session keys/limits (harian) untuk mencegah misuse

## Saran Peningkatan (Roadmap)

- Swap/Bridge end‑to‑end dengan kebijakan rute (fee caps, allowed tools)
- Implementasi penuh ERC‑20 (transfer/approve/permit) dan ENS resolusi
- Telemetri non‑PII untuk alur eksekusi (drop rate, lama eksekusi, error klasifikasi)
- Test suite untuk API routes (contract test LI.FI, parser intent mock) dan hooks
- Hardening: input sanitization tambahan, audit permission scopes, CSP ketat
- UI: history intents, journal eksekusi, export/share logs

## Referensi File Penting

- Halaman/Providers: `src/app/page.tsx:1`, `src/app/layout.tsx:1`
- Terminal UI: `src/components/terminal/HSMPromptTerminal.tsx:1`
- Dock & Windowing: `src/components/dock/index.tsx:1`, `src/context/DockContext.tsx:1`
- Intent AI: `src/app/api/intent/route.ts:1`, `src/lib/ai/{prompts.ts,schema.ts,index.ts}`
- LI.FI Client: `src/lib/lifi-client.ts:1`, API: `src/app/api/lifi/*`
- Token Engine: `src/lib/token-query-engine.ts:1`, `src/lib/token-providers/*`
- Chain Registry: `src/lib/chains/registry.ts:1`, Wagmi: `wagmiConfig.ts:1`
- Store CLI/HSM: `src/cli/state/{store.ts,reducer.ts,effects.ts}`

