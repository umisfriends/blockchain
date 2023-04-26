pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/access/Ownable.sol";
import "./openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";

interface I721{
    function mint(address to, uint256 amount) external;
}

contract OfferPinkUmi is Ownable{
    I721 public nft;
    address public signer;
    mapping(address => bool) public minted;
    event Mint(address indexed account);
    
    constructor(address _signer) {
        signer = _signer;
    }
    
    function setSigner(address _signer) external onlyOwner{
        signer = _signer;
    }
    
    function mint(uint256 deadline, uint8 v, bytes32 r, bytes32 s) external{
        require(block.timestamp <= deadline, "timeout");
        require(!minted[msg.sender], "minted");
        minted[msg.sender] = true;
        bytes32 hash = keccak256(abi.encodePacked(block.chainid, address(this), "mint", msg.sender, deadline));
        require(ECDSA.recover(hash, v, r, s) == signer, "sign error");
        nft.mint(msg.sender, 1);
    }
}