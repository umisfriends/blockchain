pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/access/Ownable.sol";
import "./openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

interface I1155{
    function mint(address to, uint256 id, uint256 amount, bytes memory data) external;
}

contract Offer1155 is Ownable{
    struct Offer{
        address nft;
        uint32 id;
        uint32 maxSupply;
        uint32 supply;
        uint32 startTime;
        address currency;
        uint256 price;
    }
    Offer[] public offers;
    
    function offerLength() external view returns(uint256){
        return offers.length;
    }
    
    function newOffer(Offer calldata offer) external onlyOwner{
        require(offer.maxSupply == offer.supply, "supply equire max");
        offers.push(offer);
    }
    
    function setStartTime(uint256 round, uint32 startTime) external {
        offers[round].startTime = startTime;
    }
    
    function setSupply(uint256 round, uint32 supply, bool add) external{
        Offer storage offer = offers[round];
        if(add){
            offer.supply += supply;
            offer.maxSupply += supply;
        }else{
            offer.supply -= supply;
            offer.maxSupply -= supply;
        }
    }
    
    function setPrice(uint256 round, uint256 price) external onlyOwner{
        offers[round].price = price;
    }
    
    function setCurrencyAndPrice(uint256 round, address currency, uint256 price) external onlyOwner{
        offers[round].currency = currency;
        offers[round].price = price;
    }
    
    function claim(address currency, address to, uint256 amount) external onlyOwner{
        if(currency == address(0)){
            payable(to).transfer(amount);
        }else{
            IERC20(currency).transfer(to, amount);
        }
    }
    
    function mint(uint256 round, uint32 amount) external payable{
        offers[round].supply -= amount;
        Offer memory offer = offers[round];
        require(offer.startTime <= block.timestamp, "not start");
        uint256 currencyAmount = amount * offer.price;
        if(offer.currency == address(0)){
            require(msg.value == currencyAmount, "invalid value");
        }else if(currencyAmount > 0){
            IERC20(offer.currency).transferFrom(msg.sender, address(this), currencyAmount);
        }
        I1155(offer.nft).mint(msg.sender, offer.id, amount, hex"");
    }
}