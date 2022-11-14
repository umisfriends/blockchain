const Web3 = require('web3')
const express = require('express')
const ethUtil = require('ethereumjs-util')
const fs = require('fs')
const app = express()
const chainid = 5
const addr_mint1155 = "0x0Af8335441f9c4F1c2331f0695fbB9268fc37Cc0"
const prikey = fs.readFileSync('privatekey.txt').toString().trim()
var whitelist = []
var maxround = 0
while(fs.existsSync(`mint1155_whitelist_${maxround}.txt`)){
	whitelist.push(fs.readFileSync(`mint1155_whitelist_${maxround}.txt`).toString().toLowerCase().split('\r\n'))
	maxround++;
}
console.log(whitelist)

app.all("*",function(req,res,next){
    res.header("Access-Control-Allow-Origin","*");
    res.header("Access-Control-Allow-Headers","*");
    res.header("Access-Control-Allow-Methods","*");
    if (req.method.toLowerCase() == 'options')
        res.send(200);
    else
        next();
})
// parameter: round, address
app.get('/mint1155_sign', (req, res)=>{
	try{
		const round = Number(req.query.round)
		const address = req.query.address.toLowerCase()
		console.log(round)
		console.log(whitelist[0])
		if(whitelist[round].indexOf(address) < 0) throw new Error("not in whitelist")
		const deadline = Math.ceil(new Date().getTime()/1000)+300
		const data = Web3.utils.encodePacked(chainid, addr_mint1155, "mint", round, address, deadline)
		const hash = Web3.utils.sha3(data)
		const sign = ethUtil.ecsign(ethUtil.toBuffer(hash), ethUtil.toBuffer(prikey))
		const result = {round,address,deadline,v:sign.v,r:ethUtil.bufferToHex(sign.r),s:ethUtil.bufferToHex(sign.s)}
		res.send({success:true, result})
	}catch(e){
		console.log(e)
		res.send({success:false, result:e.toString()})
	}
})
app.listen('9000', ()=>{
	console.log('listen:9000')
})