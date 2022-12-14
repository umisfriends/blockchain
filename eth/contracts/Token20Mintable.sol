pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/access/Ownable.sol";
import "./openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract Token20Mintable is ERC20, Ownable {
    constructor(string memory _name, string memory _symbol, uint256 initSupply) ERC20(_name, _symbol){
        _mint(owner(), initSupply);
    }
    
    function mint(address to, uint256 amount) external onlyOwner{
        _mint(to, amount);
    }
}