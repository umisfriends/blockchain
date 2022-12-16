const Web3 = require('web3')
const BigNumber = require('bignumber.js')
const mysql = require('mysql')
const config = require('./config')
const jwt = require('jsonwebtoken')
const key = require('./key')

const step = 99
const topic_registry = '0xcc0bec1447060c88cdc5a739cf29cfa26c453574dd3f5b9e4dcc317d6401cb1c' //Register(address,address,uint256)
const topic_mintbox = '0x5a3e96f397e68b20a43c25f664b628805b877334dadfcc925c6c1a3ad4340458' //Mint(uint256,address,uint256,uint256)
const topics = [[
	topic_registry,
]]
const address = [
	config.addr_registry,
	config.addr_claim1155,
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

const uAmount = (a)=>{
	return a.div(config.decimals_usdt).toFixed(4)
}

const scanBlock = async()=>{
	try{
		var web3 = new Web3(key.rpc)
		var curBlock = await web3.eth.getBlockNumber()
		var sqlres = await mysqlQuery('select * from scan where name=?', ['block'])
		if(sqlres.code < 0) throw sqlres.result
		if(sqlres.result.length == 0) throw new Error("no block scan record")
		var fromBlock = Number(sqlres.result[0].scaned)+1
		var toBlock = fromBlock + step
		if(toBlock > curBlock) toBlock = Number(curBlock)
		console.log(fromBlock, '=>', toBlock)
		var logs = await web3.eth.getPastLogs({fromBlock, toBlock, address, topics})
		console.log('logs',logs.length)
		for(var i = 0; i < logs.length; i++){
			var log = logs[i]
			if(log.address.toLowerCase()==config.addr_registry && log.topics.length==2 && log.data.length==130 && log.topics[0]==topic_register){
				var team = '0x'+log.topics[1].substr(2)
				var token = '0x'+log.data.substr(26,40)
				var amount = new BigNumber('0x'+log.data.substr(66))
				var hash = log.transactionHash
				sqlres = await mysqlQuery("select * from registry where hash=?", [hash])
				if(sqlres.code < 0) throw sqlres.result
				if(sqlres.result.length == 0){
					sqlres = await mysqlQuery("insert into registry(hash,team,token,cost) values(?,?,?,?)", [hash, team, token, uAmount(amount)])
					if(sqlres.code <0) throw sqlres.result
					sqlres = await mysqlQuery("update team set payhash=? where leader=?", [hash, team])
					if(sqlres.code <0) console.error(sqlres.result)
					sqlres = await mysqlQuery("update user set team=?")
					sqlres = await mysqlQuery("select * from user where address in (select inviter from team where leader=?)", [team])
					if(sqlres.code == 0 && sqlres.result.length > 0){
						var id = sqlres.result[0].id
						var sAmount = uAmount(amount.times(config.percent_team_invite).div(100))
						sqlres = await mysqlQuery(`update user set rewardUSDT=rewardUSDT+${sAmount} where id=?`, [id])
						if(sqlres.code < 0) console.error(sqlres.result)
					}
				}
			}else if(los.address.toLowerCase()==config.addr_badge1155 && log.topics.length==3 && log.data.length==130 && log.topics[0]==topic_mintbox){
				var round = new BigNumber(topics[1]).toFixed(0)
				var to = '0x'+log.topics[2].substr(26)
				var boxAmount = new BigNumber(log.data.substr(0, 66))
				var costAmount = new BigNumber(log.data.substr(66))
				var hash = log.transactionHash
				sqlres = await mysqlQuery("select * from mintbox where hash=?", [hash])
				if(sqlres.code < 0) throw sqlres.result
				if(sqlres.result.length == 0){
					sqlres = await mysqlQuery("insert into mintbox set(hash,round,account,boxAmount,costAmount) values(?,?,?,?,?)",
						[hash,round,boxAmount.toFixed(0),uAmount(costAmount)])
					if(sqlres.code < 0) throw sqlres.result
					sqlres = await mysqlQuery("select * from user where address=?", [to])
					if(sqlres.code < 0){
						console.error(sqlres.result)
					}else if(sqlres.result.length > 0){
						var user = sqlres.result[0]
						if(!Web3.isAddress(user.team)){
							sqlres = await mysqlQuery("select * from user where address=?", [user.team])
							if(sqlres.code < 0){
								console.error(sqlres.result)
							}else if(sqlres.result.length > 0){
								var leader = sqlres.result[0]
								var teamAmount = uAmount(costAmount.times(config.percent_box_team_leader).div(100))
								sqlres = await mysqlQuery(`update user set rewardUSDT=rewardUSDT+${teamAmount} where address=?`, [user.team])
								if(sqlres.code < 0) console.error(sqlres.result)
								sqlres = await mysqlQuery("select * from team where leader=?", [user.team])
								if(sqlres.code < 0){
									console.error(sqlres.result)
								}else if(sqlres.result.length > 0){
									var team = sqlres.result[0]
									sqlres = await mysqlQuery("select * from user where address=?", [team.inviter])
									if(sqlres.code < 0){
										console.error(sqlres.result)
									}else if(sqlres.result.length > 0){
										var teaminviter = sqlres.result[0]
										var inviteAmount = uAmount(costAmount.times(config.percent_box_team_inviter).div(100))
										sqlres = await mysqlQuery(`update user set rewardUSDT=rewardUSDT+${inviteAmount} where id=?`, [teaminviter.id])
										if(sqlres.code < 0) console.error(sqlres.result)
									}
								}
							}
						}
						if(!Web3.isAddress(user.p_address)){
							sqlres = await mysqlQuery("select * from user where address=?", [user.p_address])
							if(sqlres.code < 0){
								console.error(sqlres.result)
							}else if(sqlres.result.length > 0){
								console.error('to do mintbot get blage')
							}
						}
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
		var sqlres = await mysqlQuery("select * from scan where name=?", ['game'])
		if(sqlres.code < 0) throw sqlres.result
		if(sqlres.result.length < 0) throw new Error("no game scan record")
		var fromTime = sqlres.result[0].scaned
		sqlres = await mysqlQuery2("select max(updated_at) as updateTime from tbl_user_level_details", [])
		if(sqlres.code < 0) throw sqlres.result
		if(sqlres.result.length == 0) throw new Error("no game log")
		var toTime = sqlres.result[0].updateTime
		if(fromTime < toTime){
			sqlres = await mysqlQuery2("select * from tbl_user_level_details where result>=2 and updated_at>? and updated_at<=?", [fromTime, toTime])
			if(sqlres.code <0) throw sqlres.result
			var logs = sqlres.result
			for(var log of logs){
				try{
					sqlres = await mysqlQuery("select * from user where id=?", log.uid)
					if(sqlres.code < 0) throw sqlres.result
					if(sqlres.result.length == 0) throw new Error("game uid not found in web")
					var user = sqlres.result[0]
					var updteDay = new Date(log.updated_at).getTime()/1000
					if(!Web3.isAddress(user.address) && user.bindbox != null && Math.floor(user.ufdUpdateTime/86400) < Math.floor(updteDay/86400)){
						sqlres = await mysqlQuery("select * from bindbox where tokenId=?", [user.bindbox])
						if(sqlres.code < 0) throw sqlres.result
						if(sqlres.result[0].times < config.times_game_rewardufd){
							var web3 = new Web3(config.rpc)
							var contract = new web3.eth.Contract(abi_box, config.addr_box721)
							var owner = contract.methods.ownerOf(user.bindbox)
							if(owner.toLowerCase() == user.address.toLowerCase()){
								sqlres = await mysqlQuery("update tokenId set times=times+1 where tokenId=?", user.bindbox)
								if(sqlres.code < 0) console.error(sqlres.result)
								sqlres = await mysqlQuery(`update user set ufdUpdateTime=?,rewardUFDBox=rewardUFDBox+${config.amount_game_rewardufd} where id=?`, [updteDay, user.id])
								if(sqlres.code < 0) console.error(sqlres.result)
							}
						}
					}
				}catch(e){
					console.error(e)
				}
			}
			sqlres = await mysqlQuery("update scan set scaned=? where name=?", [toTime, 'game'])
			if(sqlres.code < 0) console.error(sqlres.code)
		}
	}catch(e){
		console.error(e)
	}finally{
		setTimeout(scanGame, 10000)
	}
}

scanBlock()
scanGame()
