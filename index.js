var mysql = require('mysql');
var http=require('http');
var server;
var argv=require('minimist')(process.argv.slice(2));
const config={headers: {'Content-Type': 'application/x-www-form-urlencoded'},responseType: 'text'};
const ElectrumClient = require('@aguycalled/electrum-client-js')
const fs = require('fs');
const setGlobalVars = require("indexeddbshim");
const njs = require("navcoin-js");
const repl = require("repl");
const walletFile = undefined; // File name of the wallet database, persistence using dexie db backend only works on the browser
const password = undefined; // Password used to encrypt and open the wallet database
const spendingPassword = undefined; // Password used to send transactions
const mnemonic = "bracket shrug kit web three run stem resist barrel spring bounce clock"
const type = undefined; // Wallet type next, navcoin-core or navcoin-js-v1
const zapwallettxes = false; // Should the wallet be cleared of its history?
const log = true; // Log to console
const network = "testnet";
require('dotenv').config();
global.window = global;
setGlobalVars(null, { checkOrigin: false });
let wallet;
const prompt = repl.start("> ");
async function main()
{
	njs.wallet.Init().then(async () => {
	  wallet = new njs.wallet.WalletFile({
	    file: walletFile,
	    mnemonic: mnemonic,
	    type: type,
	    password: password,
	    spendingPassword: spendingPassword,
	    zapwallettxes: zapwallettxes,
	    log: log,
	    network: network,
	  });

	  console.log("navcoin-js build " + njs.version);
	  console.log("bitcore-lib build " + njs.wallet.bitcore.version);
	  prompt.context.wallet = wallet;

	  wallet.on("new_mnemonic", (mnemonic) =>
	    console.log(`wallet created with mnemonic ${mnemonic} - please back it up!`)
	  );

	  wallet.on("loaded", async () => {
	    console.log("wallet loaded");

	    console.log(
	      "xNAV receiving address: " +
	        (await wallet.xNavReceivingAddresses(true))[0].address
	    );
	    console.log(
	      "NAV receiving address: " +
	        (await wallet.NavReceivingAddresses(true))[0].address
	    );

	    await wallet.Connect();
	  });

	  wallet.on("connected", () => console.log("connected. waiting for sync"));

	  wallet.on("sync_status", async (progress, pending) => {
	    console.log(`Sync ${progress}%`);
	  });

	  wallet.on("db_load_error", async (err) => {
	    console.log(`Error Load DB: ${err}`);
	    process.exit(1);
	  });

	  wallet.on("sync_finished", async () => {
	    console.log("sync_finished");
	    console.log(`Balance ${JSON.stringify(await wallet.GetBalance())}`);
	  });

	  wallet.on("new_tx", async (list) => {
	    console.log(`Received transaction ${JSON.stringify(list)}`);
	    console.log(`Balance ${JSON.stringify(await wallet.GetBalance())}`);
	  });

	  await wallet.Load({
	    bootstrap: njs.wallet.xNavBootstrap,
	  });
	});


	const client = new ElectrumClient(
		'electrum-testnet.nav.community',
		40004,
		'wss'
	)
	console.log(process.env.MYSQL_HOST);
	console.log(process.env.MYSQL_USER);
	console.log(process.env.MYSQL_PASSWORD);

	var con = mysql.createConnection({
		host: process.env.MYSQL_HOST,
		user: process.env.MYSQL_USER,
		password: process.env.MYSQL_PASSWORD
	});

	con.connect(function(err)
	{
		if (err) throw err;
		console.log("Connected to MySQL server.");
	});
	function invalidateProof(s)
	{
		console.log("NFT Moved");
		console.log("Old hash -> " + s[0][0]);
		console.log("New hash -> " + s[1].spender_txhash);
		let table="proofs";
		let sql="SELECT id FROM nft."+table+" WHERE hash='"+s[0][0]+"' AND is_valid=1 LIMIT 1;";
		//console.log(sql);
		con.query(sql, function (err, result, fields)
		{
			if (err) throw err;
			if (result.length==1)
			{
				let sql = "UPDATE nft."+table+" SET `invalidated_date`=NOW(),`new_hash`='"+s[1].spender_txhash+"',`is_valid` = '0' WHERE "+table+".hash='"+s[0][0]+"';";
				con.query(sql, function (err, result)
				{
					if (err)
					{
						console.log("NFT ownership (proof) cannot invalidated -> " + err);
					}
					else
					{
						console.log("NFT ownership (proof) successfully invalidated.");
					}
				});
			}
			else
			{
				console.log("NFT ownership (proof) already invalidated.");
			}
		});
		table="orders";
		sql="SELECT id FROM nft."+table+" WHERE hash='"+s[0][0]+"' AND is_valid=1 LIMIT 1;";
		//console.log(sql);
		con.query(sql, function (err, result, fields)
		{
			if (err) throw err;
			if (result.length==1)
			{
				let sql = "UPDATE nft."+table+" SET `invalidated_date`=NOW(),`new_hash`='"+s[1].spender_txhash+"',`is_valid` = '0' WHERE "+table+".hash='"+s[0][0]+"';";
				con.query(sql, function (err, result)
				{
					if (err)
					{
						console.log("NFT ownership (order) cannot invalidated -> " + err);
					}
					else
					{
						console.log("NFT ownership (order) successfully invalidated.");
					}
				});
			}
			else
			{
				console.log("NFT ownership (order) already invalidated.");
			}
		});
	}
	function sendResponse(res, statusCode, body)
	{
		res.writeHead(statusCode);
		res.write(body);
		res.end();
	}
	server=http.createServer(function (req, res)
	{
		res.setHeader('Access-Control-Allow-Origin', "*");
		res.setHeader('Access-Control-Allow-Methods','GET,PUT,POST,DELETE');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
		var url=req.url;
		var body='';
		req.on('data', function (data)
		{
			body+=data;
		});
		req.on('end', function ()
		{
			var post;
			try
			{
				post=body?JSON.parse(body) : {}
				console.log(post);
			}
			catch (err)
			{
				console.error(err)
			}
			var now=new Date(); 
			var datetime=now.getHours()+':'+now.getMinutes()+':'+now.getSeconds(); 
			console.log(datetime + " " + req.url);
			if (req.url=="/GetNftSellOrders")
			{
				con.query("SELECT orders.metadata,orders.nft_order,orders.token_id,orders.nft_id,collections.name AS collection_name,collections.metadata AS collection_metadata FROM nft.orders LEFT JOIN nft.collections ON orders.token_id=collections.token_id WHERE is_valid=1", async function (err, result, fields)
				{
					if (err) throw err;
					let obj={status:"success",orders:result};
					sendResponse(res, 200,JSON.stringify(obj))
				});
			}
			else if (req.url=="/CancelSellNftOrder")
			{
				console.log("Checking NFT order exist -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
				con.query("SELECT * FROM nft.orders WHERE token_id='"+post.proof.tokenId+"' AND nft_id="+post.proof.nftId+" AND is_valid=1", function (err, result, fields)
				{
					if (err) throw err;
					if (result.length>0)
					{
						console.log("NFT order exist.");
						console.log("Verifying NFT proof -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
						let hex=Buffer.from(post.proof.sig).toString('hex');
						let proof={nftId:parseInt(post.proof.nftId),tokenId:post.proof.tokenId.toString(),sig:Buffer.from(hex,'hex')};
						wallet.VerifyNftProof(post.proof.tokenId.toString(),parseInt(post.proof.nftId),proof).then((retval) =>
						{
							console.log(retval);
							if (retval.result)
							{
								console.log("NFT ownership verified -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
								console.log("Cancelling NFT order -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
								con.query("UPDATE nft.orders SET is_valid=0 WHERE token_id='"+post.proof.tokenId.toString()+"' AND nft_id="+post.proof.nftId+" AND is_valid=1", async function (err, result, fields)
								{
									if (err) throw err;
									console.log("NFT order cancelled -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
									let obj={status:"success",message:"NFT sell order successfully cancelled."};
									sendResponse(res, 200,JSON.stringify(obj));
								});
							}
						});
					}
					else
					{
						console.log("NFT sell order doest not exist.");
						let obj={status:"nft_sell_order_does_not_exist",message:"NFT sell order does not exist."};
						sendResponse(res, 200,JSON.stringify(obj));
					}
				});
			}
			else if (req.url=="/CreateSellNftOrder")
			{
				let token_id=post.order.receive[0].tokenId;
				let nft_id=post.order.receive[0].tokenNftId;
				console.log(post.proof);
				console.log(post.order);
				console.log(token_id);
				console.log(nft_id);
				let hex=Buffer.from(post.proof.sig).toString('hex');
				let proof={nftId:parseInt(post.proof.nftId),tokenId:post.proof.tokenId.toString(),sig:Buffer.from(hex,'hex')};
				console.log("Verifying Order...");
				console.log(post.order);
				wallet.VerifyOrder(post.order).then((result) =>
				{
					console.log("Verify order result -> " + result);
				})
				.catch((e) =>
				{
					console.log("Error while verifying order");
					console.log(e);
					console.log(e.stack);
				});
				console.log("Verifying NFT -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
				wallet.VerifyNftProof(post.proof.tokenId.toString(),parseInt(post.proof.nftId),proof).then((retval) =>
				{
					console.log(retval);
					if (retval.result)
					{
						console.log("NFT ownership verified -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
						console.log("Fetching NFT collection metadata -> " + post.proof.tokenId);
						create_nft_collection(post.proof.tokenId);
						console.log("Fetching NFT metadata -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
						wallet.GetNftInfo(post.proof.tokenId.toString(),parseInt(post.proof.nftId)).then((nftinfo) =>
						{
							console.log(nftinfo);
							con.query("SELECT * FROM nft.orders WHERE token_id='"+token_id+"' AND nft_id='"+nft_id+"' AND is_valid=1", function (err, result, fields)
							{
								if (err) throw err;
								if (result.length==0)
								{
									let sql = `INSERT INTO nft.orders(
									    id,
									    token_id,
									    nft_id,
									    metadata,
									    hash,
									    nout,
									    nft_order,
									    verification_date,
									    is_valid
									)
									VALUES(
									    NULL,
									    '`+token_id+`',
									    '`+nft_id+`',
									    ?,
									    '`+retval.txid+`',
									    '`+retval.nout+`',
									    '`+JSON.stringify(post.order)+`',
									    NOW(),
									    '1'
									);`;
									//console.log(sql);
									con.query(sql,[JSON.stringify(nftinfo)], async function (err, result)
									{
										if (err)
										{
											let obj={status:"failed",message:"Database error.",order:post.order};
											console.log(obj);
											console.log("NFT sell order record not added -> " + err);
										}
										else
										{
											console.log("NFT sell order record added to database.");
											console.log("Subscribing nft sell order -> " + retval.txid + "->" + retval.nout);
											let currentStatus = await client.blockchain_outpoint_subscribe(retval.txid,retval.nout);
											verifyStatus([[retval.txid, retval.nout], currentStatus]);
											let obj={status:"order_created",message:"Order created",proof:post.proof};
											sendResponse(res, 200,JSON.stringify(obj));
										}
									});
								}
								else
								{
									let obj={status:"failed",message:"Order already exist",order:post.order};
									console.log(obj);
									sendResponse(res, 200,JSON.stringify(obj));
								}
							});
						});
					}
					else
					{
						console.log("NFT ownership verification failed -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
						let obj={status:"failed",proof:post.proof};
						sendResponse(res, 200,JSON.stringify(obj));
					}
				});
			}
			else if (req.url=="/CreateNftProof")
			{
				console.log("Verifying NFT Ownership Proof -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
				let hex=Buffer.from(post.proof.sig).toString('hex');
				let proof={nftId:parseInt(post.proof.nftId),tokenId:post.proof.tokenId.toString(),sig:Buffer.from(hex,'hex')};
				wallet.VerifyNftProof(post.proof.tokenId.toString(),parseInt(post.proof.nftId),proof).then((retval) =>
				{
					console.log(retval);
					if (retval.result)
					{
						console.log("NFT ownership verified -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
						create_nft_collection(post.proof.tokenId);
						con.query("SELECT * FROM nft.proofs WHERE project_id='"+post.project_id+"' AND private_address='"+post.private_address+"' AND token_id='"+post.proof.tokenId.toString()+"' AND nft_id='"+post.proof.nftId+"' AND hash='"+retval.txid+"' AND nout="+retval.nout+"", function (err, result, fields)
						{
							if (err) throw err;
							if (result.length==0)
							{
								let sql = `INSERT INTO nft.proofs(
								    id,
								    project_id,
								    private_address,
								    token_id,
								    nft_id,
								    hash,
								    nout,
								    new_hash,
								    verification_date,
								    is_valid
								)
								VALUES(
								    NULL,
								    '`+post.project_id+`',
								    '`+post.private_address+`',
								    '`+post.proof.tokenId.toString()+`',
								    '`+post.proof.nftId+`',
								    '`+retval.txid+`',
								    '`+retval.nout+`',
								    NULL,
								    NOW(),
								    '1'
								);`;
								con.query(sql, async function (err, result)
								{
									if (err)
									{
										console.log("NFT ownership record not added -> " + err);
									}
									else
									{
										console.log("NFT ownership record added to database.");
										console.log("Subscribing nft proof -> " + retval.txid + "->" + retval.nout);
										let currentStatus = await client.blockchain_outpoint_subscribe(retval.txid,retval.nout);
										verifyStatus([[retval.txid, retval.nout], currentStatus]);
										let obj={status:"verified",proof:post.proof};
										console.log(sendResponse(res, 200,JSON.stringify(obj)));
									}
								});
							}
							else
							{
								console.log("This NFT already verified.");
								let obj={status:"already_verified",proof:post.proof};
								console.log(obj);
								sendResponse(res, 200,JSON.stringify(obj));
							}
						});
					}
					else
					{
						console.log("NFT ownership verification failed -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
						let obj={status:"failed",proof:post.proof};
						sendResponse(res, 200,JSON.stringify(obj));
					}
				}).
				catch((e) =>
				{
					console.log("Error while verifying nft proof");
					console.log(e);
				});
			}
			else if (req.url=="/CheckQR")
			{
				console.log("Checking QR code -> " + post.code);
				let obj={status:"success",code:post.code};
			}
			else
			{
				let obj={status:"failed",message:"Unsupported request url"};
				sendResponse(res, 200,JSON.stringify(obj));
			}
		});
	});

	const verifyStatus = (s) => 
	{
		console.log("Verifying status...");
		if (s[1] && s[1].spender_txhash)
		{
			invalidateProof(s);
		}
	}
	client.subscribe.on("blockchain.outpoint.subscribe", verifyStatus);

	function create_nft_collection(token_id)
	{
		console.log("Checking NFT collection...");
		con.query("SELECT token_id FROM nft.collections WHERE token_id='"+token_id+"' LIMIT 1", async function (err, result, fields)
		{
			if (err) throw err;
			console.log("Result length-> " + result.length);
			if (result.length<1)
			{
				console.log("Fetching NFT collection data...");
				wallet.GetTokenInfo(token_id).then((token_info) =>
				{
					console.log(token_info);
					console.log("Creating NFT collection...");
					con.query("INSERT INTO nft.collections SET token_id='"+token_id+"',name='"+token_info.name+"',supply="+token_info.supply+",version="+token_info.version+",metadata=?",[token_info.code], async function (err, result, fields)
					{
						if (err) throw err;
						console.log("NFT collection created...");
					});
				});
			}
			else
			{
				console.log("NFT Collection already exist...");
			}
		});
	}

	function subscribe_nfts()
	{
		console.log("Subscribing for verified nfts...");
		con.query("SELECT hash,nout FROM nft.proofs WHERE is_valid=1", async function (err, result, fields)
		{
			if (err) throw err;
			for (let e of result)
			{
				console.log("Subscribing for nft proof -> " + e.hash + "->" + e.nout);
				let currentStatus = await client.blockchain_outpoint_subscribe(e.hash,parseInt(e.nout));
				verifyStatus([[e.hash, parseInt(e.nout)], currentStatus]);
			}
		});
		console.log("Subscribing for nft sell orders...");
		con.query("SELECT hash,nout FROM nft.orders WHERE is_valid=1", async function (err, result, fields)
		{
			if (err) throw err;
			for (let e of result)
			{
				console.log("Subscribing nft sell order -> " + e.hash + "->" + e.nout);
				let currentStatus = await client.blockchain_outpoint_subscribe(e.hash,parseInt(e.nout));
				verifyStatus([[e.hash, parseInt(e.nout)], currentStatus]);
			}
		});
	}
	
	try
	{
		await client.connect(
			'electrum-client-js', // optional client name
			'1.5' // optional protocol version
		)
		subscribe_nfts();
	}
	catch (err)
	{
		console.error(err)
	}
	server.listen(argv.p || 3000);
	console.log('Server running on port ' + (argv.p || 3000))
}
main();