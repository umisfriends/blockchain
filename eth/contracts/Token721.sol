pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/access/Ownable.sol";
import "./openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract Token721 is Ownable, ERC721Enumerable{
    string private _uri;
    mapping(address => bool) public minters;
    
    modifier onlyMinter(){
        require(minters[msg.sender], "onlyMinter");
        _;
    }
    
    constructor(string memory name, string memory symbol, string memory uri) ERC721(name, symbol){
        _uri = uri;
    }
    
    function _baseURI() internal view override returns (string memory) {
        return _uri;
    }
    
    function setBaseUri(string calldata uri) external onlyOwner{
        _uri = uri;
    }
    
    function setMinter(address account, bool enable) external onlyOwner{
        minters[account] = enable;
    }
    
    function mint(address to, uint256 amount) external onlyMinter{
        uint256 start = totalSupply();
        uint256 end = start + amount;
        while(start < end){
            _mint(to, start++);
        }
    }
    
    function safeMint(address to, uint256 amount) external onlyMinter{
        uint256 start = totalSupply();
        uint256 end = start + amount;
        while(start < end){
            _safeMint(to, start++, "");
        }
    }
}