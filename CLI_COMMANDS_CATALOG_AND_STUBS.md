# CLI Command Catalog & Stubs (ExecFi)

> Comprehensive list of base commands with behavior, aliases, and TypeScript handler stubs. Designed for the HSM CLI runtime (reducer + effects) and aligned with `INITIAL.md` and `AGENTS.md`.

---

## Philosophy

- **Deterministic** (reducer-only state changes; effects for I/O)
- **Flow vs View vs Overlay**
  - _Flow_: multi-step (parse→confirm→execute)
  - _View_: pushes a page onto the view stack (non-destructive)
  - _Overlay_: transient info/toast/prompt that never mutates core state

---

## Command Matrix (MVP + near-term)

| Command                                      | Purpose                           | Type                   | Aliases       |          |
| -------------------------------------------- | --------------------------------- | ---------------------- | ------------- | -------- |
| `/help [cmd?]`                               | Show catalog or command details   | View                   | `/?`          |          |
| `/guide`                                     | Interactive quickstart            | View                   |               |          |
| `/about`                                     | Build, repo, links                | Overlay                |               |          |
| `/version`                                   | CLI + schema versions             | Overlay                | `/v`          |          |
| `/clear`                                     | Clear screen (keep state)         | Overlay                | `/cls`        |          |
| `/home`                                      | Return to IDLE                    | State                  |               |          |
| `/login`                                     | Start session                     | Flow                   |               |          |
| `/logout`                                    | End session                       | Flow                   |               |          |
| `/whoami`                                    | User, active chain, EOA/SA short  | Overlay                |               |          |
| `/accountinfo`                               | Detailed EOA+SA card              | View                   |               |          |
| `/accounts`                                  | List linked accounts (future)     | View                   |               |          |
| `/select <acct>`                             | Switch active account             | State                  |               |          |
| `/chains [--page N]`                         | Supported chains                  | View                   | `/ch`, `/net` |          |
| \`/switch \<name                             | id>\`                             | Set working chain      | State+Toast   | `/chain` |
| \`/rpc get                                   | set …\`                           | View/set RPC endpoints | View/State    |          |
| `/gas [--chain …]`                           | Gas estimates                     | Overlay                |               |          |
| `/faucet [--chain …]`                        | Testnet faucets                   | View                   |               |          |
| `/balance [--chain …]`                       | Native balance (EOA)              | Overlay                | `/bal`        |          |
| `/balances [flags]`                          | Top tokens by USD                 | View                   | `/bals`       |          |
| `/portfolio [--group-by …]`                  | Cross-chain totals                | View                   |               |          |
| `/prices <symbol…>`                          | Spot prices snapshot              | Overlay                |               |          |
| `/send <amt> <asset> to <addr> [on <chain>]` | Native/ERC-20 transfer            | Flow                   |               |          |
| `/max to <addr> [on <chain>]`                | Send max native                   | Flow                   |               |          |
| `/request <amt?> <asset?>`                   | Payment link/QR                   | View                   |               |          |
| \`/pay \<invoice                             | link>\`                           | Parse & pay            | Flow          |          |
| `/approve <token> <spender> <amount>`        | Set allowance                     | Flow                   |               |          |
| `/allowances [filters]`                      | List allowances                   | View                   |               |          |
| `/revoke <token> [--spender …]`              | Revoke allowance(s)               | Flow                   |               |          |
| `/tx <hash>`                                 | Tx details                        | View                   |               |          |
| `/txs [--limit N] [--page N]`                | Recent transactions               | View                   |               |          |
| `/pending`                                   | Pending userOps/txs               | View                   |               |          |
| `/speedup <hash> [--mult 1.2]`               | Replace-by-fee speedup            | Flow                   |               |          |
| `/cancel <hash>`                             | RBF cancel                        | Flow                   |               |          |
| \`/simulate transfer                         | call …\`                          | Dry-run & fee preview  | View          |          |
| `/addressbook`                               | Saved contacts                    | View                   | `/addr`       |          |
| `/contact add <name> <address>`              | Add contact                       | State                  |               |          |
| \`/contact rm \<name                         | address>\`                        | Remove contact         | State         |          |
| `/ens <name>`                                | ENS → address                     | Overlay                |               |          |
| `/reverse <address>`                         | Reverse lookup                    | Overlay                |               |          |
| `/session status`                            | Session signer status             | View                   |               |          |
| `/session enable --policy <id> [--ttl m]`    | Attach signer                     | Flow                   |               |          |
| `/session disable`                           | Detach signer                     | Flow                   |               |          |
| `/policy list`                               | Available policies                | View                   |               |          |
| `/policy attach <id>`                        | Attach policy                     | Flow                   |               |          |
| `/policy detach <id>`                        | Detach policy                     | Flow                   |               |          |
| `/limits show`                               | Show caps                         | Overlay                |               |          |
| `/limits set --daily <usd> --per-tx <usd>`   | Update caps                       | State                  |               |          |
| `/allowlist show`                            | Allowed recipients/contracts      | View                   |               |          |
| `/allowlist add <addr>`                      | Add to allowlist                  | State                  |               |          |
| `/allowlist rm <addr>`                       | Remove from allowlist             | State                  |               |          |
| \`/confirm on                                | off\`                             | Toggle confirm gate    | State         |          |
| `/swap …`                                    | Token swap (LI.FI)                | Flow                   |               |          |
| `/bridge …`                                  | Cross-chain bridge (LI.FI)        | Flow                   |               |          |
| \`/quote swap                                | bridge …\`                        | Quotes only            | View          |          |
| `/state`                                     | Print state snapshot (dev)        | View                   |               |          |
| \`/events on                                 | off\`                             | Event trace (dev)      | State         |          |
| \`/trace on                                  | off\`                             | Effect debug (dev)     | State         |          |
| `/logs [--tail]`                             | Recent logs                       | View                   |               |          |
| \`/config get                                | set <k> <v>\`                     | Runtime config         | State         | `/cfg`   |
| `/env`                                       | Env overview (redacted)           | View                   |               |          |
| `/ping [--chain]`                            | RPC health                        | Overlay                |               |          |
| `/rpc-call <method> [json]`                  | Raw RPC call                      | View                   |               |          |
| \`/encode <fnSig> \<args…> \[--abi \<id      | path>]\`                          | ABI encode             | Overlay       |          |
| \`/decode <data> \[--abi \<id                | path>]\`                          | Decode calldata        | View          |          |
| `/sign <message>`                            | Sign message (EOA)                | Overlay                |               |          |
| `/verify <sig> <message> <address>`          | Verify signature                  | Overlay                |               |          |
| `/view <page>`                               | Open specific view                | View                   |               |          |
| `/back`                                      | Pop view/overlay                  | State                  | `q`           |          |
| `/exit`                                      | Quit app (confirm if flow active) | State                  |               |          |

> **Non-interrupting Overlays** (never break an active flow): `/balance`, `/gas`, `/whoami`, `/prices`, `/about`, `/version`, `/ens`, `/reverse`, `/ping`, `/sign`, `/verify`.

---

## Types & Router

```ts
// src/cli/commands/types.ts
export type FlagDef = {
  name: string;
  alias?: string;
  type: "string" | "number" | "boolean";
  default?: unknown;
  description: string;
};
export type CommandDef = {
  name: string;
  aliases?: string[];
  summary: string;
  usage: string;
  flags?: FlagDef[];
  category: "core" | "utility" | "dev";
  examples?: string[];
  parse: (
    input: string,
  ) => { ok: true; args: any } | { ok: false; error: string };
  run: (args: any, ctx: CoreContext, dispatch: (e: AppEvent) => void) => void;
};
```

```ts
// src/cli/commands/registry.ts
import { CommandDef } from "./types";
import * as C from "./stubs"; // export all implemented commands here

export const COMMANDS: CommandDef[] = [
  C.helpCmd,
  C.guideCmd,
  C.aboutCmd,
  C.versionCmd,
  C.clearCmd,
  C.homeCmd,
  C.loginCmd,
  C.logoutCmd,
  C.whoamiCmd,
  C.accountinfoCmd,
  C.accountsCmd,
  C.selectCmd,
  C.chainsCmd,
  C.switchCmd,
  C.rpcCmd,
  C.gasCmd,
  C.faucetCmd,
  C.balanceCmd,
  C.balancesCmd,
  C.portfolioCmd,
  C.pricesCmd,
  C.sendCmd,
  C.maxCmd,
  C.requestCmd,
  C.payCmd,
  C.approveCmd,
  C.allowancesCmd,
  C.revokeCmd,
  C.txCmd,
  C.txsCmd,
  C.pendingCmd,
  C.speedupCmd,
  C.cancelCmd,
  C.simulateCmd,
  C.addressbookCmd,
  C.contactAddCmd,
  C.contactRmCmd,
  C.ensCmd,
  C.reverseCmd,
  C.sessionStatusCmd,
  C.sessionEnableCmd,
  C.sessionDisableCmd,
  C.policyListCmd,
  C.policyAttachCmd,
  C.policyDetachCmd,
  C.limitsShowCmd,
  C.limitsSetCmd,
  C.allowlistShowCmd,
  C.allowlistAddCmd,
  C.allowlistRmCmd,
  C.confirmCmd,
  C.swapCmd,
  C.bridgeCmd,
  C.quoteCmd,
  C.stateCmd,
  C.eventsCmd,
  C.traceCmd,
  C.logsCmd,
  C.configCmd,
  C.envCmd,
  C.pingCmd,
  C.rpcCallCmd,
  C.encodeCmd,
  C.decodeCmd,
  C.signCmd,
  C.verifyCmd,
  C.viewCmd,
  C.backCmd,
  C.exitCmd,
];

export function routeCommand(line: string): CommandDef | undefined {
  const name = line.trim().split(/\s+/)[0];
  return COMMANDS.find((c) => c.name === name || c.aliases?.includes(name));
}
```

---

## Key Stubs (ready for implementation)

```ts
// src/cli/commands/stubs.ts
import { CommandDef } from "./types";

export const helpCmd: CommandDef = {
  name: "/help",
  aliases: ["/?"],
  category: "core",
  summary: "Show commands and usage",
  usage: "/help [command]",
  parse: (line) => ({ ok: true, args: { query: line.split(/\s+/)[1] } }),
  run: ({ query }, ctx, dispatch) =>
    dispatch({
      type: "NAV.VIEW.PUSH",
      page: query ? { kind: "help-detail", command: query } : { kind: "help" },
    }),
};

export const whoamiCmd: CommandDef = {
  name: "/whoami",
  category: "core",
  summary: "User, chain, EOA/SA short",
  usage: "/whoami",
  parse: () => ({ ok: true, args: {} }),
  run: (args, ctx, dispatch) =>
    dispatch({
      type: "OVERLAY.PUSH",
      overlay: {
        kind: "toast",
        level: "info",
        text: `User ${ctx.userId} • Chain ${ctx.chainId}`,
        ttlMs: 3000,
      },
    }),
};

export const accountinfoCmd: CommandDef = {
  name: "/accountinfo",
  category: "core",
  summary: "Detailed EOA + SA card",
  usage: "/accountinfo",
  parse: () => ({ ok: true, args: {} }),
  run: (_, __, dispatch) =>
    dispatch({ type: "NAV.VIEW.PUSH", page: { kind: "accountinfo" } }),
};

export const balanceCmd: CommandDef = {
  name: "/balance",
  aliases: ["/bal"],
  category: "core",
  summary: "Native balance (EOA)",
  usage: "/balance [--chain <id|name>]",
  flags: [
    {
      name: "chain",
      alias: "c",
      type: "string",
      description: "Override chain for this query only",
    },
  ],
  parse: (line) => ({ ok: true, args: parseFlags(line) }),
  run: (args, ctx, dispatch) =>
    dispatch({
      type: "OVERLAY.PUSH",
      overlay: {
        kind: "toast",
        level: "info",
        text: `Fetching balance on ${args.chain ?? ctx.chainId}…`,
        ttlMs: 1500,
      },
    }),
};

export const chainsCmd: CommandDef = {
  name: "/chains",
  aliases: ["/ch", "/net"],
  category: "core",
  summary: "Supported chains",
  usage: "/chains [--page N]",
  flags: [
    { name: "page", type: "number", default: 1, description: "Page number" },
  ],
  parse: (line) => ({ ok: true, args: parseFlags(line) }),
  run: (args, ctx, dispatch) =>
    dispatch({ type: "NAV.VIEW.PUSH", page: { kind: "chains", ...args } }),
};

export const switchCmd: CommandDef = {
  name: "/switch",
  aliases: ["/chain"],
  category: "utility",
  summary: "Switch working chain",
  usage: "/switch <name|id>",
  parse: (line) => ({ ok: true, args: { target: line.split(/\s+/)[1] } }),
  run: ({ target }, ctx, dispatch) =>
    dispatch({
      type: "OVERLAY.PUSH",
      overlay: {
        kind: "toast",
        level: "info",
        text: switchChain(target),
        ttlMs: 2000,
      },
    }),
};

export const sendCmd: CommandDef = {
  name: "/send",
  category: "core",
  summary: "Start native/ERC-20 transfer flow",
  usage: "/send <amount> <asset> to <address> [on <chain>]",
  parse: parseSendSyntax,
  run: (args, ctx, dispatch) =>
    dispatch({
      type: "INPUT.SUBMIT",
      text: `/send ${args.amount} ${args.symbol} to ${args.address}${args.chain ? ` on ${args.chain}` : ""}`,
    }),
};

// ... add remaining stubs following this pattern

function parseFlags(line: string) {
  /* TODO: implement tiny argv parser */ return { _: [] };
}
function parseSendSyntax(line: string) {
  /* TODO: parse /send syntax */ return {
    amount: "",
    symbol: "ETH",
    address: "",
    chain: undefined,
  };
}
function switchChain(target: string) {
  /* TODO: validate + update state in reducer via a proper event */ return `Switched to ${target}`;
}
```

---

## Views Contract (selected)

```ts
// src/cli/views/help.ts
export function renderHelpView(model: {
  commands: any[];
  page: number;
  filter?: string;
}) {
  /* print paginated table */
}

// src/cli/views/chains.ts
export function renderChainsView(model: {
  chains: any[];
  page: number;
  active: number;
}) {
  /* list chains, highlight active */
}

// src/cli/views/accountinfo.ts
export function renderAccountInfoView(model: {
  userId: string;
  eoa: string;
  sa?: string;
  deployed?: boolean;
  native?: string;
  links?: { eoa: string; sa?: string };
}) {
  /* card */
}
```

---

## Behavior Rules

- View commands push onto `viewStack`; `q` or `/back` pops without touching flows.
- Overlay commands do **not** interrupt flows; they display and auto-dismiss.
- Flow commands run through standard steps (parse→clarify→normalize→validate→simulate→confirm→execute→monitor).
- First-time recipients or large value always require confirm gate even if globally disabled.
- Every command supports `--help` to show its own usage inline.

---

## Next steps

- Generate the actual files in `src/cli/commands/*` and `src/cli/views/*` from these stubs.
- Wire effects for `/balance`, `/accountinfo`, `/chains` to real data sources (viem + chain registry + Privy SA utils).
- Add golden tests for the command router and reducer-event interactions.
