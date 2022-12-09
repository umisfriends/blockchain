const Web3 = require('web3')
const express = require('express')
const ethUtil = require('ethereumjs-util')
const fs = require('fs')
const config = require('./config')
console.log(config)
const key = require('./key')
console.log(key)
const mysql = require('mysql')
const app = express()

const mysqlPool = mysql.createPool(config.mysql)
const mysqlQuery = async(sql,values) => {
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
	const sqlres = await mysqlQuery(`select * from ${config.db_web}wl_badge where address=? and round=?`, [address, round])
	if(sqlres.code < 0) throw sqlres.result
	return sqlres.result.length > 0
}

// parameter: round, address
app.get('/sign_badge', async(req, res)=>{
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
app.get('/wl_badge', async(req, res)=>{
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

app.listen('9000', ()=>{
	console.log('listen:9000')
})