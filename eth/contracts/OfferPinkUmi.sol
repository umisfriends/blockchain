pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/access/Ownable.sol";
import "./openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";

interface I721{
    function mint(address to, uint256 amount) external;
}

contract OfferPinkUmi is Ownable{
    I721 public nft;
    address public signer;
    uint256 _supply;
    uint256 _startTime;
    uint256 _endTime;
    mapping(address => bool) public minted;
    event Mint(address indexed account);
    
    constructor(I721 _nft, address _signer, uint256 supply, uint256 startTime, uint256 endTime) {
        nft = _nft;
        signer = _signer;
        _supply = supply;
        _startTime = startTime;
        _endTime = endTime;
    }
    
    function setSigner(address _signer) external onlyOwner{
        signer = _signer;
    }

    function setStartTime(uint256 startTime) external onlyOwner{
        _startTime = startTime;
    }

    function setEndTime(uint256 endTime) external onlyOwner{
        _endTime = endTime;
    }

    function setSupply(uint256 supply) external onlyOwner{
        _supply = supply;
    }

    function info() external view returns(uint256 supply, uint256 startTime, uint256 endTime){
        return (_supply, _startTime, _endTime);
    }
    
    function mint(uint256 deadline, uint8 v, bytes32 r, bytes32 s) external{
        require(block.timestamp >= _startTime && block.timestamp <= _endTime, "not open");
        _supply--;
        require(block.timestamp <= deadline, "timeout");
        require(!minted[msg.sender], "minted");
        minted[msg.sender] = true;
        bytes32 hash = keccak256(abi.encodePacked(block.chainid, address(this), "mint", msg.sender, deadline));
        require(ECDSA.recover(hash, v, r, s) == signer, "sign error");
        nft.mint(msg.sender, 1);
        emit Mint(msg.sender);
    }
}