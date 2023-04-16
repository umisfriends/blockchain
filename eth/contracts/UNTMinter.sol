// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "./openzeppelin-contracts/contracts/proxy/utils/Initializable.sol";

contract UNTLocker{
    constructor(IERC20 UNT){
        UNT.approve(msg.sender, type(uint256).max);
    }
}

contract UNTMinter is Initializable{
    address public owner;
    IERC20 public UNT;
    address[] public lockers;
    mapping(address => bool) public isMinter;

    modifier onlyOwner(){
        require(msg.sender == owner, "onlyOwner");
        _;
    }

    function initialize(IERC20 _UNT) external initializer{
        owner = msg.sender;
        UNT = _UNT;
        _addLocker();
    }

    function setOwner(address _owner) external onlyOwner{
        owner = _owner;
    }

    function setMinter(address minter, bool enable) external onlyOwner{
        isMinter[minter] = enable;
    }

    function lockerInfo() external view returns(uint256 lockerLength, address currentLocker, uint256 lockerBalance, uint256 frozenBalance){
        lockerLength = lockers.length;
        currentLocker = lockers[lockerLength - 1];
        lockerBalance = UNT.balanceOf(currentLocker);
        frozenBalance = UNT.balanceOf(address(this));
    }

    function _addLocker() internal{
        uint256 balance = UNT.balanceOf(address(this)) >> 1;
        require(balance > 0, "zero balance");
        address locker = address(new UNTLocker(UNT));
        lockers.push(locker);
        UNT.transfer(locker, balance);
    }

    function addLocker() external onlyOwner{
        require(UNT.balanceOf(lockers[lockers.length - 1]) == 0, "old locker still available");
        _addLocker();
    }

    function mint(address to, uint256 amount) external{
        require(isMinter[msg.sender], "onlyMinter");
        UNT.transferFrom(lockers[lockers.length - 1], to, amount);
    }
}