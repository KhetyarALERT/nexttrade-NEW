# Web3 Wallet Entity Schema

## Overview
The Web3Wallet entity stores information about user's connected Web3 wallets across multiple blockchain networks (Ethereum, Solana, Tron).

## Entity Name
`Web3Wallet`

## Required Fields

### Identification Fields
- **id** (string, primary key, auto-generated UUID)
  - Unique identifier for the wallet connection record

- **user_id** (string, foreign key to User entity, required, indexed)
  - The user who owns this wallet connection
  - Should have CASCADE delete (when user is deleted, their wallets are deleted)

### Wallet Information
- **wallet_type** (string, required, indexed)
  - The wallet provider/type
  - Valid values: 'metamask', 'phantom', 'solflare', 'tronlink', 'coinbase', 'trust', 'walletconnect'
  - Used to identify which wallet software the user connected with

- **network** (string, required, indexed)
  - The blockchain network
  - Valid values: 'ethereum', 'solana', 'tron'
  - Primary categorization of the wallet type

- **chain_id** (string, nullable)
  - For EVM chains (Ethereum): The chain ID (e.g., "1" for mainnet, "56" for BSC, "137" for Polygon)
  - For Solana: Network type ('mainnet-beta', 'testnet', 'devnet')
  - For Tron: Network type ('mainnet', 'shasta', 'nile')
  - Important for multi-chain support

- **address** (string, required, indexed, unique per user+network)
  - The wallet's public address
  - Ethereum: 0x... format (42 chars)
  - Solana: Base58 format (~44 chars)
  - Tron: T... format (~34 chars)
  - Should be indexed for fast lookups
  - Composite unique constraint: (user_id, network, address)

### Balance Information
- **balance** (decimal/string, nullable)
  - The last known balance in the native currency
  - Stored as string to avoid floating point issues
  - Unit: Wei for Ethereum, Lamports for Solana, Sun for Tron
  - Updated periodically or on user action

- **balance_usd** (decimal, nullable)
  - USD value of the balance at last update
  - Used for portfolio displays

### Connection Tracking
- **connected_at** (datetime, required)
  - Timestamp when the wallet was first connected
  - Auto-set on creation

- **disconnected_at** (datetime, nullable)
  - Timestamp when the wallet was explicitly disconnected
  - NULL means currently connected
  - When user disconnects, this should be set

- **last_used_at** (datetime, nullable)
  - Timestamp of last activity/usage
  - Updated when user performs any action with this wallet
  - Useful for showing "recently used" wallets

### Metadata
- **label** (string, nullable)
  - User-defined nickname for the wallet (e.g., "My Trading Wallet", "Cold Storage")
  - Optional field for UX improvement

- **is_primary** (boolean, default: false)
  - Whether this is the user's primary/default wallet for this network
  - Only one wallet per user per network should be primary

### Audit Fields
- **created_at** (datetime, required, auto-generated)
  - When this record was created

- **updated_at** (datetime, required, auto-updated)
  - When this record was last modified

## Indexes

### Required Indexes
1. **Primary Key**: `id`
2. **Foreign Key**: `user_id` (with CASCADE delete)
3. **Lookup Index**: `(user_id, network)` - Find all user's wallets for a specific network
4. **Unique Constraint**: `(user_id, network, address)` - Prevent duplicate wallet connections
5. **Connection Status**: `(user_id, disconnected_at)` - Find active connections (WHERE disconnected_at IS NULL)
6. **Wallet Type**: `wallet_type` - Analytics queries

## Usage Examples

### Create a wallet connection
```javascript
import { Web3Wallet } from '@/api/entities';

const wallet = await Web3Wallet.create({
  user_id: currentUser.id,
  wallet_type: 'metamask',
  network: 'ethereum',
  chain_id: '1',
  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  balance: '1500000000000000000', // 1.5 ETH in wei
  balance_usd: 3750.50,
  connected_at: new Date(),
  is_primary: true
});
```

### Find user's active wallets
```javascript
const activeWallets = await Web3Wallet.findAll({
  where: {
    user_id: currentUser.id,
    disconnected_at: null
  }
});
```

### Disconnect a wallet
```javascript
await wallet.update({
  disconnected_at: new Date()
});
```

### Get user's primary Ethereum wallet
```javascript
const primaryWallet = await Web3Wallet.findOne({
  where: {
    user_id: currentUser.id,
    network: 'ethereum',
    is_primary: true,
    disconnected_at: null
  }
});
```

## Integration with WalletContext

The frontend `WalletContext` should:
1. **On Connect**: Create a new Web3Wallet record
2. **On Disconnect**: Update `disconnected_at` timestamp
3. **On Balance Change**: Update `balance` and `balance_usd` fields
4. **On Chain Switch**: Update `chain_id` field
5. **On App Mount**: Query active wallets and auto-reconnect

## Security Considerations

1. **Never store private keys** - Only store public addresses
2. **Validate addresses** - Ensure addresses match the expected format for each network
3. **Rate limit balance updates** - Don't query blockchain too frequently
4. **Audit wallet access** - Log when wallets are connected/disconnected
5. **User consent** - Always require explicit user action to connect/disconnect

## Future Enhancements

- **Transaction History**: Link to WalletTransaction entity for transaction records
- **Token Balances**: Store ERC-20/SPL token balances
- **NFT Tracking**: Track NFT holdings
- **ENS/SNS Names**: Store human-readable names (ENS for Ethereum, SNS for Solana)
- **Wallet Sessions**: Track session expiry for security
- **Multi-sig Support**: Handle multi-signature wallet connections
- **Hardware Wallet**: Flag for hardware wallet connections (Ledger, Trezor)

## Base44 Configuration

In your Base44 dashboard, create the `Web3Wallet` entity with:
- Set appropriate permissions (read/write for authenticated users, only own records)
- Enable soft delete if needed (keep historical connection records)
- Set up relationships: `user_id -> User.id`
- Configure validation rules for address formats
- Set up webhooks for balance updates if needed
