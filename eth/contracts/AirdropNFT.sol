pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/access/Ownable.sol";

interface INFT{
    function mint(address to, uint256 amount) external;
}

contract AirdropNFT is Ownable{
    function mint(address nft, uint256 amount, address[] calldata addresses) external onlyOwner{
        for(uint256 i = 0; i < addresses.length; i++){
            INFT(nft).mint(addresses[i], amount);
        }
    }
}