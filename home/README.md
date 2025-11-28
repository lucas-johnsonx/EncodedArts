# ArtNFT Dapp

React + Vite frontend for the ArtNFT contract. Reads use viem, writes use ethers, and encryption flows through the Zama relayer SDK.

## Run it
```bash
npm install
npm run dev     # start locally
npm run build   # production build
```

Update the on-chain address in `src/config/contracts.ts` after deploying the ArtNFT contract to Sepolia (`deployments/sepolia/ArtNFT.json` holds the ABI). Connect with RainbowKit (WalletConnect project id is inline in `src/config/wagmi.ts`—change it if you use your own).
