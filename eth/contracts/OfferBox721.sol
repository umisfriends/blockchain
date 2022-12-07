pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/access/Ownable.sol";
import "./openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "./openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";

interface I721{
    function mint(address to, uint256 amount) external;
}

contract Offer721 is Ownable{
    struct Offer{
        address nft;
        uint32 startTime;
        address currency;
        uint256 price1;
        uint256 price2;
    }
    Offer[] public offers;
    address public signer;
    mapping(address => uint256) public minted;
    event Mint(uint256 indexed round, address indexed account, uint256 amount, uint256 currencyAmount);
    
    constructor(address _signer) {
        signer = _signer;
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
    
    function setPrice(uint256 round, uint256 price1, uint256 price2) external onlyOwner{
        offers[round].price1 = price1;
        offers[round].price2 = price2;
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
    
    function _mint(uint256 round, uint256 amount, bool whitelist) internal{
        Offer memory offer = offers[round];
        require(offer.startTime <= block.timestamp, "not start");
        uint256 currencyAmount = whitelist ? amount * offer.price1 : amount * offer.price2;
        if(offer.currency == address(0)){
            require(msg.value == currencyAmount, "invalid value");
        }else if(currencyAmount > 0){
            IERC20(offer.currency).transferFrom(msg.sender, address(this), currencyAmount);
        }
        I721(offer.nft).mint(msg.sender, amount);
        emit Mint(round, msg.sender, amount, currencyAmount);
    }
    
    function mint(uint256 round, uint256 amount) external{
        _mint(round, amount, false);
    }
    
    function permitMint(uint256 round, uint256 amount, uint256 maxPermit, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external payable{
        require(block.timestamp <= deadline, "timeout");
        minted[msg.sender] += amount;
        require(minted[msg.sender] <= maxPermit, "not enough permit");
        bytes32 hash = keccak256(abi.encodePacked(block.chainid, address(this), "mint", round, msg.sender, maxPermit, deadline));
        require(ECDSA.recover(hash, v, r, s) == signer, "not signer");
        _mint(round, amount, true);
    }
}