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

// param: logo(file/image) name(string) description(string) email(string) inviter(address,option)
// header: x-token
// response: status: 1提交资料,2付款待审核,3审核通过,4审核失败
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
    if(!isTeamLeader(inviter)) throw new Error("invalid inviter")
    var sqlres = await mysqlQuery(`select * from team where leader=?`, [user.address])
    if(sqlres.code < 0) throw sqlres.result
    if(sqlres.result.length == 0){
    	sqlres = await mysqlQuery(`insert into team(leader,uid,name,logo,description,email,inviter,status,createTime) values(?,?,?,?,?,?,?,?,now())`,
    		[user.address, user.id, name, logo, description, email, inviter, 1])
	}else{
		var sql = 'update team set name=?,logo=?,description=?,email=?'
		var values = [name, logo, description, email]
		if(sqlres.result[0].status <= 1){
			sql += ',status=?'
			values.push(1)
			if(!Web3.utils.isAddress(sqlres.result[0].inviter) && Web3.utils.isAddress(inviter)){
				sql += ',inviter=?'
				values.push(inviter)
			}
		}
		values.push(user.address)
		sqlres = await mysqlQuery(sql + ' where leader=?', values)
	}
    if (sqlres.code < 0) throw sqlres.result;
    sqlres = await mysqlQuery('select * from team where leader=?', [user.address])
    if(sqlres.code < 0) throw sqlres.result
    res.send({ success: true, result: sqlres.result[0] });
  } catch (e) {
    console.error(e);
    res.send({ success: false, result: e.toString() });
  }
})

// param: token
app.get('/team_audit', async(req, res)=>{
	try{
		var data = await verifyToken(req.query.token)
		if(data.uid == undefined || data.hash == undefined || data.audit == undefined) throw new Error('invalid param')
		if(!data.audit){
			var sqlres = await mysqlQuery("update jointeam_transfer set status=2 where hash=?", [data.hash])
			if(sqlres.code < 0) throw sqlres.result
		}else{
			var sqlres = await mysqlQuery("select * from team where uid=?", [data.uid])
			if(sqlres.code < 0) throw sqlres.result
			if(sqlres.result.length == 0 || sqlres.result[0].status < 2) throw new Error("not upload message or pay")
			if(sqlres.result[0].status > 2) throw new Error("team is created")
			var team = sqlres.result[0]
			sqlres = await mysqlQuery("update team set status=3 where uid=?", [data.uid])
			if(sqlres.code < 0) throw sqlres.result
			sqlres = await mysqlQuery("update jointeam_transfer set status=1 where hash=?", [data.hash])
			if(sqlres.code < 0) console.error(sqlres.result)
			sqlres = await mysqlQuery(`update user set rewardBox=rewardBox+${config.amount_jointeam_getbox},rewardBadge=rewardBadge+${config.amount_jointeam_getblage},team=?,team_status=1 where id=?`,
				[team.leader,data.uid])
			if(sqlres.code < 0) console.error(sqlres.result)
			if(Web3.utils.isAddress(team.invier)){
				sqlres = await mysqlQuery("select * from user where id=?", [data.id])
				if(sqlres.code < 0){
					console.error(sqlres.result)
				}else{
					sqlres = await mysqlQuery(`update user set rewardUsdt=rewardUsdt+(select amount*${config.percent_jointeam_invite_getusdt}/100 from jointeam_transfer where hash=?) where id=?`,
						[data.hash, data.uid])
					if(sqlres.code < 0) console.error(sqlres.result)
				}
			}
		}
		res.send({success:true,result:data})
	} catch (e) {
    	console.error(e);
    	res.send({ success: false, result: e.toString() });
  	}
})

// header: x-token
// param: status
app.post('/team', async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		var sqlres = await mysqlQuery("select * from team where uid=? and status=?", [user.id, req.query.status])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true,result:sqlres.result})
	} catch (e) {
    	console.error(e);
    	res.send({ success: false, result: e.toString() });
  	}
})

// header: x-token
app.post('/user', async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		res.send({success:true,result:user})
	} catch (e) {
    	console.error(e);
    	res.send({ success: false, result: e.toString() });
  	}
})

// header: x-token
// param: team(address)
app.post('/team_join', async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		var team = req.query.team
		if(user.team_status == 1) throw new Error("already join team")
		var sqlres = await mysqlQuery("update user set team=?,status=1 where id=?", [team,user.id])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true,result:{id:user.id, team}})
	} catch (e) {
    	console.error(e);
    	res.send({ success: false, result: e.toString() });
  	}
})

// header: x-token
// param: team(address)
app.post('/team_join', async(req, res)=>{
	try{
		var user = await getUser(req.headers['x-token'])
		var team = req.query.team
		if(user.team_status == 1) throw new Error("already join team")
		var sqlres = await mysqlQuery("update user set team=?,status=1 where id=?", [team,user.id])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true,result:{id:user.id, team}})
	} catch (e) {
    	console.error(e);
    	res.send({ success: false, result: e.toString() });
  	}
})

// header: x-token
// param: uid
app.post('/team_handlejoin', async(req, res)=>{
	try{
		var uid = req.query.uid
		var leader = await getUser(req.headers['x-token'])
		var sqlres = await mysqlQuery("select * from team where uid=?", [leader.id])
		if(sqlres.code < 0) throw sqlres.result
		if(sqlres.result.length == 0) throw new Error("team not exist")
		var team = sqlres.result[0]
		sqlres = await mysqlQuery("select * from user where id=?", [uid])
		if(sqlres.code < 0) throw sqlres.result
		if(sqlres.result.length == 0) throw new Error("uid not exist")
		var user = sqlres.result[0]
		if(user.team_status == 1) throw new Error("user already join")
		if(user.team != team.leader) throw new Error("user not join this team")
		var sqlres = await mysqlQuery("update user set team_status=1 where id=?", [uid])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true,result:{id:uid, team:team.leader}})
	} catch (e) {
    	console.error(e);
    	res.send({ success: false, result: e.toString() });
  	}
})

app.listen('9000', ()=>{
	console.log('listen:9000')
})
