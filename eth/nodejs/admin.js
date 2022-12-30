const express = require('express')
const mysql = require('mysql')
const jwt = require('jsonwebtoken')
const BigNumber = require('bignumber.js')
const config = require('./config')
const key = require('./key')

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

const app = express()
app.all("*",function(req,res,next){
    res.header("Access-Control-Allow-Origin","*");
    res.header("Access-Control-Allow-Headers","*");
    res.header("Access-Control-Allow-Methods","*");
    if (req.method.toLowerCase() == 'options')
        res.send(200);
    else
        next();
})

const verifyToken = async(token) =>{
    return new Promise((resolve, reject) => {
      jwt.verify(token, key.jwtadminkey, (error, result) => {
            if(error){
                reject(error)
            } else {
                resolve(result)
            }
      })
    })
}

const getAdmin = async(token) =>{
	var account = await verifyToken(token)
	var sqlres = await mysqlQuery(`select * from admin where name=?`, [account.name])
	if(sqlres.code < 0) throw sqlres.result
	if(sqlres.result.length == 0) throw new Error("user not exists")
	return account.name
}

// param: name passwd
app.post("/login", async(req, res)=>{
	try{
		var sqlres = await mysqlQuery("select * from admin where name=? and passwd=sha1(?)", [req.query.name, req.query.passwd])
		if(sqlres.code < 0) throw sqlres.result
		if(sqlres.result.length == 0) throw new Error("user not exists or passwd error")
		var xtoken = jwt.sign({name:req.query.name}, key.jwtadminkey, {expiresIn:60*60*24})
		res.send({success:true, result:{xtoken}})
  	}catch(e){
    	console.error(e)
    	res.send({success:false, result:e.toString()})
  	}
})

// header: xtoken
// param: passwd
app.post("/set_passwd", async(req, res)=>{
	try{
		var admin = await getAdmin(req.headers['xtoken'])
		var sqlres = await mysqlQuery("update admin set passwd=sha1(?) where name=?", [req.query.passwd, admin])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:'OK'})
  	}catch(e){
    	console.error(e)
    	res.send({success:false, result:e.toString()})
  	}
})

// header: xtoken
app.post("/user_count", async(req, res)=>{
	try{
		await getAdmin(req.headers['xtoken'])
		var sqlres = await mysqlQuery("select count(*) as count from user", [])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:sqlres.result[0].count})
  	}catch(e){
    	console.error(e)
    	res.send({success:false, result:e.toString()})
  	}
})

// header: xtoken
// param: pageSize pageNum
app.post("/user_list", async(req, res)=>{
	try{
		await getAdmin(req.headers['xtoken'])
		var pageSize = Number(req.query.pageSize)
		var pageNum = Number(req.query.pageNum)
		var pageStart = pageSize*pageNum
		var sqlres = await mysqlQuery(`select * from user order by id desc limit ${pageStart},${pageSize}`, [])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:sqlres.result})
  	}catch(e){
    	console.error(e)
    	res.send({success:false, result:e.toString()})
  	}
})

// header: xtoken
app.post("/team_count", async(req, res)=>{
	try{
		await getAdmin(req.headers['xtoken'])
		var sqlres = await mysqlQuery("select count(*) as count from team", [])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:sqlres.result[0].count})
  	}catch(e){
    	console.error(e)
    	res.send({success:false, result:e.toString()})
  	}
})

// header: xtoken
// param: pageSize pageNum
app.post("/team_list", async(req, res)=>{
	try{
		await getAdmin(req.headers['xtoken'])
		var pageSize = Number(req.query.pageSize)
		var pageNum = Number(req.query.pageNum)
		var pageStart = pageSize*pageNum
		var sqlres = await mysqlQuery(`select * from team where payhash is not null order by createTime desc limit ${pageStart},${pageSize}`, [])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:sqlres.result})
  	}catch(e){
    	console.error(e)
    	res.send({success:false, result:e.toString()})
  	}
})

// header: xtoken
// param: token('usdt', 'badge', 'ufd')
app.post("/reward_count", async(req, res)=>{
	try{
		await getAdmin(req.headers['xtoken'])
		var sqlres = await mysqlQuery("select count(*) as count from reward_record where token=?", [req.query.token])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:sqlres.result[0].count})
  	}catch(e){
    	console.error(e)
    	res.send({success:false, result:e.toString()})
  	}
})

// header: xtoken
// param: token pageSize pageNum
app.post("/reward_list", async(req, res)=>{
	try{
		await getAdmin(req.headers['xtoken'])
		var pageSize = Number(req.query.pageSize)
		var pageNum = Number(req.query.pageNum)
		var pageStart = pageSize*pageNum
		var sqlres = await mysqlQuery(`select * from reward_record where token=? order by id desc limit ${pageStart},${pageSize}`, [req.query.token])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:sqlres.result})
  	}catch(e){
    	console.error(e)
    	res.send({success:false, result:e.toString()})
  	}
})

// header: xtoken
app.post("/buybox_count", async(req, res)=>{
	try{
		await getAdmin(req.headers['xtoken'])
		var sqlres = await mysqlQuery(`select count(*) as count from mintbox where costAmount/boxAmount>${config.amount_box_buyusdt}-0.01`, [])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:sqlres.result[0].count})
  	}catch(e){
    	console.error(e)
    	res.send({success:false, result:e.toString()})
  	}
})

// header: xtoken
// param: pageSize pageNum
app.post("/buybox_list", async(req, res)=>{
	try{
		await getAdmin(req.headers['xtoken'])
		var pageSize = Number(req.query.pageSize)
		var pageNum = Number(req.query.pageNum)
		var pageStart = pageSize*pageNum
		var sqlres = await mysqlQuery(`select * from mintbox where costAmount/boxAmount>${config.amount_box_buyusdt}-0.01 order by account limit ${pageStart},${pageSize}`, [])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:sqlres.result})
  	}catch(e){
    	console.error(e)
    	res.send({success:false, result:e.toString()})
  	}
})

// header: xtoken
app.post("/syntheticbox_count", async(req, res)=>{
	try{
		await getAdmin(req.headers['xtoken'])
		var sqlres = await mysqlQuery(`select count(*) as count from mintbox where costAmount/boxAmount<${config.amount_box_buy2usdt}+0.01`, [])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:sqlres.result[0].count})
  	}catch(e){
    	console.error(e)
    	res.send({success:false, result:e.toString()})
  	}
})

// header: xtoken
// param: pageSize pageNum
app.post("/syntheticbox_list", async(req, res)=>{
	try{
		await getAdmin(req.headers['xtoken'])
		var pageSize = Number(req.query.pageSize)
		var pageNum = Number(req.query.pageNum)
		var pageStart = pageSize*pageNum
		var sqlres = await mysqlQuery(`select * from mintbox where costAmount/boxAmount<${config.amount_box_buy2usdt}+0.01 order by account limit ${pageStart},${pageSize}`, [])
		if(sqlres.code < 0) throw sqlres.result
		res.send({success:true, result:sqlres.result})
  	}catch(e){
    	console.error(e)
    	res.send({success:false, result:e.toString()})
  	}
})

app.listen('9001', ()=>{
	console.log('listen:9001')
})