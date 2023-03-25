pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/access/Ownable.sol";
import "./openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

interface I1155{
    function mint(address to, uint256 id, uint256 amount, bytes memory data) external;
}

interface I721{
    function mint(address to, uint256 amount) external;
}

contract OfferBadge is Ownable{
    struct Info{
        address badge;
        address box;
        address currency;
        uint256 price;
        uint256 boxReward;
    }
    Info public info;
    address public feeTo;
    event Mint(address indexed user, uint256 amount, uint256 currencyAmount);

    constructor(address _feeTo, Info memory _info){
        feeTo = _feeTo;
        info = _info;
    }

    function setInfo(Info memory _info) external onlyOwner{
        info = _info;
    }

    function setFeeTo(address _feeTo) external onlyOwner{
        feeTo = _feeTo;
    }

    function mint(uint256 amount) external onlyOwner{
        uint256 currencyAmount = amount * info.price;
        IERC20(info.currency).transferFrom(msg.sender, feeTo == address(0) ? address(this) : feeTo, currencyAmount);
        I1155(info.badge).mint(msg.sender, 0, amount, "");
        I721(info.box).mint(msg.sender, amount * info.boxReward);
    }
}