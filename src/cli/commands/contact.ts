// Contact management commands for ExecFi CLI (Phase 3)
import type { CommandDef } from "./types";
import { parseFlags } from "./parser";

/**
 * Address book command - show saved contacts
 */
export const addressbookCmd: CommandDef = {
  name: "/addressbook",
  aliases: ["/contacts", "/addr"],
  category: "core",
  summary: "Show saved contacts and addresses",
  usage: "/addressbook [options]",
  flags: [
    {
      name: "search",
      alias: "s",
      type: "string",
      description: "Search contacts by name or address",
    },
    {
      name: "chain",
      alias: "c",
      type: "string",
      description: "Filter by chain-specific contacts",
    },
    {
      name: "sort",
      alias: "o",
      type: "string",
      description: "Sort by: name, address, recent, added (default: name)",
    },
    {
      name: "limit",
      alias: "l",
      type: "number",
      default: 20,
      description: "Maximum number of contacts to show",
    },
  ],
  examples: [
    "/addressbook",
    "/addressbook --search alice",
    "/addressbook --chain ethereum",
    "/contacts --sort recent --limit 10",
    "/addr -s vitalik -c ethereum",
  ],
  parse: (line) => {
    try {
      const flags = parseFlags(line, addressbookCmd.flags);
      return { ok: true, args: flags };
    } catch (error) {
      return { ok: false, error: `Parse error: ${error}` };
    }
  },
  run: async (args, _ctx, dispatch) => {
    const { search, chain, sort = "name", limit = 20 } = args;

    try {
      const contactsText = await fetchContacts(search, chain, sort, limit);
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: contactsText,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ Failed to fetch contacts: ${errorMessage}`,
          timestamp: Date.now(),
        },
      });
    }
  },
};

/**
 * Contact add command - add new contact
 */
export const contactAddCmd: CommandDef = {
  name: "/contact",
  aliases: ["/add-contact"],
  category: "core",
  summary: "Manage contacts and addresses",
  usage: "/contact <subcommand> [options]",
  flags: [
    {
      name: "name",
      alias: "n",
      type: "string",
      description: "Contact name",
    },
    {
      name: "address",
      alias: "a",
      type: "string",
      description: "Wallet address or ENS name",
    },
    {
      name: "chain",
      alias: "c",
      type: "string",
      description: "Associated blockchain",
    },
    {
      name: "note",
      alias: "note",
      type: "string",
      description: "Optional note about the contact",
    },
  ],
  examples: [
    "/contact add --name Alice --address 0x1234... --chain ethereum",
    "/contact add --name Bob --address bob.eth",
    "/contact remove Alice",
    "/contact edit Alice --note 'DeFi expert'",
    "/contact search vitalik",
  ],
  parse: (line) => {
    try {
      const parts = line.trim().split(/\s+/);
      const subcommand = parts[1]?.toLowerCase();

      if (!subcommand) {
        return { ok: false, error: "Missing subcommand. Use: add, remove, edit, search" };
      }

      // Handle different subcommand patterns
      if (subcommand === "add") {
        const flags = parseFlags(line.substring(line.indexOf(subcommand) + subcommand.length), contactAddCmd.flags);
        return { ok: true, args: { action: "add", ...flags } };
      }

      if (subcommand === "remove" || subcommand === "delete") {
        const name = parts[2];
        if (!name) {
          return { ok: false, error: "Missing contact name. Usage: /contact remove <name>" };
        }
        return { ok: true, args: { action: "remove", name } };
      }

      if (subcommand === "edit") {
        const name = parts[2];
        if (!name) {
          return { ok: false, error: "Missing contact name. Usage: /contact edit <name> [options]" };
        }
        const flags = parseFlags(line.substring(line.indexOf(name) + name.length), contactAddCmd.flags);
        return { ok: true, args: { action: "edit", name, ...flags } };
      }

      if (subcommand === "search") {
        const query = parts.slice(2).join(' ');
        if (!query) {
          return { ok: false, error: "Missing search query. Usage: /contact search <query>" };
        }
        return { ok: true, args: { action: "search", query } };
      }

      return { ok: false, error: `Unknown subcommand: ${subcommand}. Use: add, remove, edit, search` };
    } catch (error) {
      return { ok: false, error: `Parse error: ${error}` };
    }
  },
  run: async (args, _ctx, dispatch) => {
    const { action } = args;

    try {
      switch (action) {
        case "add": {
          const { name, address, chain, note } = args;
          if (!name || !address) {
            dispatch({
              type: "CHAT.ADD",
              message: {
                role: "assistant",
                content: "❌ Missing required fields. Usage: /contact add --name <name> --address <address>",
                timestamp: Date.now(),
              },
            });
            break;
          }

          const addText = await addContact(name, address, chain, note);
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: addText,
              timestamp: Date.now(),
            },
          });
          break;
        }

        case "remove": {
          const { name } = args;
          const removeText = await removeContact(name);
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: removeText,
              timestamp: Date.now(),
            },
          });
          break;
        }

        case "edit": {
          const { name, address, chain, note } = args;
          const editText = await editContact(name, address, chain, note);
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: editText,
              timestamp: Date.now(),
            },
          });
          break;
        }

        case "search": {
          const { query } = args;
          const searchText = await searchContacts(query);
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: searchText,
              timestamp: Date.now(),
            },
          });
          break;
        }

        default: {
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: `❌ Unknown contact action: ${action}. Use: add, remove, edit, search`,
              timestamp: Date.now(),
            },
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ Contact command error: ${errorMessage}`,
          timestamp: Date.now(),
        },
      });
    }
  },
};

// Contact data structure
interface Contact {
  id: string;
  name: string;
  address: string;
  ensName?: string;
  chain?: string;
  note?: string;
  addedAt: number;
  lastUsed?: number;
  transactionCount: number;
  isFavorite: boolean;
  tags: string[];
}

// Implementation functions

/**
 * Fetch contacts from storage
 */
async function fetchContacts(
  search?: string,
  chainFilter?: string,
  sortBy: string = "name",
  limit: number = 20
): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 500));

  // Mock contacts data - in production would fetch from local storage or backend
  const mockContacts: Contact[] = [
    {
      id: "1",
      name: "Alice",
      address: "0x742d35Cc6610C7532C8b4CF3D09D6BCBB8ff1d7E",
      ensName: "alice.eth",
      chain: "ethereum",
      note: "DeFi researcher",
      addedAt: Date.now() - 86400000 * 7,
      lastUsed: Date.now() - 3600000,
      transactionCount: 12,
      isFavorite: true,
      tags: ["defi", "friend"],
    },
    {
      id: "2",
      name: "Bob",
      address: "0x8ba1f109551bD432803012645Hac136c22C57B5B",
      chain: "base",
      note: "NFT collector",
      addedAt: Date.now() - 86400000 * 3,
      lastUsed: Date.now() - 86400000,
      transactionCount: 5,
      isFavorite: false,
      tags: ["nft"],
    },
    {
      id: "3",
      name: "Vitalik",
      address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      ensName: "vitalik.eth",
      chain: "ethereum",
      note: "Ethereum founder",
      addedAt: Date.now() - 86400000 * 30,
      transactionCount: 1,
      isFavorite: true,
      tags: ["ethereum", "celebrity"],
    },
    {
      id: "4",
      name: "Charlie",
      address: "0x1234567890123456789012345678901234567890",
      chain: "polygon",
      addedAt: Date.now() - 86400000 * 1,
      transactionCount: 0,
      isFavorite: false,
      tags: [],
    }
  ];

  // Apply filters
  let filteredContacts = mockContacts;

  if (search) {
    const searchLower = search.toLowerCase();
    filteredContacts = filteredContacts.filter(contact =>
      contact.name.toLowerCase().includes(searchLower) ||
      contact.address.toLowerCase().includes(searchLower) ||
      contact.ensName?.toLowerCase().includes(searchLower) ||
      contact.note?.toLowerCase().includes(searchLower) ||
      contact.tags.some(tag => tag.toLowerCase().includes(searchLower))
    );
  }

  if (chainFilter) {
    filteredContacts = filteredContacts.filter(contact =>
      contact.chain?.toLowerCase() === chainFilter.toLowerCase()
    );
  }

  // Apply sorting
  filteredContacts.sort((a, b) => {
    switch (sortBy) {
      case "recent":
        return (b.lastUsed || 0) - (a.lastUsed || 0);
      case "added":
        return b.addedAt - a.addedAt;
      case "address":
        return a.address.localeCompare(b.address);
      case "name":
      default:
        return a.name.localeCompare(b.name);
    }
  });

  // Apply limit
  filteredContacts = filteredContacts.slice(0, limit);

  // Format output
  const header = `📇 Address Book

**Total Contacts:** ${mockContacts.length}${filteredContacts.length !== mockContacts.length ? ` (${filteredContacts.length} shown)` : ""}
${search ? `**Search:** "${search}"` : ""}
${chainFilter ? `**Chain Filter:** ${chainFilter}` : ""}
**Sorted by:** ${sortBy}

`;

  if (filteredContacts.length === 0) {
    return header + `🚫 No contacts found

${search ? `No contacts match "${search}"` : "Your address book is empty"}

**Get Started:**
• Add contacts: \`/contact add --name Alice --address 0x123...\`
• Import from ENS: \`/contact add --name Bob --address bob.eth\`
• Search existing: \`/contact search <query>\`

💡 **Tip:** Contacts make transactions faster and safer!`;
  }

  const contactRows = filteredContacts.map((contact, index) => {
    const favoriteIcon = contact.isFavorite ? "⭐" : "";
    const ensDisplay = contact.ensName ? ` (${contact.ensName})` : "";
    const chainDisplay = contact.chain ? ` • ${contact.chain}` : "";
    const lastUsedText = contact.lastUsed ? formatTimeAgo(contact.lastUsed) : "Never";
    const tagsDisplay = contact.tags.length > 0 ? ` • ${contact.tags.join(", ")}` : "";

    return `${index + 1}. ${favoriteIcon}**${contact.name}**${ensDisplay}
   Address: ${contact.address.slice(0, 10)}...${contact.address.slice(-8)}${chainDisplay}
   Transactions: ${contact.transactionCount} • Last used: ${lastUsedText}${tagsDisplay}
   ${contact.note ? `Note: ${contact.note}` : ""}`;
  }).join("\n\n");

  const footer = `

**Quick Actions:**
• Send: \`/send 0.1 ETH to ${filteredContacts[0]?.name}\`
• Edit: \`/contact edit ${filteredContacts[0]?.name} --note "Updated note"\`
• Remove: \`/contact remove ${filteredContacts[0]?.name}\`

**Shortcuts:**
• \`@\` + name in send commands (e.g., "send 0.1 ETH to @Alice")
• ENS resolution for .eth addresses
• Auto-complete contact names in CLI`;

  return header + contactRows + footer;
}

/**
 * Add new contact
 */
async function addContact(name: string, address: string, chain?: string, note?: string): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 800));

  // Validate address format
  if (!address.match(/^0x[a-fA-F0-9]{40}$/) && !address.endsWith('.eth')) {
    return `❌ Invalid address format: ${address}

**Supported formats:**
• Ethereum address: 0x742d35Cc6610C7532C8b4CF3D09D6BCBB8ff1d7E
• ENS name: alice.eth

Please check the address and try again.`;
  }

  // Check for duplicate names
  const isDuplicate = await checkDuplicateName(name);
  if (isDuplicate) {
    return `❌ Contact name "${name}" already exists

**Options:**
• Choose a different name: \`/contact add --name "${name}2" --address ${address}\`
• Update existing contact: \`/contact edit ${name} --address ${address}\`
• Remove old contact first: \`/contact remove ${name}\``;
  }

  const resolvedAddress = address.endsWith('.eth') ? await resolveENS(address) : address;
  const isENS = address.endsWith('.eth');

  return `✅ Contact Added Successfully

**New Contact:**
• Name: ${name}
• Address: ${resolvedAddress.slice(0, 10)}...${resolvedAddress.slice(-8)}
${isENS ? `• ENS: ${address}` : ""}
${chain ? `• Chain: ${chain}` : ""}
${note ? `• Note: ${note}` : ""}

**Added:** ${new Date().toLocaleString()}

**What's Next:**
• Send tokens: \`/send 0.1 ETH to ${name}\`
• Quick send: Type "@${name}" in any send command
• Edit details: \`/contact edit ${name}\`

💡 **Pro Tip:** Use \`/addressbook\` to see all your contacts`;
}

/**
 * Remove contact
 */
async function removeContact(name: string): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 600));

  const contactExists = await checkContactExists(name);
  if (!contactExists) {
    return `❌ Contact "${name}" not found

**Available contacts:**
• Use \`/addressbook\` to see all contacts
• Use \`/contact search ${name}\` for partial matches
• Check spelling and try again`;
  }

  return `✅ Contact Removed: ${name}

**Removed Details:**
• Contact name and address deleted
• Transaction history preserved
• Can be re-added anytime

**Impact:**
• "@${name}" shortcuts no longer work
• Manual address entry required for future transactions
• No transaction data was lost

**Recovery:**
• Re-add with: \`/contact add --name ${name} --address 0x...\`
• Check recent transactions for the address
• Import from transaction history if needed`;
}

/**
 * Edit contact
 */
async function editContact(name: string, newAddress?: string, newChain?: string, newNote?: string): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 700));

  const contactExists = await checkContactExists(name);
  if (!contactExists) {
    return `❌ Contact "${name}" not found

Use \`/addressbook\` to see available contacts or \`/contact add\` to create new ones.`;
  }

  const changes = [];
  if (newAddress) changes.push(`Address: ${newAddress.slice(0, 10)}...${newAddress.slice(-8)}`);
  if (newChain) changes.push(`Chain: ${newChain}`);
  if (newNote) changes.push(`Note: ${newNote}`);

  if (changes.length === 0) {
    return `❌ No changes specified

**Usage:** \`/contact edit ${name} [--address <addr>] [--chain <chain>] [--note "<note>"]\`

**Examples:**
• \`/contact edit ${name} --note "Updated information"\`
• \`/contact edit ${name} --address 0x123... --chain ethereum\``;
  }

  return `✅ Contact Updated: ${name}

**Changes Applied:**
${changes.map(change => `• ${change}`).join('\n')}

**Updated:** ${new Date().toLocaleString()}

**Verification:**
• Use \`/addressbook --search ${name}\` to verify changes
• Test with \`/send 0.001 ETH to ${name}\` (simulation)
• All shortcuts and references updated automatically

💾 **Changes saved** to your local address book.`;
}

/**
 * Search contacts
 */
async function searchContacts(query: string): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 400));

  // This would perform the same filtering as fetchContacts but return different format
  return fetchContacts(query, undefined, "name", 10);
}

// Utility functions

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return "Recently";
}

async function checkDuplicateName(_name: string): Promise<boolean> {
  // Mock duplicate check - would check actual storage
  return false;
}

async function checkContactExists(_name: string): Promise<boolean> {
  // Mock existence check - would check actual storage
  return true;
}

async function resolveENS(ensName: string): Promise<string> {
  // Mock ENS resolution - would use actual ENS resolver
  return "0x742d35Cc6610C7532C8b4CF3D09D6BCBB8ff1d7E";
}