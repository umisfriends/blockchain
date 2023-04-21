const Web3 = require('web3')
const express = require('express')
const ethUtil = require('ethereumjs-util')
const fs = require('fs')
const mysql = require('mysql')
const multer = require("multer")
const path = require('path')
const jwt = require('jsonwebtoken')
const BigNumber = require('bignumber.js')
const redis = require('redis')
const config = require('./config')
const key = require('./key')
const app = express()
const abi_box = require('./abi/Box721.json')
const abi_team = require('./abi/StandardTeamCreator.json')

if(!fs.existsSync(config.uploadDir)) fs.mkdirSync(config.uploadDir)

const mysqlPool = mysql.createPool(key.mysql)
const mysqlQuery = async(sql, values) => {
    return new Promise( resolve =>{
        mysqlPool.getConnection((err,connection)=>{
            if(err) {
                console.error('sql='+sql,'\n values='+values);
                return resolve({code:-1,message:'mysql connection error',result:err})
            }
            connection.query(sql,values,(err,rows)=>{
                connection.release()
                if(err) {
                    return resolve({code:-1,message:'mysql query error',result:err})
                }
                resolve({code:0,message:'success',result:rows})
            })
        })
    })
}

const mysqlPool2 = mysql.createPool(key.mysql2)
const mysqlQuery2 = async(sql, values) => {
    return new Promise( resolve =>{
        mysqlPool2.getConnection((err,connection)=>{
            if(err) {
                console.error('sql='+sql,'\n values='+values);
                return resolve({code:-1,message:'mysql connection error',result:err})
            }
            connection.query(sql,values,(err,rows)=>{
                connection.release()
                if(err) {
                    return resolve({code:-1,message:'mysql query error',result:err})
                }
                resolve({code:0,message:'success',result:rows})
            })
        })
    })
}

app.all("*",function(req,res,next){
    res.header("Access-Control-Allow-Origin","*");
    res.header("Access-Control-Allow-Headers","*");
    res.header("Access-Control-Allow-Methods","*");
    if (req.method.toLowerCase() == 'options')
        res.send(200);
    else
        next();
})

// const inwlbadge = async(round, address)=>{
// 	const sqlres = await mysqlQuery(`select * from wl_badge where address=? and round=?`, [address, round])
// 	if(sqlres.code < 0) throw sqlres.result
// 	return sqlres.result.length > 0
// }

// parameter: round, address
// app.get('/mint1155_sign', async(req, res)=>{
// 	try{
// 		const round = Number(req.query.round)
// 		const address = req.query.address
// 		const inWhitelist = await inwlbadge(round, address)
// 		if(!inWhitelist) throw new Error("not in whitelist")
// 		const deadline = Math.ceil(new Date().getTime()/1000)+config.timeout_sign
// 		const data = Web3.utils.encodePacked(config.chainid, config.addr_offerbadge, "mint", round, address, deadline)
// 		const hash = Web3.utils.sha3(data)
// 		const sign = ethUtil.ecsign(ethUtil.toBuffer(hash), ethUtil.toBuffer(key.prikey))
// 		const result = {round,address,deadline,v:sign.v,r:ethUtil.bufferToHex(sign.r),s:ethUtil.bufferToHex(sign.s)}
// 		res.send({success:true, result})
// 	}catch(e){
// 		console.log(e)
// 		res.send({success:false, result:e.toString()})
// 	}
// })

// parameter: round, address
// app.get('/mint1155_inwhitelist', async(req, res)=>{
// 	try{
// 		const round = Number(req.query.round)
// 		const address = req.query.address
// 		const inWhitelist = await inwlbadge(round, address)
// 		res.send({success:true, result:inWhitelist})
// 	}catch(e){
// 		console.log(e)
// 		res.send({success:false, result:e.toString()})
// 	}
// })

let storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    let extName = path.extname(file.originalname);
    const uniqueSuffix = new BigNumber(Date.now())
      .times(1e6)
      .plus(Math.floor(Math.random() * 1e6));
    cb(null, uniqueSuffix.toFixed() + extName);
  },
})
let upload = multer({ storage })

const verifyToken = async(token) =>{
    return new Promise((resolve, reject) => {
      jwt.verify(token, key.jwtkey, (error, result) => {
            if(error){
                reject(error)
            } else {
                resolve(result)
            }
      })
    })
}

const getUser = async(token) =>{
	var account = await verifyToken(token)
	if(Number(account.exp) < Math.ceil(new Date().getTime()/1000)) throw new Error("x-token timeout")
	var sqlres = await mysqlQuery(`select * from user where id=?`, [account.ID])
	if(sqlres.code < 0) throw sqlres.result
	if(sqlres.result.length == 0) throw new Error("user not exists")
	return sqlres.result[0]
}

// param: name
app.get("/team_name", async()=>{
	try{
		var sqlres = await mysqlQuery("select * from team where name=?", [req.query.name])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:sqlres.result})
  	}catch(e){
    	console.error(e)
    	res.send({success:false, result:e.toString()})
  	}
})

// // param: [logo(file/image)] name(string) description(string) email(string) inviter(uid,option)
// // header: x-token
// // app.post("/upload", upload.single("logo"), async (req, res) => {
// app.post("/upload", async (req, res) => {
//   try {
//     var user = await getUser(req.headers['x-token'])
//     var logo = null //req.file.filename
//     var name = req.query.name
//     var description = req.query.description
//     var email = req.query.email
//     if(!Web3.utils.isAddress(user.address)) throw new Error("invalid user address")
//     var sqlres = await mysqlQuery(`select * from team where leader=?`, [user.address])
//     if(sqlres.code < 0) throw sqlres.result
//     if(sqlres.result.length == 0){
//     	var inviter = null
//     	if(req.query.inviter != undefined && req.query.inviter != ''){
//     		sqlres = await mysqlQuery("select * from team where uid=?", [req.query.inviter])
//     		if(sqlres.code < 0) throw sqlres.result
//     		if(sqlres.result.length == 0) throw new Error("inviter is not team leader")
//     		inviter = sqlres.result[0].leader
//     	}
//     	sqlres = await mysqlQuery(`insert into team(leader,uid,name,logo,description,email,inviter,createTime) values(?,?,?,?,?,?,?,now())`,
//     		[user.address, user.id, name, logo, description, email, inviter])
// 	}else{
// 		sqlres = await mysqlQuery('update team set name=?,logo=?,description=?,email=? where leader=?', [name, logo, description, email, user.address])
// 	}
//     if (sqlres.code < 0) throw sqlres.result
//     var deadline = Math.ceil(new Date().getTime()/1000) + config.timeout_sign
//     var data = Web3.utils.encodePacked(config.chainid, config.addr_registry, "register", user.address, deadline)
//     const hash = Web3.utils.sha3(data)
//     const sign = ethUtil.ecsign(ethUtil.toBuffer(hash), ethUtil.toBuffer(key.prikey))
// 	const result = {address:user.address,deadline,v:sign.v,r:ethUtil.bufferToHex(sign.r),s:ethUtil.bufferToHex(sign.s)}
//     res.send({ success: true, result})
//   } catch (e) {
//     console.error(e)
//     res.send({ success: false, result: e.toString() })
//   }
// })

// param: [logo(file/image)] name(string) description(string) email(string) inviter(uid,option)
// header: x-token
// app.post("/upload", upload.single("logo"), async (req, res) => {
app.post("/upload2", async (req, res) => {
  try {
    var user = await getUser(req.headers['x-token'])
    var logo = null //req.file.filename
    var name = req.query.name
    var description = req.query.description
    var email = req.query.email
    if(!Web3.utils.isAddress(user.address)) throw new Error("invalid user address")
	/*var sqlres = await mysqlQuery('select sum(quantity) as quantity from mintbadge where minter=?', [user.address])
	if(sqlres.code < 0) throw sqlres.result
	var quantity = sqlres.result.length == 0 ? 0 : Number(sqlres.result[0].quantity)
	if(quantity == 0) throw new Error("not mint badge")*/
    var web3 = new Web3(key.rpc3)
	var contract = new web3.eth.Contract(abi_team, config.addr_standardTeam)
	var register = await contract.methods.registered(Web3.utils.toChecksumAddress(user.address)).call()
	if(!register) throw new Error("not transfer UBadge[0] to StandardTeamCreater")
	var sqlres = await mysqlQuery(`select * from team where leader=?`, [user.address])
    if(sqlres.code < 0) throw sqlres.result
    if(sqlres.result.length == 0){
    	if(user.team != null && user.address.toLowerCase() == user.team.toLowerCase())
    		throw new Error("team leader not allowed")
    	var originTeam = null
    	if(Web3.utils.isAddress(user.team)){
    		sqlres = await mysqlQuery("select * from team where leader=?", [user.team])
    	}else{
    		sqlres = await mysqlQuery("select * from team where uid=?", [req.query.inviter])		
    	}
    	if(sqlres.code < 0) throw sqlres.result
    	if(sqlres.result.length == 0) throw new Error("team not exists")
    	var team = sqlres.result[0]
    	if(Number(team.type) != 0) {
    		sqlres = await mysqlQuery("select * from team where leader=?", [team.inviter])
    		if(sqlres.code < 0) throw sqlres.result
    		if(sqlres.result.length == 0) throw new Error("generate team not exists")
    		if(Number(sqlres.result[0].type) != 0) throw new Error("inviter not generate team")
    		originTeam = team.leader
    		team = sqlres.result[0]
    	}
    	sqlres = await mysqlQuery(`insert into team(leader,uid,name,logo,description,email,inviter,payhash,type,createTime) values(?,?,?,?,?,?,?,?,?,now())`,
    		[user.address, user.id, name, logo, description, email, team.leader,'standard_'+user.address, 1])
    	if(sqlres.code < 0) throw sqlres.result
    	sqlres = await mysqlQuery("update user set team=?,originTeam=?,joinTime=now() where id=?", [user.address, originTeam, user.id])
	}else{
		sqlres = await mysqlQuery('update team set name=?,logo=?,description=?,email=? where leader=?', [name, logo, description, email, user.address])
	}
    if (sqlres.code < 0) throw sqlres.result
    res.send({ success: true, result:'OK'})
  } catch (e) {
    console.error(e)
    res.send({ success: false, result: e.toString() })
  }
})

// header: x-token
app.post('/mybadges', async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		var sqlres = await mysqlQuery("select sum(quantity) as quantity from mintbadge where minter=?", user.address)
		if(sqlres.code < 0) throw sqlres.result
		var quantity = sqlres.result.length == 0 ? 0 : Number(sqlres.result[0].quantity)
		res.send({success:true, result:quantity})
	}catch(e){
		console.error(e)
		res.send({success:false, result:e.toString()})
	}
})

// header: x-token
app.post('/user', async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		res.send({success:true, result:user})
	}catch(e){
		console.error(e)
		res.send({success:false, result:e.toString()})
	}
})

const ethMsgHash = (msg)=>{
	return Web3.utils.sha3(Web3.utils.encodePacked("\x19Ethereum Signed Message:\n", len(msg), msg))
}

const ethVerify = (hash, v, r, s, address)=>{
	return address == ethUtil.bufferToHex(ethUtil.publicToAddress(ethUtil.ecrecover(
		ethUtil.toBuffer(hash), v, ethUtil.toBuffer(r), ethUtil.toBuffer(s))))
}

// header: x-token
// param: address nonce v r s
app.post('/user_setaddress', async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		var nonce = Number(req.query.nonce)
		var address = req.query.address.toLowerCase()
		if(!Web3.utils.isAddress(address)) throw new Error('invalid address')
		if(Web3.utils.isAddress(user.address)) throw new Error('already set')
		var now = Math.ceil(new Date().getTime()/1000)
		if(nonce < (now - config.timeout_sign) || nonce > (now + config.timeout_sign)) throw new Error("invalid nonce")
		var hash = ethMsgHash(config.sign_prefix+nonce)
		var addr = ethVerify(hash, v, r, s)
		if(addr.toLowerCase() != address) throw new Error("sign error")
		var sqlres = await mysqlQuery("update user set address=? where id=?", [address, user.id])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:'OK'})
	}catch(e){
		console.error(e)
		res.send({success:false, result:e.toString()})
	}
})

// header: x-token
// param: tokenId
app.post('/bindbox', async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		var tokenId = Number(req.query.tokenId)
		if(!Web3.utils.isAddress(user.address)) throw new Error('invalid address')
		var web3 = new Web3(key.rpc1)
		var contract = new web3.eth.Contract(abi_box, config.addr_box721)
		var owner = await contract.methods.ownerOf(tokenId).call()
		if(owner.toLowerCase() != user.address.toLowerCase()) throw new Error("only tokenId owner")
		var sqlres = await mysqlQuery("select * from bindbox where tokenId=?", [tokenId])
		if(sqlres.code < 0) throw sqlres.result
		if(sqlres.result.length == 0){
			sqlres = await mysqlQuery("insert into bindbox(tokenId,times) values(?,0)", [tokenId])
			if(sqlres.code < 0) throw sqlres.result
		}
		sqlres = await mysqlQuery("update user set bindBox=null where bindbox=?", [tokenId])
		if(sqlres.code < 0) throw sqlres.result
		sqlres = await mysqlQuery("update user set bindBox=? where id=?", [tokenId, user.id])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:'OK'})
	}catch(e){
		console.error(e)
		res.send({success:false, result:e.toString()})
	}
})

// header: x-token
// param: maxPermit
// app.post('/mintbox_sign', async(req, res)=>{
// 	try{
// 		var user = await getUser(req.headers['x-token'])
// 		var maxPermit = Number(req.query.maxPermit)
// 		if(!Web3.utils.isAddress(user.address)) throw new Error("invalid address")
// 		if(!Web3.utils.isAddress(user.team)) throw new Error("not join team")
// 		var rewardUFD = Number(user.rewardUFD)
// 		var rewardUFDBox = Number(user.rewardUFDBox)
// 		var maxAmount = Math.floor(rewardUFD/config.amount_box_payufd)+rewardUFDBox
// 		if(maxAmount < maxPermit) throw new Error("not enough ufdbox to mint")
// 		if(maxPermit < rewardUFDBox){
// 			maxPermit = rewardUFDBox
// 		}else if(maxPermit > rewardUFDBox){
// 			var newbox = maxPermit - rewardUFDBox
// 			var newUFD = newbox*config.amount_box_payufd
// 			var sqlres = await mysqlQuery(`update user set rewardUFD=rewardUFD-${newUFD}, rewardUFDBox=rewardUFDBox+${newbox} where id=?`, [user.id])
// 			if(sqlres.code < 0) throw sqlres.result
// 		}
// 		var deadline = Math.ceil(new Date().getTime()/1000) + config.timeout_sign
//     	var data = Web3.utils.encodePacked(config.chainid, config.addr_offerbox, "mint", 0, user.address, maxPermit, deadline)
//     	const hash = Web3.utils.sha3(data)
//     	const sign = ethUtil.ecsign(ethUtil.toBuffer(hash), ethUtil.toBuffer(key.prikey))
// 		const result = {round:0,address:user.address,maxPermit,deadline,v:sign.v,r:ethUtil.bufferToHex(sign.r),s:ethUtil.bufferToHex(sign.s)}
// 		res.send({success:true, result})
// 	}catch(e){
// 		console.error(e)
// 		res.send({success:false, result:e.toString()})
// 	}
// })

// header: x-token
// param: amount
app.post('/mintbox2_sign', async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		var amount = Number(req.query.amount)
		if(!Web3.utils.isAddress(user.address)) throw new Error("invalid address")
		if(!Web3.utils.isAddress(user.team)) throw new Error("not join team")
		var deadline = Math.ceil(new Date().getTime()/1000) + config.timeout_sign
    	var data = Web3.utils.encodePacked(config.chainid, config.addr_offerbox2, "mint", user.address, amount, deadline)
    	const hash = Web3.utils.sha3(data)
    	const sign = ethUtil.ecsign(ethUtil.toBuffer(hash), ethUtil.toBuffer(key.prikey))
		const result = {address:user.address,amount,deadline,v:sign.v,r:ethUtil.bufferToHex(sign.r),s:ethUtil.bufferToHex(sign.s)}
		res.send({success:true, result})
	}catch(e){
		console.error(e)
		res.send({success:false, result:e.toString()})
	}
})

// header: x-token
app.post('/claimusdt_sign', async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		if(!Web3.utils.isAddress(user.address)) throw new Error("invalid address")
		var maxPermit = new BigNumber(user.rewardUSDT).times(config.decimals_usdt)
		if(maxPermit.eq(0)) throw new Error("no usdt to claim")
		maxPermit = maxPermit.toFixed(0)
		var deadline = Math.ceil(new Date().getTime()/1000) + config.timeout_sign
    	var data = Web3.utils.encodePacked(config.chainid, config.addr_claim20, "claim", user.address, config.addr_usdt, maxPermit, deadline)
    	const hash = Web3.utils.sha3(data)
    	const sign = ethUtil.ecsign(ethUtil.toBuffer(hash), ethUtil.toBuffer(key.prikey))
		const result = {address:user.address,token:config.addr_usdt,maxPermit,deadline,v:sign.v,r:ethUtil.bufferToHex(sign.r),s:ethUtil.bufferToHex(sign.s)}
		res.send({success:true, result})
	}catch(e){
		console.error(e)
		res.send({success:false, result:e.toString()})
	}
})

// header: x-token
app.post('/claimbadge_sign', async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		if(!Web3.utils.isAddress(user.address)) throw new Error("invalid address")
		var maxPermit = Number(user.rewardBadge)
		if(maxPermit == 0) throw new Error("no usdt to claim")
		var deadline = Math.ceil(new Date().getTime()/1000) + config.timeout_sign
    	var data = Web3.utils.encodePacked(config.chainid, config.addr_claim1155, "claim", user.address, config.addr_badge1155, 0, maxPermit, deadline)
    	const hash = Web3.utils.sha3(data)
    	const sign = ethUtil.ecsign(ethUtil.toBuffer(hash), ethUtil.toBuffer(key.prikey))
		const result = {address:user.address,token:config.addr_badge1155,id:0,maxPermit,deadline,v:sign.v,r:ethUtil.bufferToHex(sign.r),s:ethUtil.bufferToHex(sign.s)}
		res.send({success:true, result})
	}catch(e){
		console.error(e)
		res.send({success:false, result:e.toString()})
	}
})

// header: x-token
// param: uid
app.post('/team_join', async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		var uid = req.query.uid
		if(user.team != null) throw new Error('already joined')
		var sqlres = await mysqlQuery("select * from team where uid=? and payhash is not null", [uid])
		if(sqlres.code < 0) throw sqlres.result
		if(sqlres.result.length == 0) throw new Error('team not exists')
		var leader = sqlres.result[0].leader
		sqlres = await mysqlQuery('update user set team=?,joinTime=now() where id=?', [leader,user.id])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:'OK'})
	}catch(e){
		console.error(e)
		res.send({success:false, result:e.toString()})
	}
})

// param: pageNum pageSize
app.get('/team_list', async(req, res)=>{
	try{
		var sqlres = await mysqlQuery("select name,logo,email,description,createTime from team where payhash is not null",[])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:sqlres.result})
	}catch(e){
		console.error(e)
		res.send({success:false, result:e.toString()})
	}
})

// header: x-token
app.post('/team_members', async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		if(!Web3.utils.isAddress(user.team)) throw new Error("not join")
		if(user.team.toLowerCase() != user.address) throw new Error("not team leader")
		var sqlres = await mysqlQuery(`select * from user where team=?`, [user.team])
		if(sqlres.code < 0) throw sqlres.result
		var result = sqlres.result
		for(var i = 0; i < result.length; i++){
			var r = result[i]
			if(Web3.utils.isAddress(r.address)){
				sqlres = await mysqlQuery(`select sum(boxAmount) as sum from mintbox where account=? and costAmount/boxAmount>${config.amount_box_buy3usdt}-0.01`, [r.address])
				if(sqlres.code < 0) throw sqlres.result
				r.buybox = sqlres.result.length == 0 ? 0 : Number(sqlres.result[0].sum)
				sqlres = await mysqlQuery(`select sum(boxAmount) as sum from mintbox where account=? and costAmount/boxAmount<${config.amount_box_buy2usdt}+0.01`, [r.address])
				if(sqlres.code < 0) throw sqlres.result
				r.buybox2 = sqlres.result.length == 0 ? 0 : Number(sqlres.result[0].sum)
			}else{
				r.buybox = 0
				r.buybox2 = 0
			}
		}
		res.send({success:true, result:result})
	}catch(e){
		console.error(e)
		res.send({success:false, result:e.toString()})
	}
})

// header: x-token
app.post('/team_myjoin', async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		if(!Web3.utils.isAddress(user.team)) throw new Error("not join")
		var sqlres = await mysqlQuery("select * from team where leader=?", [user.team])
		if(sqlres.code < 0) throw sqlres.result
		var result = sqlres.result[0]
		sqlres = await mysqlQuery("select count(*) as count from user where team=?", [user.team])
		if(sqlres.code < 0) throw sqlres.result
		result.memberNum = sqlres.result.length == 0 ? 0 : sqlres.result[0].count
		sqlres = await mysqlQuery(
			`select sum(boxAmount) as sum from mintbox as m left join user as u on m.account=u.address and m.costAmount/m.boxAmount>${config.amount_box_buy3usdt}-0.01  where u.team=?`,
			[user.address])
		if(sqlres.code < 0) throw sqlres.result
		result.buybox = sqlres.result.length==0 ? 0 : Number(sqlres.result[0].sum)
		sqlres = await mysqlQuery(
			`select sum(boxAmount) as sum from mintbox as m left join user as u on m.account=u.address and m.costAmount/m.boxAmount<${config.amount_box_buy2usdt}+0.01  where u.team=?`,
			[user.address])
		if(sqlres.code < 0) throw sqlres.result
		result.buybox2 = sqlres.result.length==0 ? 0 : Number(sqlres.result[0].sum)
		res.send({success:true, result:result})
	}catch(e){
		console.error(e)
		res.send({success:false, result:e.toString()})
	}
})

// header: x-token
app.post('/team_myinvite', async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		var sqlres = await mysqlQuery("select * from team where inviter=?", [user.address])
		if(sqlres.code < 0) throw sqlres.result
		var result = sqlres.result
		sqlres = await mysqlQuery("select count(*) as count from user where team=?", [user.team])
		if(sqlres.code < 0) throw sqlres.result
		result.memberNum = sqlres.result.length == 0 ? 0 : sqlres.result[0].count
		res.send({success:true, result:result})
	}catch(e){
		console.error(e)
		res.send({success:false, result:e.toString()})
	}
})

// param: tokenIds(like 0,3,999)
app.get('/box_times', async(req, res)=>{
	try{
		var sqlres = await mysqlQuery(`select * from bindbox where tokenId in (${req.query.tokenIds})`, [])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:sqlres.result})
	}catch(e){
		console.error(e)
		res.send({success:false, result:e.toString()})
	}
})

// header: x-token
app.get('/game_user', async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		var sqlres = await mysqlQuery2("select * from tbl_userdata where uid=?", [user.id])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:sqlres.result})
	}catch(e){
		console.error(e)
		res.send({success:false, result:e.toString()})
	}
})

// header: x-token
// param: pageSize pageNum
app.get('/reward_record', async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		var pageSize = Number(req.query.pageSize)
		var pageNum = Number(req.query.pageNum)
		var pageStart = pageSize*pageNum
		var sqlres = await mysqlQuery(`select * from reward_record where uid=? limit ${pageStart},${pageNum}`, [user.id])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:sqlres.result})
	}catch(e){
		console.error(e)
		res.send({success:false, result:e.toString()})
	}
})


// header: x-token
app.get('/user_list', async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		var sqlres = await mysqlQuery("select * from user where right(p_ids,8)=?", [user.id])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:sqlres.result})
	}catch(e){
		console.error(e)
		res.send({success:false, result:e.toString()})
	}
})

// header: xtoken
app.post("/reward_count", async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		var sqlres = await mysqlQuery("select count(*) as count from reward_record where uid=? and token='ufd'", [user.id])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:sqlres.result[0].count})
  	}catch(e){
    	console.error(e)
    	res.send({success:false, result:e.toString()})
  	}
})

// header: xtoken
// param: pageSize pageNum
app.post("/reward_list", async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		var pageSize = Number(req.query.pageSize)
		var pageNum = Number(req.query.pageNum)
		var pageStart = pageSize*pageNum
		var sqlres = await mysqlQuery(`select * from reward_record where uid=? and token='ufd' order by id desc limit ${pageStart},${pageSize}`, [user.id])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:sqlres.result})
  	}catch(e){
    	console.error(e)
    	res.send({success:false, result:e.toString()})
  	}
})

// app.post("/treasure_open", async(req, res)=>{
// 	try{
// 		var user = await getUser(req.headers['x-token'])
// 		var sqlres = await mysqlQuery("select * from buystar where account=?", [user.address])
// 		if(sqlres.code < 0) throw sqlres.result
// 		if(sqlres.result.length == 0) throw new Error("only for star buyer")
// 		sqlres = await mysqlQuery2(`select * from tbl_userdata where uid=?`, [user.id])
// 		if(sqlres.code < 0) throw sqlres.result
// 		if(sqlres.result.length < 0) throw new Error("user not exists in game")
// 		var prop_data = JSON.parse(sqlres.result[0].prop_data)
// 		if(prop_data.sx < config.amount_treasure_open) throw new Error('sx not enough')
// 		prop_data.sx = prop_data.sx - config.amount_treasure_open
// 		sqlres = await mysqlQuery2("update tbl_userdata set prop_data=? where uid=?", [JSON.stringify(prop_data), user.id])
// 		if(sqlres.code < 0) throw sqlres.result
// 		var r = Math.floor(Math.random() * 10000)
// 		var i
// 		var sum = 0
// 		for(i = 0; i < key.treasures.length; i++){
// 			sum = sum + key.treasures[i].rate
// 			if(r < sum) break
// 		}
// 		var treasure = key.treasures[i]
// 		var quantity = 1
// 		if(treasure.name == 'IMG'){
// 			quantity = Math.floor(Math.random() * (key.treausre_img_range[1] - key.treausre_img_range[0] + 1)) + key.treausre_img_range[0]
// 		}
// 		var usage = null
// 		if(treasure.name == 'null'){
// 			usage = 'default'
// 		}else if(treasure.name == 'star'){
// 			usage = 'tx' + user.id + '_' + Math.floor(new Date().getTime()/1000)
// 		}
// 		sqlres = await mysqlQuery("insert into treasure(uid,name,quantity,cost,`usage`,create_time) values(?,?,?,?,?,now())",
// 			[user.id, treasure.name, quantity, config.amount_treasure_open, usage])
// 		if(sqlres.code < 0) console.error(sqlres.result)
// 		if(treasure.name == 'star'){
// 			var msg = {id:usage, uid:user.id, card:quantity, time:Number(usage.split('_')[1])}
// 			redisClient = redis.createClient(key.redis)
// 			await redisClient.connect()
// 			await redisClient.rPush(config.redisKey_buyStar, JSON.stringify(msg))
// 			await redisClient.quit()
// 		}
// 		res.send({success:true, result:{name:treasure.name, quantity}})
//   	}catch(e){
//     	console.error(e)
//     	res.send({success:false, result:e.toString()})
//   	}
// })

// header: xtoken
// param: name
app.post("/treasure_count", async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		var sqlres = await mysqlQuery("select count(*) as count from treasure where uid=? and name=?", [user.id, req.query.name])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:sqlres.result[0].count})
  	}catch(e){
    	console.error(e)
    	res.send({success:false, result:e.toString()})
  	}
})

// header: xtoken
// param: pageSize pageNum name
app.post("/treasure_list", async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		var pageSize = Number(req.query.pageSize)
		var pageNum = Number(req.query.pageNum)
		var pageStart = pageSize*pageNum
		var sqlres = await mysqlQuery(`select * from treasure where uid=? and name=? limit ${pageStart},${pageSize}`, [user.id, req.query.name])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:sqlres.result})
  	}catch(e){
    	console.error(e)
    	res.send({success:false, result:e.toString()})
  	}
})

// header: xtoken
app.post("/is_star_buyer", async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		var sqlres = await mysqlQuery("select * from buystar where account=?", [user.address])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:sqlres.result.length > 0})
  	}catch(e){
    	console.error(e)
    	res.send({success:false, result:e.toString()})
  	}
})

app.get("/prizepool", async(req, res)=>{
	try{
		var redisClient = redis.createClient(key.redis)
		await redisClient.connect()
		var data = await redisClient.get(config.redisKey_prizepool)
		await redisClient.quit()
		res.send({success:true, result:JSON.parse(data)})
  	}catch(e){
    	console.error(e)
    	res.send({success:false, result:e.toString()})
  	}
})

// header: xtoken
app.post("/gameTestAccount", async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		var sqlres = await mysqlQuery("select * from newGameTestReg where uid=?", [user.id])
		if(sqlres.code < 0) throw sqlres.result
		if(sqlres.result.length == 0) throw new Error("not in test account list")
		res.send({success:true, result:sqlres.result[0]})
  	}catch(e){
    	console.error(e)
    	res.send({success:false, result:e.toString()})
  	}
})

app.get("/applink", (req, res)=>{
	try{
		var a = config.applink
		a.link = `${a.prefix}/${a.package}.${a.version}.${a.suffix}`
		res.send({success:true, result:[a]})
	}catch(e){
		console.error(e)
    	res.send({success:false, result:e.toString()})
	}
})

app.listen('9000', ()=>{
	console.log('listen:9000')
})
