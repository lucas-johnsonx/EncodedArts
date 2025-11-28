import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <div className="topbar__mark">Art</div>
        <div>
          <p className="topbar__eyebrow">FHE-powered NFT</p>
          <h1 className="topbar__title">ArtNFT Console</h1>
        </div>
      </div>
      <ConnectButton label="Connect wallet" />
    </header>
  );
}
