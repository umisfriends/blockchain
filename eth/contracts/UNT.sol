// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract UNT{
    string public constant name = "Unity Token";
    string public constant symbol = "UNT";
    uint8 public constant decimals = 18;
    uint256 public constant totalSupply = 75e25;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed, address indexed, uint256);
    event Approval(address indexed, address indexed, uint256);

    constructor (address[] memory accounts, uint256[] memory props) {
        uint256 sum;
        for (uint256 i = 0; i < accounts.length; i++) {
            address account = accounts[i];
            unchecked{
                uint256 amount = props[i] * 5e24;
                balanceOf[account] = amount;
                sum += amount;
                emit Transfer(address(0), account, amount);
            }
        }
        require(sum == 75e25, "UNT: props error");
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0) && from != address(0), "UNT: zero address");
        uint256 fromBalance = balanceOf[from];
        require(fromBalance >= amount, "UNT: insufficient balance");
        unchecked {
            balanceOf[from] = fromBalance - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0) && spender != address(0), "UNT: zero address");
        allowance[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _spendAllowance(address owner, address spender, uint256 amount) internal {
        uint256 currentAllowance = allowance[owner][spender];
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "UNT: insufficient allowance");
            unchecked {
                _approve(owner, spender, currentAllowance - amount);
            }
        }
    }
}