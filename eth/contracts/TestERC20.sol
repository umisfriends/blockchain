pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract TestERC20 is ERC20{
    uint8 private _decimals;
    
    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol){
        _decimals = decimals_;
    }
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external{
        _mint(to, amount);
    }
}