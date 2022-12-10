const Web3 = require('web3')
const BigNumber = require('bignumber.js')
const config = require('./config')
const key = require('./key')

const step = 99
const topic_transfer = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // Transfer(address_,address_,uint256)
const topics = [[
	topic_transfer,
]]
const address = [
	config.addr_usdt,
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

const toAddress=(a)=>{
	return '0x'+a.substr(26)
}

const toAmount=(a,decimal)=>{
	return a.div(decimal).toFixed(2)
}

const updateTeam = async(from, amount, hash)=>{
	var sqlres = await mysqlQuery('replace into log_jointeam(hash,from,amount,createTime) values(?,?,?,now())',
		[hash, from, toAmount(amount, config.decimals_usdt)])
	if(sqlres.code < 0) throw sqlres.result
	sqlres = await mysqlQuery('select * from team where leader=?', [from])
	if(sqlres.code < 0) throw sqlres.result
	if(sqlres.result.length == 0 || sqlres.result[0].status != 1) return
	sqlres = await mysqlQuery('update team set') 
}

const scanBlock = async()=>{
	try{
		var web3 = new Web3(key.rpc)
		var curBlock = await web3.eth.getBlockNumber()
		var sqlres = await mysqlQuery('select * from scan where name=block', [])
		if(sqlres.code < 0) throw sqlres.result
		var fromBlock = Number(sqlres.result[0].scaned)+1
		var toBlock = fromBlock + step
		if(toBlock > curBlock) toBlock = Number(curBlock)
		console.log(fromBlock, '=>', toBlock)
		var logs = web3.eth.getPastLogs({fromBlock, toBlock, address, topics})
		console.log('logs',logs.length)
		for(var i = 0; i < logs.length; i++){
			var log = logs[i]
			if(log.address == config.addr_usdt.toLowerCase && logs.topics.length == 3 && logs.data.length == 66 &&
				logs.topics[0] == topic_transfer){
				var from = toAddress(logs.topics[1])
				var to = toAddress(logs.topics[2])
				var amount = new BigNumber(log.data)
				if(to == config.addr_jointeam.toLowerCase() && amount.eq(config.amount_jointeam_payusdt)){
					await updateTeam(from, amount, logs.transactionHash)
				}
			}
		}
		await mysqlQuery("update scan set scaned=? where name=block",[toBlock])
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
scanGame()