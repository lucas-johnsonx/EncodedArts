import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:art-address", "Prints the ArtNFT address").setAction(async (_taskArguments: TaskArguments, hre) => {
  const { deployments } = hre;
  const deployment = await deployments.get("ArtNFT");
  console.log(`ArtNFT address is ${deployment.address}`);
});

task("task:mint-art", "Mints an ArtNFT with an encrypted owner")
  .addOptionalParam("address", "Optionally specify the ArtNFT contract address")
  .addOptionalParam("owner", "Plain address to encrypt for encodedOwner (defaults to signer)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const artDeployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("ArtNFT");
    const [signer] = await ethers.getSigners();

    const addressToEncrypt = (taskArguments.owner as string | undefined) ?? signer.address;
    const encryptedOwner = await fhevm.encryptAddress(addressToEncrypt, artDeployment.address, signer.address);

    const artNft = await ethers.getContractAt("ArtNFT", artDeployment.address);
    const tx = await artNft.connect(signer).mint(encryptedOwner.externalEaddress, encryptedOwner.inputProof);
    console.log(`Wait for tx: ${tx.hash}...`);
    const receipt = await tx.wait();

    const total = await artNft.totalMinted();
    console.log(`Minted tokenId ${total} for ${signer.address}; status=${receipt?.status}`);
  });

task("task:encoded-owner", "Decrypts encoded owner for a token id")
  .addOptionalParam("address", "Optionally specify the ArtNFT contract address")
  .addParam("tokenId", "Token id to inspect")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const artDeployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("ArtNFT");
    const tokenId = BigInt(taskArguments.tokenId as string);
    const [signer] = await ethers.getSigners();

    const artNft = await ethers.getContractAt("ArtNFT", artDeployment.address);
    const encodedOwner = await artNft.encodedOwnerOf(tokenId);
    const onchainOwner = await artNft.ownerOf(tokenId);
    const clearOwner = await fhevm.userDecryptEaddress(encodedOwner, artDeployment.address, signer);

    console.log(`Token ${tokenId}`);
    console.log(` owner        : ${onchainOwner}`);
    console.log(` encodedOwner : ${encodedOwner}`);
    console.log(` decodedOwner : ${clearOwner}`);
  });
