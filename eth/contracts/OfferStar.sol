pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/access/Ownable.sol";
import "./openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

contract OfferStar is Ownable{
    address public currency;
    uint256 public price;
    address public feeTo;
    event Buy(address indexed account, uint256 quantity, address currency, uint256 amount);
    
    constructor(address _currency, uint256 _price, address _feeTo){
        currency = _currency;
        price = _price;
        feeTo = _feeTo;
    }
    
    function setCurrency(address _currency) external onlyOwner{
        currency = _currency;
    }
    
    function setprice(uint256 _price) external onlyOwner{
        price = _price;
    }
    
    function setFeeTo(address _feeTo) external onlyOwner{
        feeTo = _feeTo;
    }
    
    function mint(uint256 quantity) external {
        require(quantity > 0, "zeroQuantity");
        uint256 amount = quantity * price;
        address _feeTo = feeTo == address(0) ? address(this) : feeTo;
        IERC20(currency).transferFrom(msg.sender, _feeTo, amount);
        emit Buy(msg.sender, quantity, currency, amount);
    }
    
    function claim(address to, IERC20 token, uint256 amount) external onlyOwner{
        token.transfer(to, amount);
    }
}