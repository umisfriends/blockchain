pragma solidity ^0.8.0;
import "./openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "./openzeppelin-contracts/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

contract BatchView{
    function getBalances(address owner, address[] calldata tokens) external view returns(uint256[] memory balances){
        balances = new uint256[](tokens.length);
        for(uint256 i = 0; i < tokens.length; i++){
            address token = tokens[i];
            balances[i] = token == address(0) ? owner.balance : IERC20(token).balanceOf(owner);
        }
    }

    function getTokens(address owner, IERC721Enumerable token) external view returns(uint256[] memory tokenIds){
        uint256 balance = token.balanceOf(owner);
        tokenIds = new uint256[](balance);
        for(uint256 i = 0; i < balance; i++){
            tokenIds[i] = token.tokenOfOwnerByIndex(owner, i);
        }
    }
}