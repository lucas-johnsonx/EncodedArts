import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { ArtNFT, ArtNFT__factory } from "../types";

describe("ArtNFT", function () {
  let deployer: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let artNft: ArtNFT;
  let contractAddress: string;

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }

    [deployer, alice, bob] = await ethers.getSigners();

    const factory = (await ethers.getContractFactory("ArtNFT")) as ArtNFT__factory;
    artNft = (await factory.deploy()) as ArtNFT;
    contractAddress = await artNft.getAddress();
  });

  it("mints one token with encrypted owner", async function () {
    const encryptedOwner = await fhevm.encryptAddress(alice.address, contractAddress, alice.address);
    const tx = await artNft.connect(alice).mint(encryptedOwner.externalEaddress, encryptedOwner.inputProof);
    await tx.wait();

    const mintedId = await artNft.mintedTokenId(alice.address);
    expect(mintedId).to.eq(1n);
    expect(await artNft.totalMinted()).to.eq(1n);
    expect(await artNft.ownerOf(mintedId)).to.eq(alice.address);
    expect(await artNft.hasMinted(alice.address)).to.eq(true);

    const encodedHandle = await artNft.encodedOwnerOf(mintedId);
    const clearOwner = await fhevm.userDecryptEaddress(encodedHandle, contractAddress, alice);
    expect(clearOwner).to.eq(alice.address);
  });

  it("prevents the same address from minting twice", async function () {
    const encryptedOwner = await fhevm.encryptAddress(alice.address, contractAddress, alice.address);
    await artNft.connect(alice).mint(encryptedOwner.externalEaddress, encryptedOwner.inputProof);

    const secondAttempt = await fhevm.encryptAddress(alice.address, contractAddress, alice.address);
    await expect(
      artNft.connect(alice).mint(secondAttempt.externalEaddress, secondAttempt.inputProof),
    ).to.be.revertedWith("ArtNFT: mint limit reached");
  });

  it("lets the owner update the encrypted owner field", async function () {
    const encryptedOwner = await fhevm.encryptAddress(alice.address, contractAddress, alice.address);
    await artNft.connect(alice).mint(encryptedOwner.externalEaddress, encryptedOwner.inputProof);

    const updatedOwner = await fhevm.encryptAddress(bob.address, contractAddress, alice.address);
    const tx = await artNft
      .connect(alice)
      .transferEncoded(1n, updatedOwner.externalEaddress, updatedOwner.inputProof);
    await tx.wait();

    const encodedHandle = await artNft.encodedOwnerOf(1n);
    const clearOwner = await fhevm.userDecryptEaddress(encodedHandle, contractAddress, alice);
    expect(clearOwner).to.eq(bob.address);
  });
});
