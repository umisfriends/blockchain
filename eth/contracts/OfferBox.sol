pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/access/Ownable.sol";
import "./openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import "./openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

interface I721{
    function mint(address to, uint256 amount) external;
}

contract OfferBox is Ownable{
    struct Info{
        address nft;
        address currency;
        uint256 price;
    }
    Info public info;
    address public signer;
    address public feeTo;
    event Mint(address indexed user, uint256 amount, uint256 currencyAmount);

    constructor(address _feeTo, address _signer, Info memory _info){
        feeTo = _feeTo;
        signer = _signer;
        info = _info;
    }

    function setInfo(Info memory _info) external onlyOwner{
        info = _info;
    }

    function setFeeTo(address _feeTo) external onlyOwner{
        feeTo = _feeTo;
    }

    function setSigner(address _signer) external onlyOwner{
        signer = _signer;
    }

    function mint(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external{
        require(block.timestamp <= deadline, "timeout");
        bytes32 hash = keccak256(abi.encodePacked(block.chainid, address(this), "mint", msg.sender, amount, deadline));
        require(ECDSA.recover(hash, v, r, s) == signer, "not signer");
        uint256 currencyAmount = amount*info.price;
        IERC20(info.currency).transferFrom(msg.sender, feeTo == address(0) ? address(this) : feeTo, currencyAmount);
        I721(info.nft).mint(msg.sender, amount);
        emit Mint(msg.sender, amount, currencyAmount);
    }

    function claim(address currency, address to, uint256 amount) external onlyOwner{
        IERC20(currency).transfer(to, amount);
    }
}