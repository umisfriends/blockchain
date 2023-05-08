// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/access/Ownable.sol";
import "./openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "./openzeppelin-contracts/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import "./openzeppelin-contracts/contracts/token/ERC721/IERC721Receiver.sol";
import "./openzeppelin-contracts/contracts/token/ERC1155/IERC1155.sol";
import "./openzeppelin-contracts/contracts/token/ERC1155/IERC1155Receiver.sol";

contract Recharge is Ownable, IERC721Receiver, IERC1155Receiver{
    event Receive(uint256 amount);

    receive() payable external {
        emit Receive(msg.value);
    }

    function claimEth(address payable to, uint256 amount) external onlyOwner{
        to.transfer(amount);
    }

    function claimERC20(IERC20 token, address to, uint256 amount) external onlyOwner{
        token.transfer(to, amount);
    }

    function claimERC721(IERC721 token, address to, uint256 tokenId) external onlyOwner{
        token.safeTransferFrom(address(this), to, tokenId);
    }

    function claimERC721Batch(IERC721Enumerable token, address to, uint256 amount) external onlyOwner{
        for(uint256 i = 0; i < amount; i++){
            uint256 tokenId = token.tokenOfOwnerByIndex(address(this), 0);
            token.safeTransferFrom(address(this), to, tokenId);
        }
    }

    function claimERC1155(IERC1155 token, address to, uint256 id, uint256 amount) external onlyOwner{
        token.safeTransferFrom(address(this), to, id, amount, "");
    }

    function claimERC1155Batch(IERC1155 token, address to, uint256[] calldata ids, uint256[] calldata amounts) external onlyOwner{
        token.safeBatchTransferFrom(address(this), to, ids, amounts, "");
    }

    function onERC721Received(address, address, uint256, bytes memory) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function onERC1155Received(address, address, uint256, uint256, bytes memory) public virtual override returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] memory, uint256[] memory, bytes memory) public virtual override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId || interfaceId == type(IERC721Receiver).interfaceId;
    }

    function approve(IERC20 token, address to, uint256 amount) external onlyOwner{
        token.approve(to, amount);
    }

    function setApprovalForAll(address token, address to, bool enable) external onlyOwner{
        IERC721(token).setApprovalForAll(to, enable);
    }
}
