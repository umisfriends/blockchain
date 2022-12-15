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

contract Registry is Ownable{
    struct Info{
        address costToken;
        uint256 costAmount;
        address box;
        uint32 boxAmount;
        address badge;
        uint32 badgeId;
        uint32 badgeAmount;
    }
    address public signer;
    Info public info;
    address public feeTo;
    mapping(address => uint256) public regTime;
    address[] public team;
    event Register(address indexed team, address token, uint256 cost);
    
    constructor(address _signer, address _feeTo, Info memory _info){
        signer = _signer;
        feeTo = _feeTo;
        info = _info;
    }
    
    function teamNumber() external view returns(uint256){
        return team.length;
    }
    
    function setSigner(address _signer) external onlyOwner{
        signer = _signer;
    }
    
    function setFeeTo(address _feeTo) external onlyOwner{
        feeTo = _feeTo;
    }
    
    function setInfo(Info calldata _info) external onlyOwner{
        info = _info;
    }
    
    function register(uint256 deadline, uint8 v, bytes32 r, bytes32 s) external{
        require(block.timestamp <= deadline, "timeout");
        require(regTime[msg.sender] == 0, "registered");
        bytes32 hash = keccak256(abi.encodePacked(block.chainid, address(this), "register", msg.sender, deadline));
        require(ECDSA.recover(hash, v, r, s) == signer, "sign error");
        Info memory i = info; 
        IERC20(i.costToken).transferFrom(msg.sender, feeTo == address(0) ? address(this) : feeTo, i.costAmount);
        regTime[msg.sender] = block.timestamp;
        team.push(msg.sender);
        I721(i.box).mint(msg.sender, i.boxAmount);
        I1155(i.badge).mint(msg.sender, i.badgeId, i.badgeAmount, "");
        emit Register(msg.sender, i.costToken, i.costAmount);
    }
    
    function claim(IERC20 token, address to, uint256 amount) external onlyOwner{
        token.transfer(to, amount);
    }
}