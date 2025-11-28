# ArtNFT with FHE Encoded Owners

ArtNFT is an ERC721 collection that pairs every token with an encrypted owner handle secured by Zama's Fully Homomorphic Encryption (FHE). Any wallet can mint exactly one free NFT, update the encrypted owner, and selectively decrypt it on the client when needed. The stack includes a Hardhat project, deploy scripts, CLI tasks, tests, and a React + Vite dapp that reads with viem and writes with ethers.

## Why it stands out
- Private co-ownership: stores a second owner handle as `eaddress` so the cleartext never appears on-chain.
- User-controlled disclosure: decryption only happens client-side through the Zama relayer workflow.
- Fair distribution: one mint per wallet, enforced in the contract.
- Production-ready wiring: hardhat-deploy outputs ABI and addresses into `deployments/`, and the dapp is wired to the same artifacts.
- Clear separation of concerns: reads via viem, writes via ethers, CSS-driven UI (no Tailwind), and no frontend environment variables.

## Tech stack
- **Smart contracts**: Hardhat, TypeScript deploy scripts, `@fhevm/solidity`, OpenZeppelin ERC721 base.
- **Tooling**: `hardhat-deploy`, `@fhevm/hardhat-plugin`, TypeChain (ethers v6), Chai + Hardhat matchers, solidity-coverage, gas reporter.
- **Frontend**: React + Vite, viem for reads, ethers for writes, RainbowKit/Wagmi for wallet flows, `@zama-fhe/relayer-sdk` (Sepolia config) for encryption/decryption.
- **Artifacts**: Generated ABI and addresses live in `deployments/<network>/ArtNFT.json` and must be kept in sync with the frontend config.

## How it works
- **Mint** (`mint`): anyone can mint once. The caller passes an `externalEaddress` plus proof; the contract converts and stores it as `eaddress`, grants ACL to the beneficiary and the contract, and emits `Minted`.
- **Update encrypted owner** (`transferEncoded`): token owner or approved operators can replace the encrypted owner handle; emits `EncodedOwnerUpdated`.
- **Read paths**: `ownerOf`, `encodedOwnerOf`, `hasMinted`, `mintedTokenId`, `totalMinted` (all view functions avoid relying on `msg.sender`).
- **Frontend flow**:
  - Connect on Sepolia via RainbowKit.
  - Mint panel encrypts the provided address (defaults to the connected wallet) through the Zama relayer SDK and calls `mint`.
  - Detail panel reads owner and encoded owner handle via viem, decrypts client-side with a temporary keypair + EIP-712 signature, and lets the owner submit a new encrypted owner with `transferEncoded`.
  - Contract address and ABI are sourced from the generated `deployments/sepolia/ArtNFT.json` (copied into `home/src/config/contracts.ts`).

## Project layout
- `contracts/ArtNFT.sol` — ERC721 with encrypted owner storage and ACL setup.
- `deploy/deploy.ts` — hardhat-deploy script using the named `deployer`.
- `tasks/artnft.ts` — CLI helpers for address lookup, minting, and encrypted owner inspection.
- `test/ArtNFT.ts` — FHE mock-based tests for minting, limits, and encrypted owner updates.
- `home/` — React dapp (no Tailwind, no frontend env vars). Key files: `src/components/ArtDashboard.tsx`, `src/config/contracts.ts`, `src/hooks/useZamaInstance.ts`.
- `deployments/` — per-network ABI + address outputs consumed by both backend and frontend.

## Requirements
- Node.js >= 20 and npm >= 7.
- `.env` in the repo root with:
  - `INFURA_API_KEY`
  - `PRIVATE_KEY` (hex string; do not prefix with `0x`; mnemonic is not used)
  - `ETHERSCAN_API_KEY` (optional, for verification)
- Fund the private key on Sepolia before deploying.

## Backend workflow
```bash
# Install deps
npm install

# Compile Solidity and generate TypeChain bindings
npm run compile

# Run tests (uses the FHE mock; tests are skipped if the mock is unavailable)
npm test

# Start a local chain if you need manual interactions
npm run chain    # hardhat node --no-deploy
```

Deployment (writes artifacts to `deployments/<network>` automatically):
```bash
# Localhost deployment
npx hardhat deploy --network localhost

# Sepolia deployment (uses INFURA_API_KEY + PRIVATE_KEY)
npx hardhat deploy --network sepolia

# Optional: verify on Sepolia
npx hardhat verify --network sepolia <deployed-address>
```
After deploying to Sepolia, confirm the address in `deployments/sepolia/ArtNFT.json` and keep the frontend copy (`home/src/config/contracts.ts`) in sync with it.

### Useful Hardhat tasks
- `npx hardhat task:art-address` — print the deployed ArtNFT address.
- `npx hardhat task:mint-art --owner <address?> --address <contract?>` — mint one NFT with an encrypted owner (defaults to signer and latest deployment).
- `npx hardhat task:encoded-owner --token-id <id> --address <contract?>` — fetch owner, encoded owner handle, and decrypt it via the CLI helper.

## Frontend (`home`) workflow
```bash
cd home
npm install
npm run dev     # local preview against Sepolia
npm run build   # production build
```
Before running, set `CONTRACT_ADDRESS` in `home/src/config/contracts.ts` to the live Sepolia address from `deployments/sepolia/ArtNFT.json`. The ABI in that file should always be copied from the same JSON to stay exact with the deployed contract.

App behaviors:
- Displays total minted, your token id (if minted), contract address, and warnings if Sepolia/contract are misconfigured.
- Mint form encrypts the provided address, submits `mint`, and auto-selects your token id after confirmation.
- Token detail panel reads `ownerOf` and `encodedOwnerOf`, lets you decrypt the encoded owner client-side, and update it through `transferEncoded`.
- All reads use viem; writes use ethers; encryption/decryption use `@zama-fhe/relayer-sdk` (SepoliaConfig).

## Problems this project solves
- **Privacy for ownership handoff**: keeps a second owner field confidential while remaining enforceable on-chain.
- **Selective disclosure**: only users with the right key material and signature can decrypt; the chain never sees the plaintext.
- **Operational simplicity**: single free mint per wallet prevents spam; deploy scripts and tasks remove manual ABI/address drift.
- **End-to-end parity**: the same ABI powers contracts, scripts, and the dapp—no mocks or placeholder data on the frontend.

## Future plans
- Add NFT metadata hosting and `tokenURI` integration for richer visuals.
- Extend encrypted fields (e.g., encrypted transfer notes) and multi-recipient ACL patterns.
- Harden UX with transaction state persistence, better relayer error surfaces, and mobile-first refinements.
- Multi-network support once FHE-ready mainnets are available, plus automated ABI/address syncing to the frontend.
- Optional role-based controls for who can update encrypted owners beyond the token owner/approved operators.

## Notes and tips
- Keep `deployments/sepolia/ArtNFT.json` authoritative; the frontend must use this ABI and the latest address.
- The contract rejects uninitialized encrypted owners; ensure inputs are created via the relayer SDK before calling.
- Tests rely on the FHE mock included in the Hardhat plugin; they skip automatically if the mock is disabled.
