const Web3 = require('web3')
const express = require('express')
const ethUtil = require('ethereumjs-util')
const fs = require('fs')
const mysql = require('mysql')
const multer = require("multer")
const path = require('path')
const jwt = require('jsonwebtoken')
const BigNumber = require('bignumber.js')
const config = require('./config')
const key = require('./key')
const app = express()
const abi_box = require('./abi/Box721.json')

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

app.all("*",function(req,res,next){
    res.header("Access-Control-Allow-Origin","*");
    res.header("Access-Control-Allow-Headers","*");
    res.header("Access-Control-Allow-Methods","*");
    if (req.method.toLowerCase() == 'options')
        res.send(200);
    else
        next();
})

const inwlbadge = async(round, address)=>{
	const sqlres = await mysqlQuery(`select * from wl_badge where address=? and round=?`, [address, round])
	if(sqlres.code < 0) throw sqlres.result
	return sqlres.result.length > 0
}

// parameter: round, address
app.get('/mint1155_sign', async(req, res)=>{
	try{
		const round = Number(req.query.round)
		const address = req.query.address
		const inWhitelist = await inwlbadge(round, address)
		if(!inWhitelist) throw new Error("not in whitelist")
		const deadline = Math.ceil(new Date().getTime()/1000)+config.timeout_sign
		const data = Web3.utils.encodePacked(config.chainid, config.addr_offerbadge, "mint", round, address, deadline)
		const hash = Web3.utils.sha3(data)
		const sign = ethUtil.ecsign(ethUtil.toBuffer(hash), ethUtil.toBuffer(key.prikey))
		const result = {round,address,deadline,v:sign.v,r:ethUtil.bufferToHex(sign.r),s:ethUtil.bufferToHex(sign.s)}
		res.send({success:true, result})
	}catch(e){
		console.log(e)
		res.send({success:false, result:e.toString()})
	}
})

// parameter: round, address
app.get('/mint1155_inwhitelist', async(req, res)=>{
	try{
		const round = Number(req.query.round)
		const address = req.query.address
		const inWhitelist = await inwlbadge(round, address)
		res.send({success:true, result:inWhitelist})
	}catch(e){
		console.log(e)
		res.send({success:false, result:e.toString()})
	}
})

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

const isTeamLeader = async(address)=>{
	if(address == null || address == '' || address == undefined) return true
	var sqlres = await mysqlQuery("select * from team where leader=?", [address])
	if(sqlres.code < 0) throw sqlres.result
	return sqlres.result.length > 0
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

// param: logo(file/image) name(string) description(string) email(string) inviter(address,option)
// header: x-token
app.post("/upload", upload.single("logo"), async (req, res) => {
  try {
    var user = await getUser(req.headers['x-token'])
    var logo = req.file.filename
    var name = req.body.name
    var description = req.body.description
    var email = req.body.email
    var inviter = req.body.inviter == undefined ? null : req.body.inviter
    var isleader = await isTeamLeader(inviter)
    if(!Web3.utils.isAddress(user.address)) throw new Error("invalid user address")
    if(!isleader) throw new Error("invalid inviter")
    var sqlres = await mysqlQuery(`select * from team where leader=?`, [user.address])
    if(sqlres.code < 0) throw sqlres.result
    if(sqlres.result.length == 0){
    	sqlres = await mysqlQuery(`insert into team(leader,uid,name,logo,description,email,inviter,createTime) values(?,?,?,?,?,?,?,now())`,
    		[user.address, user.id, name, logo, description, email, inviter])
	}else{
		sqlres = await mysqlQuery('update team set name=?,logo=?,description=?,email=? where leader=?', [name, logo, description, email, user.address])
	}
    if (sqlres.code < 0) throw sqlres.result
    var deadline = Math.ceil(new Date().getTime()/1000) + config.timeout_sign
    var data = Web3.utils.encodePacked(config.chainid, config.addr_registry, "register", user.address, deadline)
    const hash = Web3.utils.sha3(data)
    const sign = ethUtil.ecsign(ethUtil.toBuffer(hash), ethUtil.toBuffer(key.prikey))
	const result = {address:user.address,deadline,v:sign.v,r:ethUtil.bufferToHex(sign.r),s:ethUtil.bufferToHex(sign.s)}
    res.send({ success: true, result})
  } catch (e) {
    console.error(e)
    res.send({ success: false, result: e.toString() })
  }
})

// header: x-token
app.post('/user', async(req, res)=>{
	try{
		var user = getUser(req.headers['x-token'])
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
		var user = getUser(req.headers['x-token'])
		var nonce = Number(req.query.nonce)
		var address = req.query.address.toLowerCase()
		if(!Web3.isAddress(address)) throw new Error('invalid address')
		if(Web3.isAddress(user.address)) throw new Error('already set')
		var now = Math.ceil(new Date().getTime()/1000)
		if(nonce < now - config.timeout_sign || nonce > now + config.timeout_sign) throw new Error("invalid nonce")
		var hash = ethMsgHash(sign_prefix+nonce)
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
		var user = getUser(req.headers['x-token'])
		var tokenId = Number(req.query.tokenId)
		if(!Web3.utils.isAddress(user.address)) throw new Error('invalid address')
		var web3 = new Web3(config.rpc)
		var contract = new web3.eth.Contract(abi_box, config.addr_box721)
		var owner = await contract.methods.ownerOf(tokenId)
		if(owner.toLowerCase() != user.address.toLowerCase()) throw new Error("only tokenId owner")
		res.send({success:true, result:'OK'})
	}catch(e){
		console.error(e)
		res.send({success:false, result:e.toString()})
	}
})

app.listen('9000', ()=>{
	console.log('listen:9000')
})
