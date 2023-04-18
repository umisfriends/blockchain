// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/utils/introspection/ERC165.sol";
import "./openzeppelin-contracts/contracts/token/ERC1155/IERC1155Receiver.sol";

interface IERC1155{
    function mint(address to, uint256 id, uint256 amount, bytes calldata data) external;
}

contract StandardTeamCreater is IERC1155Receiver, ERC165 {
    address public badge;
    mapping(address => bool) public registered;
    address[] public teams;
    constructor(address _badge){
        badge = _badge;
    }

    function teamNumber() external view returns(uint256){
        return teams.length;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId || super.supportsInterface(interfaceId);
    }

    function onERC1155Received(address, address from, uint256 id, uint256 value, bytes calldata) external returns (bytes4){
        require(msg.sender == badge && id == 0 && value == 1, "receive UBadge id:0 value:1");
        require(!registered[from], "registered");
        registered[from] = true;
        teams.push(from);
        IERC1155(badge).mint(from, 1, 1, "");
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external returns (bytes4){
        revert("only transferSingle");
    }
}