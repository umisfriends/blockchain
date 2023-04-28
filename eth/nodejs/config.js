const BigNumber = require('bignumber.js')
const config = {
	uploadDir:'./upload',
	chainid:56,
	addr_registry:"0x9Cb19e80C167f5b42C22FBc121027981906D1d8f".toLowerCase(),
	addr_offerbadge:"0xEA5C0ddBc10468Fc01E19eEe9b28A5b1d09ffB4D".toLowerCase(),
	addr_offerbox:"0x4f5A8F15b84ac903917fBF6f66195484057156Ab".toLowerCase(),
	addr_offerStar:"0xBCD7088d72d0AD61DdA3d67deA55AA89fBF825dC".toLowerCase(),
	addr_box721:"0x92646d6206B5bBc6970baD0F2E0254C380208072".toLowerCase(),
	addr_badge1155:"0x4B8b2D7e8EB66D41B73ac2fD7E06D26E923d8230".toLowerCase(),
	addr_usdt:"0x55d398326f99059fF775485246999027B3197955".toLowerCase(),
	addr_claim1155:"0x5223E0539554a73E774162b14E75b2Ef4D3C494D".toLowerCase(),
	addr_claim20:"0x33E3100D6CB39719f138a8665e7A110be5A604E6".toLowerCase(),
	addr_badge1155_2:"0x4B8b2D7e8EB66D41B73ac2fD7E06D26E923d8230".toLowerCase(),
	addr_standardTeam:"0x1E61E1E9cf32C473d246f276Dad0642F5E6F7A7f".toLowerCase(),
	decimals_usdt:1e18,
	percent_team_invite:20,
	amount_game_rewardufd:500,
	times_game_rewardperday:2,
	times_game_rewardufd:5,
	amount_box_payufd:250,
	amount_box_buyusdt:1000,
	amount_box_buy2usdt:250,
	times_box_inviteuser:3,
	amount_box_invite_getblade:1,
	percent_box_team_leader:50,
	percent_box_team_inviter:10,
	timeout_sign:300,
	sign_prefix:"I am signing my one-time nonce:",
	redisKey_buyStar:'umi_add_card',
	percent_star_inviter:20,
	amount_treasure_open:3000000,
	amount_star_boxinviter:10,
	percent_buystar_prizepool:15,
	percent_buystar_teamleader:25,
	amount_base_prizepool:100000,
	redisKey_prizepool:'umi_prizepool',
	interval_refresh_prizepool:4*3600*1000,
	addr_offerbox2:'0xCeA816764cf31708376Fe36c2a881b4F210208b4'.toLowerCase(),
	addr_offerbadge2:'0x8972Cdd4c96Ec3111d03b7050f2A3da842824e8a'.toLowerCase(),
	amount_box_buy3usdt:600,
	applink:{suffix:'apk',
		prefix:'https://pub-4a5c49f38d2846ae93d71dde34403f65.r2.dev',
		version:'V0.1.5alpha',
		package:'com.umi.umisfriends'},
	addr_offerPinkUmi:"0xaB7E13EA2fcDc2bB19E88424AB382fd3510BC526".toLowerCase(),
}
module.exports = config