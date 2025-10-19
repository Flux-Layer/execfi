Kita sedang membangun GameFi Gaming Hub dengan dua game:

Game #1 (sudah ada): degenshooter.

Game #2 (idle farming): pemain menanam seed → menyiram → menunggu growth → panen. EXP hanya diberikan saat panen via XPRegistry (sudah tersedia) menggunakan EIP-712 signature (hemat gas, sekali tx).

Kita ingin menghasilkan:

Kontrak upgradeable (UUPS) berikut (kecuali XPRegistry yang sudah ada):

 - [x] ParameterRegistry (konfigurasi game)
 - [x] Item1155 (cangkul/seed/air — ERC-1155)
 - [x] Land721 (lahan — ERC-721)
 - [x] Shop (harga tetap; mint & jual 1155/721)
 - [x] Marketplace (P2P minimalis utk 1155/721)
 - [x] FarmingCore (logika tanam/siram/panen + klaim XP via XPRegistry signature forward)
 - [ ] Interface ke XPRegistry (IXPRegistry) hanya untuk addXPWithSig.
 - [x] Serangkaian unit test + fuzz (Foundry) & skrip deploy/verify. *(initial unit tests untuk ParameterRegistry, Item1155, Land721, Shop, Marketplace, FarmingCore)*

UI (Next.js + Wagmi/Viem) halaman: Inventory, Plots Board, Shop, Marketplace, Harvest (batch) dengan alur lengkap.

Kontrak Reuse

Gunakan OpenZeppelin Upgradeable:

@openzeppelin/contracts-upgradeable/*

Standar: Solidity ^0.8.24, UUPS.

Target Tujuan

Hemat gas: batch actions (ERC-1155), packed storage, single-tx harvest + XP claim.

Aman: AccessControl, Pausable, ReentrancyGuard, signature verification, rate limit.

Mudah dioperasikan: Parameter on-chain dapat diupdate via admin (multisig/timelock siap di masa depan).

Deliverables

Solidity (contracts/):

interfaces/IXPRegistry.sol (interface minimal)

ParameterRegistry.sol (UUPS)

Item1155.sol (UUPS, ERC-1155)

Land721.sol (UUPS, ERC-721)

Shop.sol (UUPS)

Marketplace.sol (UUPS)

FarmingCore.sol (UUPS)

- [x] libs/Errors.sol, libs/Events.sol, libs/Structs.sol

Foundry:

forge.toml, script/DeployAll.s.sol, script/Config.s.sol

test/*.t.sol dengan unit & fuzz (edge cases)

UI (apps/web/):

Next.js (App Router), Wagmi/Viem, RainbowKit (atau ConnectKit), Tailwind

Halaman: /inventory, /plots, /shop, /market

Komponen: ItemCard1155, PlotGrid, HarvestModal (batch), SignatureStatus

Hook/gateway XP signature: POST /api/sign-xp (mock service lokal)

Spesifikasi Smart Contracts
0. Interface XPRegistry

interfaces/IXPRegistry.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IXPRegistry {
  function addXPWithSig(
    address user,
    uint256 gameId,
    uint256 amount,
    uint256 deadline,
    bytes calldata signature
  ) external;
  function getNonce(address account, uint256 gameId) external view returns (uint256);
}


Alamat & gameId diinject lewat constructor/initializer modul yang perlu (terutama FarmingCore).

1. ParameterRegistry (UUPS)

Tujuan: tabel parameter gameplay yang bisa diupdate admin:

seedBaseExp[seedType] -> uint32

seedGrowthSec[seedType] -> uint32

toolSpeedBps[toolRarity] -> uint16 (ex: 0, 100, 250, 500, 1000 untuk 0%,10%,25%,50%,100%)

maxPlotsPerHarvest -> uint16

xpRateLimitPerTx -> uint256 (mirror ke XPRegistry via admin di sana)

seasonBonusBps -> uint16 (opsional)

harga shop default (lihat Shop)

Fungsi:

setter/getter untuk semua parameter (onlyRole DEFAULT_ADMIN_ROLE)

event ParamUpdated(key, value...)

Keamanan:

AccessControlUpgradeable, UUPS, PausableUpgradeable.

Tidak menyentuh state pemain.

2. Item1155 (UUPS, ERC-1155)

Fungsi:

Menampung Cangkul/Seed/Air sebagai tipe item:

Gunakan id scheme:

1xx_xxx: TOOLS (cangkul) → encode rarity

2xx_xxx: SEEDS → encode seedType

3xx_xxx: WATER → single id (mis: 300_000)

Mint/burn role-based (MINTER_ROLE untuk Shop; FarmingCore boleh burn saat konsumsi).

Batch mint/burn.

(Opsional) EIP-2981 royalty info utk seed edisi khusus (dipakai marketplace).

Events:

ToolMinted(to, id, qty)

SeedMinted(to, id, qty)

WaterMinted(to, qty)

Keamanan:

ReentrancyGuardUpgradeable, PausableUpgradeable, AccessControl.

3. Land721 (UUPS, ERC-721)

Fungsi:

Mint lahan (default 1 untuk user baru bisa dilakukan dari Shop gratis/claim).

Metadata URI per land (baseURI).

(Opsional) Expandable: upgrade lahan level/dimensi via ParameterRegistry (bisa nanti).

Events:

LandMinted(to, landId)

4. Shop (UUPS)

Tujuan: jual beli harga tetap (fixed price) untuk Item1155 & Land721.
Konfigurasi (di Parameters/Shop sendiri):

Harga per seedType, toolRarity, waterUnit, landPrice.

Payment: native token chain (ETH/BASE/LISK dll).

Fungsi:

buySeed(seedType, qty)

buyWater(qty)

buyTool(toolRarity, qty)

buyLand(qty) (opsional, atau 1x claim gratis)

Internal: mint via MINTER_ROLE pada Item1155/Land721

Treasury withdraw

Keamanan:

Check payment amount

Pausable

Emit event tiap pembelian (log analytics)

5. Marketplace (UUPS) — minimalis

Tujuan: P2P list/buy/cancel utk ERC-1155 & ERC-721.
Struktur:

Listing struct:

seller

assetType (1155/721)

token

id

qty (untuk 1155)

pricePerUnit

currency (native)

active

Fee: marketFeeBps (ex 250 = 2.5%), treasury address.

Fungsi:

list1155(token, id, qty, pricePerUnit)

list721(token, id, price)

buy(listingId, qty) (1155); buy(listingId) (721)

cancel(listingId)

Transfer aman (gunakan safeTransferFrom/transferFrom tergantung tipe)

Keamanan:

ReentrancyGuard, Pausable

Validasi kepemilikan/approval

Event Listed, Purchased, Canceled

6. FarmingCore (UUPS) — jantung gameplay

Tujuan: state per plot, tanam, siram, panen sekali tx + forward XP signature ke XPRegistry.

Storage (hemat/padat):

struct Plot {
  address owner;
  uint8 seedCount; // minimal 1, maksimal 5
  uint8 toolRarity;
  uint32[5] seedTypes;
  uint64 plantedAt;
  uint64 readyAt;
  bool harvested;
}

mapping(uint256 => Plot) internal plots; // index by landId (menggunakan Land721)

mapping(address => uint256) public activeToolId; (dari Item1155)

Address:

address item1155

address land721

address parameterRegistry

IXPRegistry xpRegistry

Config:

uint256 gameId (untuk XPRegistry)

(opsional) cooldown & anti-abuse flags

Fungsi utama:

setActiveTool(uint256 toolId) — validasi kepemilikan 1155.

dig(uint256 landId)

- Hanya bisa jika plot kosong atau sudah panen.
- Menyimpan rarity shovel aktif sebagai modifier speed.
- Emit PlotDug(user, landId, rarity).

plant(uint256 landId, uint32[] seedTypes)

- Wajib setelah dig; validasi seedTypes length 1–5 (boleh campuran).
- Burn 1 unit seed & 1 unit water per entry (water consumption identik untuk semua seed).
- Hitung readyAt = plantedAt + max(growthSeconds setelah modifier tool) dari seluruh seed.
- Simpan seedCount dan daftar seed ke storage; plot kembali status "undug" (plot harus dig ulang untuk musim berikutnya).
- Emit Planted(user, landId, seedTypes[], readyAt)

water(uint256 landId)

- Konsumsi 1 water; kurangi sisa waktu sekitar 20% (min 1 detik), plot harus punya seedCount > 0.
- Emit Watered(user, landId, readyAtBaru)

harvestAndClaimXP(uint256[] landIds, uint256 expAmount, uint256 deadline, bytes xpSignature)

- Validasi panjang array ≤ maxPlotsPerHarvest (menggunakan cache sekaligus sinkronisasi manual).
- Untuk tiap landId: plot tidak kosong, belum diharvest, readyAt ≤ block.timestamp, owner == msg.sender.
- Tandai harvested=true lalu hitung exp plot = Σ baseExp(seedType) * (1 + seasonBonusBps/10000).
- Emit Harvested(user, landId, expPlot, seedTypes[]).
- Setelah loop, pastikan totalExp == expAmount, cek xpRateLimit & deadline, lalu panggil xpRegistry.addXPWithSig.

Events:

PlotDug(address indexed user, uint256 indexed landId, uint8 toolRarity)

Planted(address indexed user, uint256 indexed landId, uint32[] seedTypes, uint64 readyAt)

Watered(address indexed user, uint256 indexed landId, uint64 newReadyAt)

Harvested(address indexed user, uint256 indexed landId, uint256 exp, uint32[] seedTypes)

PlotCleared(address indexed user, uint256 indexed landId)

Akses & Keamanan:

AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable

Validasi kepemilikan Land721 untuk landId

Konsumsi 1155 harus melalui safe transfer/ burn via operator approvals

Batasi landIds.length <= maxPlotsPerHarvest dari ParameterRegistry

Alur Signature & Integrasi XP (HARUS)

gameId khusus game farming, sudah didaftarkan di XPRegistry (di luar kontrak ini).

Service signer off-chain (di luar Solidity) menandatangani XPAdd(user, gameId, amount, nonce, deadline) sesuai EIP-712 yang sudah ada di XPRegistry.

Frontend:

- Hit API /api/farming/sign-xp bawa user, daftar landIds siap panen.
- Server membaca state plot langsung dari FarmingCore + ParameterRegistry (baseExp, seasonBonus) untuk menghitung exp & maxPlots.
- Service ambil nonce dari XPRegistry, menandatangani XPAdd, dan mengembalikan {amount, deadline, nonce, signature, plotSummary}.
- UI panggil FarmingCore.harvestAndClaimXP(landIds, amount, deadline, signature).
- FarmingCore hanya forward signature ke XPRegistry; XPRegistry akan recover(signature) dan cek signer.

Persyaratan Kode & Kualitas

Gunakan UUPSUpgradeable utk semua kontrak, _authorizeUpgrade hanya admin.

Gunakan AccessControlUpgradeable dengan DEFAULT_ADMIN_ROLE, MINTER_ROLE, PAUSER_ROLE.

Terapkan Checks-Effects-Interactions + nonReentrant pada fungsi stateful.

Emit event lengkap untuk semua aksi penting.

Semua magic number jadi constant atau diset via ParameterRegistry.

Dokumentasi NatSpec untuk publik/external.

Outstanding Implementation Tasks
--------------------------------
- **Metadata & Art**: Upload final IPFS assets/JSON dan panggil `Item1155.setURI` + `Land721.setBaseURI` agar UI menampilkan ikon/nama resmi.
- **Konfigurasi Game Final**: Jalankan script untuk seed config, tool speed, harga shop, marketplace fee, season bonus, dan `maxPlotsPerHarvest` sesuai balancing produksi.
- **Supply Control**: Jika ingin stok terbatas (mis. shovel legend), siapkan mint script/logic tambahan—saat ini supply dibatasi secara off-chain.
- **Integrasi Front-end**: Lengkapi flow dig → plant → water → harvest di `/plots` & `/inventory`, termasuk pemanggilan `/api/farming/sign-xp` sebelum `harvestAndClaimXP`.
- **Operasional Treasury & XP Signer**: Pastikan wallet treasury dan signer XP siap (funded, backup, rotasi kunci) sebelum go-live.
- **Fitur Opsional**: Pertimbangkan upgrade berikut jika dibutuhkan: biaya water berbeda per seed, durability alat, ekspansi plot, sistem reward tambahan.

Pengujian (Foundry)

Buat test berikut (contoh nama file):

ParameterRegistry.t.sol:

Set/get semua param & event ter-emit

Item1155.t.sol:

Mint/burn role, batch mint, URI

Land721.t.sol:

Mint, baseURI

Shop.t.sol:

Beli seed/tool/water/land; salah bayar → revert

Marketplace.t.sol:

List/buy/cancel 1155 & 721; fee; insufficient approval

FarmingCore.t.sol:

Flow utama: setActiveTool → plant → (opsional water) → travel time (warp) → harvestAndClaimXP dengan signature valid

Double harvest → revert

growth belum matang → revert

land bukan milik user → revert

expAmount ≠ perhitungan kontrak → revert

batch panen > maxPlotsPerHarvest → revert

pause/unpause switches

Fuzz:

seedType random dalam domain valid

waktu warp acak

kuantitas batch random

Gas snapshots (opsional).

Mock XP signer:

Buat helper test yang mensimulasikan service: baca nonce dari XPRegistry (mock), bentuk digest sesuai XPRegistry, sign dengan private key test, kirim ke harvestAndClaimXP.

Skrip Deploy (Foundry)

script/DeployAll.s.sol:

Deploy ParameterRegistry → set default param

Deploy Item1155, Land721

Deploy Shop → set treasury & harga; grant MINTER_ROLE ke Shop untuk Item1155/Land721

Deploy Marketplace → set fee

Deploy FarmingCore dengan address:

item1155, land721, parameterRegistry, xpRegistry, gameId

Grant roles (PAUSER_ROLE, MINTER_ROLE) seperlunya

(Opsional) Verifikasi Etherscan

script/Config.s.sol:

Helper untuk update param saat liveops (season bonus, harga, dll.)

UI — Spesifikasi & Flow
Stack

Next.js (App Router), TypeScript, Tailwind

Wagmi + Viem untuk on-chain

Wallet connect (RainbowKit/ConnectKit)

Komponen reusable & teruji

Halaman & Komponen

/inventory

Daftar Item1155 user (seed, water, tools) & Land721

Button: Set Active Tool → call FarmingCore.setActiveTool(toolId)

/plots

Grid plot milik user (berdasar Land721)

Aksi:

Plant: pilih seedType (dropdown), qty=1, confirm → call FarmingCore.plant(...) (auto burn/move seed+water)

Water (kalau ada mekanik percepat): konsumsi 1 water → call water(...)

Harvest (batch):

Deteksi plot siap panen (readyAt ≤ now)

Hit /api/sign-xp dengan landIds siap, previewExp

Terima signature, deadline

Call harvestAndClaimXP(landIds, amount, deadline, signature)

Tampilkan Ready badge per plot & countdown growth

/shop

Katalog tool by rarity, seed by type, water

Input qty, auto total harga

Call Shop.buy... sesuai

/market

Tab 1155 & 721

List, Buy, Cancel

Tampilkan fee & payout estimasi

Komponen:

ItemCard1155, ToolRarityBadge, SeedTypeBadge

PlotGrid, PlotCard (status: planted / ready / empty)

HarvestModal (tampilkan daftar plot siap panen, total EXP, hasil sign, tx status)

SignatureStatus (nonce, deadline countdown)

UX & Error Handling

Loading states per aksi (mint, tanam, panen)

Toast sukses/gagal (viem tx receipt)

Validasi local (cukup item, seed/water balance)

Guard: jika signature kadaluarsa → auto refresh & minta signature ulang

API Routes (mock)

POST /api/farming/sign-xp: body { user: address, landIds: number[] }

Server baca plot (FarmingCore.getPlot) & parameter (ParameterRegistry), validasi maxPlots, kesiapan panen, lalu hitung exp + ambil nonce dari XPRegistry. Respons: { amount, deadline, nonce, signature, plots: [{ landId, seedTypes, exp, readyAt }] }.

Ini mock; di produksi pindah ke service terpisah.

Poin Implementasi Penting

Pilihan desain: tool rarity memengaruhi growthSec saja (lebih sederhana). Rumus:

growthSecEffective = max(1, baseGrowthSec[seedType] * 10000 / (10000 + toolSpeedBps[rarity]))


EXP:

exp = baseExp[seedType] * (10000 + seasonBonusBps) / 10000


FarmingCore memverifikasi jumlah expAmount yg dikirim UI == hasil kalkulasi; jika beda → revert.

Batch Panen: batasi panjang array landIds via maxPlotsPerHarvest.

Konsumsi 1155 saat tanam/siram: gunakan safeBatchTransferFrom ke vault kontrak atau burn langsung jika lebih sederhana (disarankan burn untuk seed/water agar supply berkurang).

Land kepemilikan: wajib ownerOf(landId) == msg.sender saat plant/water/harvest.

Pause: admin bisa pause modul Shop, Marketplace, FarmingCore saat anomali.

Acceptance Criteria (wajib lulus)

Deploy semua kontrak dengan peran & relasi benar.

Plant → (opsional water) → warp waktu → harvestAndClaimXP (batch) → XPRegistry event XPIncreased.

Signature & nonce benar (gagal jika salah signer/nonce/deadline).

Shop transaksi harga tepat & mint ke user.

Marketplace dapat list/buy/cancel untuk 1155 & 721; fee mengalir ke treasury.

UI menampilkan inventory, plot ready, dan dapat memanen batch dengan 1 klik.

Test menutupi skenario happy path + edge cases.

Yang Perlu Diisi / Disesuaikan

Alamat kontrak XPRegistry di chain target + gameId (uint256).

Daftar awal seedType -> baseExp & growthSec.

Mapping toolRarity -> speedBps.

Harga Shop.

Treasury address.

URL API signer (mock vs prod).

Batasan maxPlotsPerHarvest, xpRateLimitPerTx.

Silakan hasilkan seluruh kode & UI sesuai spesifikasi di atas. Tulis kode yang rapi, terdokumentasi NatSpec, dan sertakan event serta revert reason yang jelas. Prioritaskan keamanan, gas efficiency, dan kemudahan pengujian.
