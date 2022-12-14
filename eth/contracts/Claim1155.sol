pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/access/Ownable.sol";
import "./openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";

interface I1155{
    function mint(address to, uint256 id, uint256 amount, bytes memory data) external;
}

contract Claim1155 is Ownable{
    address public signer;
    mapping(address => mapping(address => mapping(uint256 => uint256))) public minted;
    event Claimed(address indexed to, address indexed token, uint256 indexed id, uint256 amount);
    
    constructor(address _signer){
        signer = _signer;
    }
    
    function setSigner(address _signer) external onlyOwner{
        signer = _signer;
    }
    
    function claim(address token, uint256 id, uint256 amount, uint256 maxPermit, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external{
        address to = msg.sender;
        require(block.timestamp <= deadline, "timeout");
        minted[to][token][id] += amount;
        require(amount > 0 && minted[to][token][id] <= maxPermit, "invalid amount");
        bytes32 hash = keccak256(abi.encodePacked(block.chainid, address(this), "claim", to, token, id, maxPermit, deadline));
        require(ECDSA.recover(hash, v, r, s) == signer, "sign error");
        I1155(token).mint(to, id, amount, "");
        emit Claimed(to, token, id, amount);
    }
}