const Web3 = require('web3')
const BigNumber = require('bignumber.js')
const mysql = require('mysql')
const config = require('./config')
const key = require('./key')
const xgame = require('./xgame.js')

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

const step = 99
const addresses = [config.addr_usdt2,config.addr_unt2,config.addr_img2,config.addr_box2]
const topic_transfer = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const topics = [topic_transfer, null, '0x000000000000000000000000'+config.addr_recharge.substr(2)]

const uAmount = (a)=>{
	return Math.floor(a.div(config.decimals_usdt).toNumber()*100)/100
}

const scanXGame = async()=>{
	try{
		var web3 = new Web3(key.rpc4)
		var curBlock = await web3.eth.getBlockNumber()
		var sqlres = await mysqlQuery('select * from scan where name=?', ['blockx'])
		if(sqlres.code < 0) throw sqlres.result
		if(sqlres.result.length == 0) throw new Error("no block scan record")
		var fromBlock = Number(sqlres.result[0].scaned)+1
		if(fromBlock >= curBlock) throw new Error("scan too fast")
		var toBlock = fromBlock + step
		if(toBlock > curBlock) toBlock = Number(curBlock)
		console.log(fromBlock, '=>', toBlock)
		var options = {fromBlock, toBlock, address:addresses, topics}
		var logs = await web3.eth.getPastLogs(options)
		console.log('logs',logs.length)
		for(var i = 0; i < logs.length; i++){
			var log = logs[i]
			var hash = log.transactionHash
			var block = log.blockNumber
			var logIndex = log.logIndex
			if(log.topics.length == 4 && log.data.length == 2){
				var token = log.address.toLowerCase()
				var from = '0x'+log.topics[1].substr(26)
				var tokenId = new BigNumber(log.topics[3]).toString()
				var sqlres = await mysqlQuery("select * from recharge721 where hash=?",[hash])
				if(sqlres.code < 0) throw sqlres.result
				if(sqlres.result.length == 0){
					sqlres = await mysqlQuery(
						"insert into recharge721(hash,block,logIndex,token,address,tokenId,cTime) values(?,?,?,?,?,?,now())",
						[hash,block,logIndex,token,from,tokenId])
					if(sqlres.code < 0) throw sqlres.result
					sqlres = await mysqlQuery("select * from user where address=?", [from])
					if(sqlres.code < 0){
						console.error(sqlres.result)
					}else if(sqlres.result.length > 0){
						var success = await xgame.addAccountItem(sqlres.result[0].id,999997,1,'1','mystery boxes are received')
						if(success) await mysqlQuery("update recharge721 set success=1 where hash=?",[hash])
					}
				}
			}else if(log.topics.length == 3 && log.data.length == 66){
				var token = log.address.toLowerCase()
				var from = '0x'+log.topics[1].substr(26)
				var amount = uAmount(new BigNumber(log.data))
				var sqlres = await mysqlQuery("select * from recharge20 where hash=?",[hash])
				if(sqlres.code < 0) throw sqlres.result
				if(sqlres.result.length == 0){
					sqlres = await mysqlQuery(
						"insert into recharge20(hash,block,logIndex,token,address,amount,cTime) values(?,?,?,?,?,?,now())",
						[hash,block,logIndex,token,from,amount])
					if(sqlres.code < 0) throw sqlres.result
					sqlres = await mysqlQuery("select * from user where address=?", [from])
					if(sqlres.code < 0){
						console.error(sqlres.result)
					}else if(sqlres.result.length > 0){
						var token_type = ""
						if(config.addr_usdt2 == token){
							token_type = 'usdt'
						}else if(config.addr_unt2 == token){
							token_type = 'unt'
						}else if(config.addr_img2 == token){
							token_type = 'img'
						}
						console.log('token_type:',token_type)
						if(token_type != ""){
							var success = await xgame.addAccountToken(sqlres.result[0].id,token_type,amount)
							if(success) await mysqlQuery("update recharge20 set success=1 where hash=?",[hash])
						}
					}
				}
			}
		}
		sqlres = await mysqlQuery("update scan set scaned=? where name=?", [toBlock,'blockx'])
		if(sqlres.code < 0) console.error(sqlres.result)
	}catch(e){
		console.error(e)
	}finally{
		setTimeout(scanXGame, 30000)
	}
}

scanXGame()