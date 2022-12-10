const Web3 = require('web3')
const BigNumber = require('bignumber.js')
const Telegraf = require('telegraf')
const mysql = require('mysql')
const config = require('./config')
const key = require('./key')

const step = 99
const topic_transfer = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', //Transfer(address_,address_,uint256)
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

const tgMessage = async(msg) => {
  try {
    const tg = new Telegraf.Telegram(key.tgToken);
    await tg.sendMessage(key.tgChannel, msg);
  } catch (error) {
    console.error({ error, msg }, 'send telegram message error');
  }
}

const jointeamTransfer = async(from, amount, hash)=>{
	var sqlres = await mysqlQuery("select * from jointeamTransfer where hash=?", [hash])
	if(sqlres.code < 0) throw sqlres.result
	if(sqlres.result.length > 0) return
	var damount = toAmount(amount, config.decimals_usdt)
	if(sqlres.code < 0) throw sqlres.result
	sqlres = await mysqlQuery("select * from team where leader=?", [from])
	if(sqlres.code < 0) throw sqlres.result
	var msg = `address_jointeam receive usdt ${damount}\nfrom:${from}\ntxHash:${hash}\n---------------\n`
	var update = 0
	if(amount.eq(config.amount_jointeam_payusdt)){
		msg += '[error]:amount not match\n'
	}else(sqlres.result.length == 0){
		msg += '[error]:team not registed\n'
	}else{
		var team = sqlres.result[0]
		var statuslist = ['未知','已提交资料','已付款','审核通过','审核失败']
		var status = Number(team.status)
		msg += `name:${team.name}\n`
		msg += `description:${team.description}\n`
		msg += `email:${team.email}\n`
		msg += `inviter:${team.inviter}\n`
		msg += `status:${statuslist[status]}\n`
		if(status == 0 || status == 1){
			msg += status == 0 ? '[warning]:message not upload\n' : ''
			msg += '[register]:success or fail\n'
			update = 1
			sqlres = await mysqlQuery("update team set payhash=? and status=2 where leader=?", [hash, from])
			if(sqlres.code < 0) throw sqlres.result
		}else{
			msg += '[error]:duplicate pay\n'
		}
	}
	sqlres = await mysqlQuery("insert jointeamTransfer(hash,from,amount,status,createTime) values(?,?,?,?,now())",
		[hash, from, damount, update])
	if(sqlres.code < 0) throw sqlres.result
	await tgMessage(msg)
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
			if(log.address == config.addr_usdt && logs.topics.length == 3 && logs.data.length == 66 && logs.topics[0] == topic_transfer){
				if(toAddress(logs.topics[2]) == config.addr_jointeam){
					await jointeamTransfer(toAddress(logs.topics[1]), new BigNumber(log.data), logs.transactionHash)
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
//scanGame()