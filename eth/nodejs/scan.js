const Web3 = require('web3')
const BigNumber = require('bignumber.js')
const mysql = require('mysql')
const redis = require('redis')
const config = require('./config')
const jwt = require('jsonwebtoken')
const key = require('./key')
const abi_box = require('./abi/Box721.json')

const step = 99
const topic_registry = '0xcc0bec1447060c88cdc5a739cf29cfa26c453574dd3f5b9e4dcc317d6401cb1c' //Register(address,address,uint256)
const topic_mintbox = '0x5a3e96f397e68b20a43c25f664b628805b877334dadfcc925c6c1a3ad4340458' //Mint(uint256,address,uint256,uint256)
const topic_buystar = '0xa76261e4127b2ebc809716d704216602fdaee4ae5b72745ed9aec0d7bd73b75d' //Buy(address,uint256,address,uint256)
const topics = [[topic_registry,topic_mintbox,topic_buystar]]
const address = [config.addr_registry,config.addr_offerbox,config.addr_offerStar]
const redisClient = redis.createClient(key.redis)

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

const rpush = async(k, v)=>{
	return new Promise(resolve=>{
		redisClient.rPush(k, v, (err)=>{
			if(err){
				console.error(err)
				resolve(false)
			}else{
				resolve(true)
			}
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
		if(fromBlock >= curBlock) throw new Error("scan too fast")
		var toBlock = fromBlock + step
		if(toBlock > curBlock) toBlock = Number(curBlock)
		console.log(fromBlock, '=>', toBlock)
		var logs = await web3.eth.getPastLogs({fromBlock, toBlock, address, topics})
		console.log('logs',logs.length)
		for(var i = 0; i < logs.length; i++){
			var log = logs[i]
			if(log.address.toLowerCase()==config.addr_registry && log.topics.length==2 && log.data.length==130 && log.topics[0]==topic_registry){
				var leader = '0x'+log.topics[1].substr(26)
				var token = '0x'+log.data.substr(26,40)
				var amount = new BigNumber('0x'+log.data.substr(66))
				var hash = log.transactionHash
				sqlres = await mysqlQuery("select * from registry where hash=?", [hash])
				if(sqlres.code < 0) throw sqlres.result
				if(sqlres.result.length == 0){
					sqlres = await mysqlQuery("insert into registry(hash,team,token,cost) values(?,?,?,?)", [hash, leader, token, uAmount(amount)])
					if(sqlres.code <0) throw sqlres.result
					sqlres = await mysqlQuery("select * from team where leader=?", [leader])
					if(sqlres.code < 0){
						console.error(sqlres.result)
					}else{
						var team = sqlres.result[0]
						sqlres = await mysqlQuery("update team set payhash=? where leader=?", [hash, leader])
						if(sqlres.code <0) console.error(sqlres.result)
						sqlres = await mysqlQuery("update user set team=?,joinTime=now() where address=?", [leader, leader])
						if(sqlres.code <0) console.error(sqlres.result)
						if(Web3.utils.isAddress(team.inviter)){
							var sAmount = uAmount(amount.times(config.percent_team_invite).div(100))
							sqlres = await mysqlQuery(`update user set rewardUSDT=rewardUSDT+${sAmount} where address=?`, [team.inviter])
							if(sqlres.code < 0) console.error(sqlres.result)
							sqlres = await mysqlQuery('select * from user where address=?', [team.inviter])
							if(sqlres.code < 0){
								console.error(sqlres.result)
							}else if(sqlres.result.length > 0){
								var teamInviter = sqlres.result[0]
								sqlres = await mysqlQuery(`insert into reward_record(uid,token,reason,amount,createTime) values(?,?,?,?,now())`,
									[teamInviter.id,'usdt','regteam_teamInviter',sAmount])
								if(sqlres.code < 0) console.error(sqlres.result)
							}
						}
					}
				}
			}else if(log.address.toLowerCase()==config.addr_offerbox && log.topics.length==3 && log.data.length==130 && log.topics[0]==topic_mintbox){
				var round = new BigNumber(log.topics[1]).toFixed(0)
				var to = '0x'+log.topics[2].substr(26)
				var boxAmount = new BigNumber(log.data.substr(0, 66)).toFixed(0)
				var costAmount = new BigNumber('0x'+log.data.substr(66))
				var hash = log.transactionHash
				sqlres = await mysqlQuery("select * from mintbox where hash=?", [hash])
				if(sqlres.code < 0) throw sqlres.result
				if(sqlres.result.length == 0){
					sqlres = await mysqlQuery("insert into mintbox(hash,round,account,boxAmount,costAmount) values(?,?,?,?,?)",
						[hash,round,to,boxAmount,uAmount(costAmount)])
					if(sqlres.code < 0) throw sqlres.result
					sqlres = await mysqlQuery("select * from user where address=?", [to])
					if(sqlres.code < 0){
						console.error(sqlres.result)
					}else if(sqlres.result.length > 0){
						var user = sqlres.result[0]
						if(Web3.utils.isAddress(user.team)){
							sqlres = await mysqlQuery("select * from user where address=?", [user.team])
							if(sqlres.code < 0){
								console.error(sqlres.result)
							}else if(sqlres.result.length > 0){
								var leader = sqlres.result[0]
								if(user.id != leader.id){
									var teamAmount = uAmount(costAmount.times(config.percent_box_team_leader).div(100))
									sqlres = await mysqlQuery(`update user set rewardUSDT=rewardUSDT+${teamAmount} where address=?`, [user.team])
									if(sqlres.code < 0) console.error(sqlres.result)
									sqlres = await mysqlQuery(`insert into reward_record(uid,token,reason,amount,createTime) values(?,?,?,?,now())`,
										[leader.id,'usdt','mintbox_teamLeader',teamAmount])
									if(sqlres.code < 0) console.error(sqlres.result)
								}
								sqlres = await mysqlQuery("select * from team where leader=?", [user.team])
								if(sqlres.code < 0){
									console.error(sqlres.result)
								}else if(sqlres.result.length > 0){
									var team = sqlres.result[0]
									if(Web3.utils.isAddress(team.inviter)){
										sqlres = await mysqlQuery("select * from user where address=?", [team.inviter])
										if(sqlres.code < 0){
											console.error(sqlres.result)
										}else if(sqlres.result.length > 0){
											var teaminviter = sqlres.result[0]
											var inviteAmount = uAmount(costAmount.times(config.percent_box_team_inviter).div(100))
											sqlres = await mysqlQuery(`update user set rewardUSDT=rewardUSDT+${inviteAmount} where id=?`, [teaminviter.id])
											if(sqlres.code < 0) console.error(sqlres.result)
											sqlres = await mysqlQuery(`insert into reward_record(uid,token,reason,amount,createTime) values(?,?,?,?,now())`,
												[teaminviter.id,'usdt','mintbox_teamInviter',inviteAmount])
											if(sqlres.code < 0) console.error(sqlres.result)
										}
									}
								}
							}
						}
						if(user.p_ids != null && user.p_ids.length >= 8){
							sqlres = await mysqlQuery("select * from user where id=?", [user.p_ids.substr(-8)])
							if(sqlres.code < 0){
								console.error(sqlres.result)
							}else if(sqlres.result.length > 0){
								var inviter = sqlres.result[0]
								var inviteUsers = inviter.inviteUsers == null ? [] : JSON.parse(inviter.inviteUsers)
								if(inviteUsers.indexOf(to) < 0){
									inviteUsers.push(to)
									sqlres = await mysqlQuery("update user set inviteUsers=? where id=?", [JSON.stringify(inviteUsers), inviter.id])
									if(sqlres.code < 0) console.error(sqlres.result)
									if(inviteUsers.length % config.times_box_inviteuser == 0){
										sqlres = await mysqlQuery(`update user set rewardBadge=rewardBadge+${config.amount_box_invite_getblade} where id=?`, [inviter.id])
										if(sqlres.code < 0) console.error(sqlres.result)
										sqlres = await mysqlQuery(`insert into reward_record(uid,token,reason,amount,createTime) values(?,?,?,?,now())`,
											[inviter.id,'badge','mintbox_validUserInviter',1])
										if(sqlres.code < 0) console.error(sqlres.result)
									}
								}
							}
						}
					}
				}
			}else if(log.address.toLowerCase()==config.addr_offerStar && log.topics.length==2 && log.data.length==194 && log.topics[0]==topic_buystar){
				var account = '0x'+log.topics[1].substr(26)
				var quantity = new BigNumber(log.data.substr(0, 66))
				var currency = '0x'+log.data.substr(90, 40)
				var amount = new BigNumber('0x'+log.data.substr(130))
				var hash = log.transactionHash
				sqlres = await mysqlQuery("select * from buystar where hash=?", [hash])
				if(sqlres.code < 0) throw sqlres.result
				if(sqlres.result.length == 0){
					sqlres = await mysqlQuery("insert into buystar(hash,account,quantity,currency,amount) values(?,?,?,?,?)",
						[hash,account,quantity.toFixed(0),currency,uAmount(amount)])
					if(sqlres.code < 0) throw sqlres.result
					sqlres = await mysqlQuery("select * from user where address=?", [account])
					if(sqlres.code < 0){
						console.error(sqlres.result)
					}else if(sqlres.result.length > 0){
						var msg = {id:hash, uid:Number(sqlres.result[0].id), card:Number(quantity.toFixed(0)), time:Math.floor(new Date().getTime()/1000)}
						await rpush(config.redisKey_buyStar, JSON.stringify(msg))
					}
				}
			}
		}
		sqlres = await mysqlQuery("update scan set scaned=? where name=?", [toBlock,'block'])
		if(sqlres.code < 0) console.error(sqlres.result)
	}catch(e){
		console.error(e)
	}finally{
		setTimeout(scanBlock, 30000)
	}
}

const getDay = (t)=>{
	return Math.floor((new Date(t).getTime()/1000 - 25200)/86400)
}

const getTime = (t)=>{
	return t*86400+25200
}

const scanGame = async()=>{
	try{
		var now = new Date()
		var day = getDay(now)
		var fromTime = getTime(day)
		var toTime = getTime(day+1)
		var sqlres = await mysqlQuery2(`select uid,count(*) as count,max(updated_at) as updated_at from tbl_user_level_details where unix_timestamp(updated_at)>${fromTime} and unix_timestamp(updated_at)<=${toTime} group by uid`, [])
		if(sqlres.code <0) throw sqlres.result
		var logs = sqlres.result
		console.log('records',logs.length,now)
		for(var i = 0; i < logs.length; i++){
			var log = logs[i]
			if(Number(log.count) < config.times_game_rewardperday) continue
			try{
				sqlres = await mysqlQuery("select * from user where id=?", [log.uid])
				if(sqlres.code < 0) throw sqlres.result
				if(sqlres.result.length == 0) throw new Error("game uid not found in web")
				var user = sqlres.result[0]
				if(Web3.utils.isAddress(user.address) && user.bindBox != null && getDay(user.ufdUpdateTime) < getDay(log.updated_at)){
					sqlres = await mysqlQuery("select * from bindbox where tokenId=?", [user.bindBox])
					if(sqlres.code < 0) throw sqlres.result
					if(sqlres.result.length == 0) throw new Error("no bindbox of this tokenId")
					if(sqlres.result[0].times < config.times_game_rewardufd){
						var web3 = new Web3(key.rpc2)
						var contract = new web3.eth.Contract(abi_box, config.addr_box721)
						var owner = await contract.methods.ownerOf(user.bindBox).call()
						if(owner.toLowerCase() == user.address.toLowerCase()){
							sqlres = await mysqlQuery("update bindbox set times=times+1 where tokenId=?", user.bindBox)
							if(sqlres.code < 0) console.error(sqlres.result)
							sqlres = await mysqlQuery(`update user set ufdUpdateTime=?,rewardUFD=rewardUFD+${config.amount_game_rewardufd} where id=?`, [log.updated_at, user.id])
							if(sqlres.code < 0) console.error(sqlres.result)
							sqlres = await mysqlQuery(`insert into reward_record(uid,token,reason,amount,createTime) values(?,?,?,?,now())`,
								[user.id,'ufd','gamelevel_player',config.amount_game_rewardufd])
							if(sqlres.code < 0) console.error(sqlres.result)
						}
					}
				}
			}catch(e){
				console.error(e)
			}
		}
	}catch(e){
		console.error(e)
	}finally{
		setTimeout(scanGame, 30000)
	}
}

const run = async()=>{
	await redisClient.connect()
	scanBlock()
	scanGame()
}

run()
