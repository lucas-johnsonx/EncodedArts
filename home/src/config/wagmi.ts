import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'ArtNFT Studio',
  projectId: '0a26f6ba3f4d4e8d9f18f6f7094ea2d2',
  chains: [sepolia],
  ssr: false,
});
