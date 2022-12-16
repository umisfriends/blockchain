pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/access/Ownable.sol";
import "./openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract ERC20Mintable is ERC20, Ownable {
    mapping(address => bool) public isMinter;
    constructor(string memory _name, string memory _symbol, uint256 initSupply, address initTo) ERC20(_name, _symbol){
        _mint(initTo, initSupply);
    }
    function mint(address to, uint256 amount) external{
        require(isMinter[msg.sender], "ERC20:onlyMinter");
        _mint(to, amount);
    }
    function setMinter(address minter, bool enable) external onlyOwner{
        isMinter[minter] = enable;
    }
}