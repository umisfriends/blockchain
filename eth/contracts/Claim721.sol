pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/access/Ownable.sol";
import "./openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";

interface I721{
    function mint(address to, uint256 amount) external;
}

contract Claim721 is Ownable{
    address public signer;
    mapping(address => uint256) public nonces;
    event Claimed(address indexed to, uint256 indexed nonce, address token, uint256 amount);
    
    constructor(address _signer){
        signer = _signer;
    }
    
    function setSigner(address _signer) external onlyOwner{
        signer = _signer;
    }
    
    function claim(address token, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external{
        address to = msg.sender;
        uint256 nonce = nonces[to];
        require(block.timestamp <= deadline, "timeout");
        bytes32 hash = keccak256(abi.encodePacked(block.chainid, address(this), "claim", to, token, amount, nonce, deadline));
        require(ECDSA.recover(hash, v, r, s) == signer, "sign error");
        I721(token).mint(to, amount);
        emit Claimed(to, nonce, token, amount);
        nonces[to]++;
    }
}