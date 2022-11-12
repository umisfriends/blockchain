pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/access/Ownable.sol";
import "./openzeppelin-contracts/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "./openzeppelin-contracts/contracts/utils/Strings.sol";

contract Token1155 is Ownable, ERC1155Supply{
    string public name;
    string public symbol;
    string private _baseUri;
    mapping(address => bool) public isMinter;
    
    constructor(string memory _name, string memory _symbol, string memory baseUri) ERC1155(""){
        name = _name;
        symbol = _symbol;
        _baseUri = baseUri;
    }
    
    modifier onlyMinter(){
        require(isMinter[msg.sender], "onlyMinter");
        _;
    }
    
    function uri(uint256 id) public view override returns (string memory) {
        return string(abi.encodePacked(_baseUri, Strings.toString(id)));
    }
    
    function mint(address to, uint256 id, uint256 amount, bytes calldata data) external onlyMinter{
        _mint(to, id, amount, data);
    }
    
    function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts, bytes calldata data) external onlyMinter{
        _mintBatch(to, ids, amounts, data);
    }
    
    function setBaseUri(string calldata baseUri) external onlyOwner{
        _baseUri = baseUri;
    }
    
    function setMinter(address account, bool enable) external onlyOwner{
        isMinter[account] = enable;
    }
}