pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/access/Ownable.sol";
import "./openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "./openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";

interface I1155{
    function mint(address to, uint256 id, uint256 amount, bytes memory data) external;
}

contract Offer1155 is Ownable{
    struct Offer{
        address nft;
        uint32 id;
        uint32 startTime;
        address currency;
        uint256 price;
    }
    Offer[] public offers;
    address public feeTo;
    event Mint(uint256 indexed round, address indexed account, uint256 amount, uint256 currencyAmount);
    
    constructor(address _feeTo) {
        feeTo = _feeTo;
    }
    
    function offerLength() external view returns(uint256){
        return offers.length;
    }
    
    function newOffer(Offer calldata offer) external onlyOwner{
        offers.push(offer);
    }
    
    function setStartTime(uint256 round, uint32 startTime) external {
        offers[round].startTime = startTime;
    }
    
    function setPrice(uint256 round, uint256 price) external onlyOwner{
        offers[round].price = price;
    }
    
    function setCurrencyAndPrice(uint256 round, address currency, uint256 price) external onlyOwner{
        offers[round].currency = currency;
        offers[round].price = price;
    }
    
    function setFeeTo(address _feeTo) external onlyOwner{
        feeTo = _feeTo;
    }
    
    function claim(address currency, address to, uint256 amount) external onlyOwner{
        if(currency == address(0)){
            payable(to).transfer(amount);
        }else{
            IERC20(currency).transfer(to, amount);
        }
    }
    
    function mint(uint256 round, uint32 amount) external payable{
        Offer memory offer = offers[round];
        require(offer.startTime <= block.timestamp, "not start");
        uint256 currencyAmount = amount * offer.price;
        if(offer.currency == address(0)){
            require(msg.value == currencyAmount, "invalid value");
            if(feeTo != address(0)) payable(feeTo).transfer(currencyAmount);
        }else if(currencyAmount > 0){
            IERC20(offer.currency).transferFrom(msg.sender, feeTo == address(0) ? address(this) : feeTo, currencyAmount);
        }
        I1155(offer.nft).mint(msg.sender, offer.id, amount, "");
        emit Mint(round, msg.sender, amount, currencyAmount);
    }
}