pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract TestERC721 is ERC721Enumerable{
    string private _uri;
    
    constructor(string memory name, string memory symbol, string memory uri) ERC721(name, symbol){
        _uri = uri;
    }
    
    function _baseURI() internal view override returns (string memory) {
        return _uri;
    }
    
    function setBaseUri(string calldata uri) external{
        _uri = uri;
    }
    
    function mint(address to, uint256 amount) external{
        uint256 start = totalSupply();
        uint256 end = start + amount;
        while(start < end){
            _mint(to, start++);
        }
    }
    
    function safeMint(address to, uint256 amount) external{
        uint256 start = totalSupply();
        uint256 end = start + amount;
        while(start < end){
            _safeMint(to, start++, "");
        }
    }
}