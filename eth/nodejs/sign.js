const Web3 = require('web3')
const express = require('express')
const ethUtil = require('ethereumjs-util')
const fs = require('fs')
const mysql = require('mysql')
const multer = require("multer")
const jwt = require('jsonwebtoken')
const config = require('./config')
const key = require('./key')
const app = express()

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
		const deadline = Math.ceil(new Date().getTime()/1000)+config.timeout
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
    cb(null, config.dirImage);
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
	return sqlrs.result[0]
}

// param: logo(file/image) name(string) description(string) inviter(address,option)
// header: x-token
// response: status: 1提交资料,2付款待审核,3审核通过,4审核失败
app.post("/upload", upload.single("logo"), async (req, res) => {
  try {
    var user = await getUser(req.headers['x-token'])
    var logo = req.file.filename
    var name = req.body.name
    var description = req.body.description
    var inviter = req.body.inviter == undefined ? null : req.body.inviter
    if(!Web3.utils.isAddress(user.address)) throw new Error("invalid user address")
    if(inviter != null && !Web3.utils.isAddress(inviter)) throw new Error("invalid inviter")
    var sqlres = await mysqlQuery(`select * from team where leader=?`, [user.address])
    if(sqlres.code < 0) throw sqlres.result
    if(sqlres.result.length == 0){
    	sqlres = await mysqlQuery(`insert into team(leader,name,logo,description,inviter,status) values(?,?,?,?,?)`,
    		[user.address, name, logo, description, inviter, 1])
	}else{
		var sql = 'update team set name=?,logo=?,description=?'
		var values = [name, logo, description]
		if(sqlres.result[0].status <= 1){
			sql += ',status=?'
			values.push(1)
			if(sqlres.result[0].inviter == null && Web3.utils.isAddress(inviter)){
				sql += ',inviter'
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

app.listen('9000', ()=>{
	console.log('listen:9000')
})