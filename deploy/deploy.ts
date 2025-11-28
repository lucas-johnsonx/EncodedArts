import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const artNFT = await deploy("ArtNFT", {
    from: deployer,
    log: true,
  });

  console.log(`ArtNFT contract: `, artNFT.address);
};
export default func;
func.id = "deploy_artnft"; // id required to prevent reexecution
func.tags = ["ArtNFT"];
