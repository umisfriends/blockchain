pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/access/Ownable.sol";
import "./openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import "./openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

interface I721{
    function mint(address to, uint256 amount) external;
}

interface I1155{
    function mint(address to, uint256 id, uint256 amount, bytes memory data) external;
}

contract TeamRegistry is Ownable{
    struct Info{
        IERC20 costToken;
        uint256 costAmount;
        I721 box;
        uint32 boxAmount;
        I1155 blade;
        uint32 bladeId;
        uint32 bladeAmount;
    }
    address public signer;
    Info public info;
    event Register(address indexed team, address token, uint256 cost);
    
    constructor(address _signer){
        signer = _signer;
    }
    
    function setSigner(address _signer) external onlyOwner{
        signer = _signer;
    }
    
    function setInfo(Info calldata _info) external onlyOwner{
        info = _info;
    }
    
    function register(uint256 deadline, uint8 v, bytes32 r, bytes32 s) external{
        require(block.timestamp <= deadline, "timeout");
        bytes32 hash = keccak256(abi.encodePacked(block.chainid, address(this), "register", msg.sender, deadline));
        require(ECDSA.recover(hash, v, r, s) == signer, "sign error");
        Info memory i = info; 
        i.costToken.transferFrom(msg.sender, address(this), i.costAmount);
        i.box.mint(msg.sender, i.boxAmount);
        i.blade.mint(msg.sender, i.bladeId, i.bladeAmount, "");
        emit Register(msg.sender, address(i.costToken), i.costAmount);
    }
    
    function claim(IERC20 token, address to, uint256 amount) external onlyOwner{
        token.transfer(to, amount);
    }
}