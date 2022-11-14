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
        uint32 maxSupply;
        uint32 supply;
        uint32 startTime;
        uint32 limitPerAddr;
        uint32 discount;
        address currency;
        uint256 price;
    }
    Offer[] public offers;
    mapping(uint256 => mapping(address => uint256)) public minted;
    address public signer;
    event Mint(uint256 indexed round, address indexed account, uint256 amount, uint256 currencyAmount);
    
    constructor(address _signer) {
        signer = _signer;
    }
    
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
    
    function setLimitPerAddr(uint256 round, uint32 limitPerAddr) external onlyOwner{
        offers[round].limitPerAddr = limitPerAddr;
    }
    
    function setDiscount(uint256 round, uint32 discount) external onlyOwner{
        offers[round].discount = discount;
    }
    
    function setSigner(address _signer) external onlyOwner{
        signer = _signer;
    }
    
    function claim(address currency, address to, uint256 amount) external onlyOwner{
        if(currency == address(0)){
            payable(to).transfer(amount);
        }else{
            IERC20(currency).transfer(to, amount);
        }
    }
    
    function _mint(uint256 round, uint32 amount, bool whitelist) internal{
        offers[round].supply -= amount;
        Offer memory offer = offers[round];
        require(offer.startTime <= block.timestamp, "not start");
        minted[round][msg.sender] += amount;
        require(offer.limitPerAddr == 0 || minted[round][msg.sender] <= offer.limitPerAddr, "limitPerAddr");
        uint256 currencyAmount = amount * offer.price;
        if(whitelist) currencyAmount = currencyAmount * offer.discount / 100;
        if(offer.currency == address(0)){
            require(msg.value == currencyAmount, "invalid value");
        }else if(currencyAmount > 0){
            IERC20(offer.currency).transferFrom(msg.sender, address(this), currencyAmount);
        }
        I1155(offer.nft).mint(msg.sender, offer.id, amount, hex"");
        emit Mint(round, msg.sender, amount, currencyAmount);
    }
    
    function mint(uint256 round, uint32 amount) external{
        _mint(round, amount, false);
    }
    
    function whitelistMint(uint256 round, uint32 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external payable{
        require(block.timestamp <= deadline, "timeout");
        bytes32 hash = keccak256(abi.encodePacked(block.chainid, address(this), "mint", round, msg.sender, deadline));
        require(ECDSA.recover(hash, v, r, s) == signer, "not signer");
        _mint(round, amount, true);
    }
}