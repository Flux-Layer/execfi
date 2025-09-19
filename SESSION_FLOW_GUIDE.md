# Session-Enabled Transaction Flow Guide

This guide explains how to use the session key functionality integrated into the prompt-to-transaction flow.

## Overview

The session-enabled flow allows users to execute transactions automatically without requiring user approval for each transaction, by using keywords in their natural language prompts.

## How It Works

### 1. Session Creation
Users can create a session by typing:
- `create session`
- `session`

This creates a 24-hour session key that enables automated signing.

### 2. Session Keywords
To trigger automated signing, include these keywords in your transaction prompts:
- `auto` / `automatically`
- `without approval`
- `session`
- `silent`

### 3. Examples

#### Regular Transactions (with user approval)
```
transfer 0.001 ETH to 0x742D35Cc6234B8D4d1d58FC5c3F6b5BD2c47a31B
send 10 USDC on base to vitalik.eth
```

#### Automated Transactions (using session keys)
```
auto transfer 0.001 ETH to 0x742D35Cc6234B8D4d1d58FC5c3F6b5BD2c47a31B
automatically send 10 USDC to vitalik.eth
transfer 0.001 ETH to 0x742D35Cc6234B8D4d1d58FC5c3F6b5BD2c47a31B without approval
session transfer 0.001 ETH to 0x742D35Cc6234B8D4d1d58FC5c3F6b5BD2c47a31B
```

#### Session Status
```
session status
```

## Technical Flow

1. **Prompt Processing**: AI detects session keywords and sets `useSession: true` in intent
2. **Client Selection**: Orchestrator chooses between regular client (user approval) or session client (automated)
3. **Transaction Execution**: Transaction executes with appropriate signing method
4. **Logging**: Clear indication whether transaction used session or required approval

## Security Features

- **Time-limited**: Sessions expire after 24 hours
- **Client-side storage**: Session keys stored in localStorage (no server persistence)
- **Automatic cleanup**: Expired sessions are automatically removed
- **Explicit consent**: Users must explicitly create sessions and use session keywords

## Integration Points

### 1. AI Schema (`src/lib/ai/schema.ts`)
Extended `TransferIntentSchema` with optional `useSession` boolean field.

### 2. AI Prompts (`src/lib/ai/prompts.ts`)
Updated system prompts to recognize session keywords and set appropriate flags.

### 3. Orchestrator (`src/lib/orchestrator.ts`)
Enhanced to support session context and client selection based on intent.

### 4. Execution Pipeline (`src/lib/execute.ts`)
Already supported session flag for logging and client handling.

### 5. Terminal (`src/components/terminal/SessionEnabledTerminal.tsx`)
New session-aware terminal with session management and status indicators.

## Error Handling

- **No Active Session**: Clear message when session is requested but not available
- **Session Expiry**: Automatic cleanup and user notification
- **Client Not Ready**: Graceful fallback to regular flow

## Usage in Code

```typescript
// Using the session-enabled hook
const {
  client,           // Regular Biconomy client
  sessionClient,    // Session-enabled client
  isSessionActive,  // Session status
  createSession,    // Create new session
  sendTxWithSession // Send transaction with session
} = useBiconomyWithSessionKey();

// Execute transaction with session support
const result = await executeTransactionFromPrompt(
  "auto transfer 0.001 ETH to 0x...",
  userId,
  biconomyClient,
  userAddress,
  {
    sessionClient,
    hasActiveSession: isSessionActive
  }
);
```

## Current Status

✅ **Implemented Features:**
- Session key generation and management
- AI prompt detection of session keywords
- Orchestrator session support
- Session-enabled terminal UI
- Automatic client selection
- Session status indicators

🔄 **Ready for Testing:**
- Complete end-to-end flow from prompt to automated transaction
- Error handling for edge cases
- Session lifecycle management
- User experience improvements