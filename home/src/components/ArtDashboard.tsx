import { useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { Contract } from 'ethers';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import '../styles/ArtDashboard.css';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const SEPOLIA_CHAIN_ID = 11155111;

const formatValue = (value?: bigint) => (value ? value.toString() : '—');

const maskAddress = (value?: string) => {
  if (!value) return '—';
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

export function ArtDashboard() {
  const { address, status } = useAccount();
  const chainId = useChainId();
  const signer = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [encodedOwnerInput, setEncodedOwnerInput] = useState('');
  const [targetTokenId, setTargetTokenId] = useState('');
  const [newEncodedOwner, setNewEncodedOwner] = useState('');
  const [decodedOwner, setDecodedOwner] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [toast, setToast] = useState('');

  const isContractReady = CONTRACT_ADDRESS !== ZERO_ADDRESS;
  const isOnSepolia = chainId === undefined || chainId === null || chainId === SEPOLIA_CHAIN_ID;

  const totalMintedQuery = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'totalMinted',
    query: { enabled: isContractReady },
  });

  const hasMintedQuery = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'hasMinted',
    args: address ? [address] : undefined,
    query: { enabled: isContractReady && Boolean(address) },
  });

  const mintedTokenQuery = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'mintedTokenId',
    args: address ? [address] : undefined,
    query: { enabled: isContractReady && Boolean(address) },
  });

  const selectedTokenId = useMemo(() => {
    if (targetTokenId) {
      try {
        const parsed = BigInt(targetTokenId);
        if (parsed > 0n) return parsed;
      } catch (err) {
        return null;
      }
    }
    if (mintedTokenQuery.data && mintedTokenQuery.data > 0n) {
      return mintedTokenQuery.data;
    }
    return null;
  }, [mintedTokenQuery.data, targetTokenId]);

  useEffect(() => {
    if (!targetTokenId && mintedTokenQuery.data && mintedTokenQuery.data > 0n) {
      setTargetTokenId(mintedTokenQuery.data.toString());
    }
  }, [mintedTokenQuery.data, targetTokenId]);

  const ownerQuery = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'ownerOf',
    args: selectedTokenId ? [selectedTokenId] : undefined,
    query: { enabled: isContractReady && Boolean(selectedTokenId) },
  });

  const encodedOwnerQuery = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'encodedOwnerOf',
    args: selectedTokenId ? [selectedTokenId] : undefined,
    query: { enabled: isContractReady && Boolean(selectedTokenId) },
  });

  useEffect(() => {
    setDecodedOwner(null);
  }, [encodedOwnerQuery.data, selectedTokenId]);

  const refetchReads = async () => {
    await Promise.all([
      totalMintedQuery.refetch?.(),
      hasMintedQuery.refetch?.(),
      mintedTokenQuery.refetch?.(),
      ownerQuery.refetch?.(),
      encodedOwnerQuery.refetch?.(),
    ]);
  };

  const encryptAddress = async (value: string) => {
    if (!instance || !address) {
      throw new Error('Encryption not ready');
    }
    const buffer = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
    buffer.addAddress(value);
    return buffer.encrypt();
  };

  const mintArt = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!instance || !address || !signer) {
      setToast('Connect wallet and wait for the encryption service.');
      return;
    }
    if (!isContractReady) {
      setToast('Set a deployed contract address in deployments/sepolia/ArtNFT.json.');
      return;
    }

    setMinting(true);
    setToast('');
    try {
      const encrypted = await encryptAddress(encodedOwnerInput || address);
      const resolvedSigner = await signer;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);
      const tx = await contract.mint(encrypted.handles[0], encrypted.inputProof);
      setToast('Submitted, waiting for confirmation...');
      await tx.wait();
      setToast('Minted successfully. Refreshing...');
      await refetchReads();
      const refreshed = await mintedTokenQuery.refetch?.();
      const mintedId = (refreshed?.data ?? mintedTokenQuery.data) as bigint | undefined;
      if (mintedId && mintedId > 0n) {
        setTargetTokenId(mintedId.toString());
      }
    } catch (error) {
      console.error('Mint failed:', error);
      setToast('Mint failed. Check console for details.');
    } finally {
      setMinting(false);
    }
  };

  const updateEncodedOwner = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!instance || !address || !signer || !selectedTokenId) {
      setToast('Missing token id or signer.');
      return;
    }
    setUpdating(true);
    setToast('');
    try {
      const encrypted = await encryptAddress(newEncodedOwner || address);
      const resolvedSigner = await signer;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);
      const tx = await contract.transferEncoded(selectedTokenId, encrypted.handles[0], encrypted.inputProof);
      setToast('Updating encoded owner...');
      await tx.wait();
      await refetchReads();
      setToast('Encrypted owner updated.');
      setNewEncodedOwner('');
    } catch (error) {
      console.error('Update failed:', error);
      setToast('Failed to update encoded owner.');
    } finally {
      setUpdating(false);
    }
  };

  const decryptEncodedOwner = async () => {
    if (!instance || !address || !encodedOwnerQuery.data || !signer) {
      setToast('Connect wallet and load token data first.');
      return;
    }
    setDecrypting(true);
    setDecodedOwner(null);
    try {
      const keypair = instance.generateKeypair();
      const handle = encodedOwnerQuery.data as string;
      const startTimestamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '7';
      const eip712 = instance.createEIP712(keypair.publicKey, [CONTRACT_ADDRESS], startTimestamp, durationDays);
      const resolvedSigner = await signer;
      const signature = await resolvedSigner.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );

      const result = await instance.userDecrypt(
        [{ handle, contractAddress: CONTRACT_ADDRESS }],
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        [CONTRACT_ADDRESS],
        address,
        startTimestamp,
        durationDays
      );

      const clear = result[handle];
      setDecodedOwner(typeof clear === 'string' ? clear : null);
    } catch (error) {
      console.error('Decrypt failed:', error);
      setToast('Decryption failed. See console for details.');
    } finally {
      setDecrypting(false);
    }
  };

  const mintDisabled =
    !isContractReady ||
    !isOnSepolia ||
    zamaLoading ||
    hasMintedQuery.data === true ||
    !address ||
    status !== 'connected' ||
    minting;

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Encrypted ownership</p>
          <h2>ArtNFT Studio</h2>
          <p className="lede">
            Mint a single ArtNFT, store an encrypted owner with Zama FHE, and decrypt it only when you approve.
          </p>
          {!isContractReady && (
            <p className="warning">
              Add a live contract address to <code>deployments/sepolia/ArtNFT.json</code> to activate the dapp.
            </p>
          )}
          {!isOnSepolia && (
            <p className="warning">
              Switch to Sepolia to interact with the contract (chain id: {SEPOLIA_CHAIN_ID}).
            </p>
          )}
          {zamaError && <p className="warning">Encryption service error: {zamaError}</p>}
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <p className="stat-label">Total minted</p>
            <p className="stat-value">{formatValue(totalMintedQuery.data as bigint | undefined)}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Your token</p>
            <p className="stat-value">
              {hasMintedQuery.data ? formatValue(mintedTokenQuery.data as bigint | undefined) : 'Not minted'}
            </p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Contract</p>
            <p className="stat-value small">{maskAddress(CONTRACT_ADDRESS)}</p>
          </div>
        </div>
      </section>

      <section className="panels">
        <form className="panel" onSubmit={mintArt}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Mint once</p>
              <h3>Claim your ArtNFT</h3>
            </div>
            {hasMintedQuery.data && <span className="chip">Minted</span>}
          </div>
          <p className="body">
            Anyone can mint a single ArtNFT for free. Provide the address you want to encrypt as the encoded owner or
            leave it as your connected wallet.
          </p>
          <label className="field">
            <span>Address to encrypt</span>
            <input
              type="text"
              value={encodedOwnerInput}
              onChange={(e) => setEncodedOwnerInput(e.target.value)}
              placeholder={address || '0x...'}
            />
          </label>
          <button type="submit" className="primary" disabled={mintDisabled}>
            {minting ? 'Minting...' : hasMintedQuery.data ? 'Already minted' : 'Mint ArtNFT'}
          </button>
          {toast && <p className="hint">{toast}</p>}
        </form>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Token details</p>
              <h3>Owner & encoded owner</h3>
            </div>
            <div className="chip muted">Read via viem</div>
          </div>
          <div className="inline-grid">
            <label className="field">
              <span>Token id</span>
              <input
                type="number"
                value={targetTokenId}
                min={1}
                onChange={(e) => setTargetTokenId(e.target.value)}
                placeholder="1"
              />
            </label>
            <div className="field readonly">
              <span>Current owner</span>
              <p className="value">{maskAddress(ownerQuery.data as string | undefined)}</p>
            </div>
            <div className="field readonly">
              <span>Encoded owner handle</span>
              <p className="value small">
                {encodedOwnerQuery.data ? (encodedOwnerQuery.data as string).slice(0, 18) + '...' : '—'}
              </p>
            </div>
          </div>
          <div className="actions-row">
            <button className="ghost" type="button" onClick={decryptEncodedOwner} disabled={decrypting || !encodedOwnerQuery.data}>
              {decrypting ? 'Decrypting...' : 'Decrypt encoded owner'}
            </button>
            {decodedOwner && <span className="chip success">Decoded: {maskAddress(decodedOwner)}</span>}
          </div>
          <form className="stacked" onSubmit={updateEncodedOwner}>
            <label className="field">
              <span>Update encoded owner</span>
              <input
                type="text"
                value={newEncodedOwner}
                onChange={(e) => setNewEncodedOwner(e.target.value)}
                placeholder="0x... new encrypted owner"
              />
            </label>
            <button className="secondary" type="submit" disabled={updating || !selectedTokenId}>
              {updating ? 'Updating...' : 'Save encrypted owner'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
