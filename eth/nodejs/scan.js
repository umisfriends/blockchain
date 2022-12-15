const Web3 = require('web3')
const BigNumber = require('bignumber.js')
const mysql = require('mysql')
const config = require('./config')
const jwt = require('jsonwebtoken')
const key = require('./key')

const step = 99
const topic_registry = '0xcc0bec1447060c88cdc5a739cf29cfa26c453574dd3f5b9e4dcc317d6401cb1c' //Register(address,address,uint256)
const topics = [[
	topic_registry,
]]
const address = [
	config.addr_registry,
]

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

const uAmount = (a)=>{
	return a.div(config.decimals_usdt).toFixed(2)
}

const scanBlock = async()=>{
	try{
		var web3 = new Web3(key.rpc)
		var curBlock = await web3.eth.getBlockNumber()
		var sqlres = await mysqlQuery('select * from scan where name=?', ['block'])
		if(sqlres.code < 0) throw sqlres.result
		var fromBlock = Number(sqlres.result[0].scaned)+1
		var toBlock = fromBlock + step
		if(toBlock > curBlock) toBlock = Number(curBlock)
		console.log(fromBlock, '=>', toBlock)
		var logs = await web3.eth.getPastLogs({fromBlock, toBlock, address, topics})
		console.log('logs',logs.length)
		for(var i = 0; i < logs.length; i++){
			var log = logs[i]
			if(log.address.toLowerCase() == config.addr_registry && log.topics.length == 2 && log.data.length == 130 && log.topics[0] == topic_register){
				var team = '0x'+log.topics[1].substr(2)
				var token = '0x'+log.data.substr(26,40)
				var amount = new BigNumber('0x'+log.data.substr(66))
				var hash = log.transactionHash
				sqlres = await mysqlQuery("select * from registry where hash=?", [hash])
				if(sqlres.code < 0) throw sqlres.result
				if(sqlres.result.length == 0){
					sqlres = await mysqlQuery("insert into registry(hash,team,token,cost) values(?,?,?,?)", [hash, team, token, uAmount(amount)])
					if(sqlres.code <0) console.error(sqlres.result)
					sqlres = await mysqlQuery("update team set payhash=? where leader=?", [hash, team])
					if(sqlres.code <0) console.error(sqlres.result)
					sqlres = await mysqlQuery("select * from user where address in (select inviter from team where leader=?)", [team])
					if(sqlres.code == 0 && sqlres.result.length > 0){
						var id = sqlres.result[0].id
						var sAmount = uAmount(amount.times(config.percent_team_invite_getusdt).div(100))
						sqlres = await mysqlQuery(`update user set rewardUSDT=rewardUSDT+${sAmount} where id=?`, [id])
						if(sqlres.code < 0) console.error(sqlres.result)
					}
				}
			}
		}
		sqlres = await mysqlQuery("update scan set scaned=? where name=?",[toBlock, 'block'])
		if(sqlres.code < 0) throw sqlres.result
	}catch(e){
		console.error(e)
	}finally{
		setTimeout(scanBlock, 17000)
	}
}

const scanGame = async()=>{
	try{

	}catch(e){
		console.error(e)
	}finally{
		setTimeout(scanGame, 10000)
	}
}

scanBlock()
//scanGame()
