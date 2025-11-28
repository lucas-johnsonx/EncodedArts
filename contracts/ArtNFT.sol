// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {FHE, eaddress, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ArtNFT
/// @notice ERC721 collection with an encrypted owner field managed through Zama FHE.
contract ArtNFT is ERC721, ZamaEthereumConfig {
    uint256 private _nextTokenId = 1;
    mapping(uint256 => eaddress) private _encodedOwners;
    mapping(address => bool) private _hasMinted;
    mapping(address => uint256) private _minterTokenId;

    event Minted(address indexed minter, uint256 indexed tokenId, eaddress encodedOwner);
    event EncodedOwnerUpdated(uint256 indexed tokenId, eaddress encodedOwner);

    constructor() ERC721("ArtNFT", "ART") {}

    /// @notice Mints one NFT per wallet and stores the encrypted owner provided by the minter.
    /// @param encodedOwnerInput Zama encrypted address handle
    /// @param inputProof Proof associated to the encrypted address
    function mint(externalEaddress encodedOwnerInput, bytes calldata inputProof) external returns (uint256) {
        address minter = _msgSender();
        require(!_hasMinted[minter], "ArtNFT: mint limit reached");

        uint256 tokenId = _nextTokenId;

        _safeMint(minter, tokenId);

        eaddress encodedOwner = _setEncodedOwner(tokenId, encodedOwnerInput, inputProof, minter);

        _nextTokenId = tokenId + 1;
        _hasMinted[minter] = true;
        _minterTokenId[minter] = tokenId;

        emit Minted(minter, tokenId, encodedOwner);
        return tokenId;
    }

    /// @notice Updates the encrypted owner value for a token.
    /// @param tokenId ID of the token being updated
    /// @param encodedOwnerInput Zama encrypted address handle
    /// @param inputProof Proof associated to the encrypted address
    function transferEncoded(
        uint256 tokenId,
        externalEaddress encodedOwnerInput,
        bytes calldata inputProof
    ) external {
        address owner = ownerOf(tokenId);
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ArtNFT: not token owner or approved");

        eaddress encodedOwner = _setEncodedOwner(tokenId, encodedOwnerInput, inputProof, owner);

        emit EncodedOwnerUpdated(tokenId, encodedOwner);
    }

    /// @notice Returns the encrypted owner handle for a token.
    function encodedOwnerOf(uint256 tokenId) external view returns (eaddress) {
        _requireMinted(tokenId);
        return _encodedOwners[tokenId];
    }

    /// @notice Returns true if an address has already minted.
    function hasMinted(address account) external view returns (bool) {
        return _hasMinted[account];
    }

    /// @notice Returns the token id minted by an address, or 0 if none.
    function mintedTokenId(address account) external view returns (uint256) {
        return _minterTokenId[account];
    }

    /// @notice Total number of tokens minted.
    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    function _setEncodedOwner(
        uint256 tokenId,
        externalEaddress encodedOwnerInput,
        bytes calldata inputProof,
        address beneficiary
    ) internal returns (eaddress) {
        _requireMinted(tokenId);
        eaddress encodedOwner = FHE.fromExternal(encodedOwnerInput, inputProof);
        require(FHE.isInitialized(encodedOwner), "ArtNFT: encoded owner not initialized");

        _encodedOwners[tokenId] = encodedOwner;

        FHE.allow(encodedOwner, beneficiary);
        FHE.allowThis(encodedOwner);

        return encodedOwner;
    }
}
