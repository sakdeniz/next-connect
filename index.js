var log4js = require('log4js');
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
log4js.configure({
  appenders: {
    out: { type: 'stdout' },
    app: { type: 'file', filename: 'debug.log' }
  },
  categories: {
    default: { appenders: [ 'out', 'app' ], level: 'debug' }
  }
});
var logger = log4js.getLogger('API'); 
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

	  logger.info("navcoin-js build " + njs.version);
	  logger.info("bitcore-lib build " + njs.wallet.bitcore.version);
	  prompt.context.wallet = wallet;

	  wallet.on("new_mnemonic", (mnemonic) =>
	    logger.info(`wallet created with mnemonic ${mnemonic} - please back it up!`)
	  );

	  wallet.on("loaded", async () => {
	    logger.info("wallet loaded");

	    logger.info(
	      "xNAV receiving address: " +
	        (await wallet.xNavReceivingAddresses(true))[0].address
	    );
	    logger.info(
	      "NAV receiving address: " +
	        (await wallet.NavReceivingAddresses(true))[0].address
	    );

	    await wallet.Connect();
	  });

	  wallet.on("connected", () => logger.info("connected. waiting for sync"));

	  wallet.on("sync_status", async (progress, pending) => {
	    logger.info(`Sync ${progress}%`);
	  });

	  wallet.on("db_load_error", async (err) => {
	    logger.info(`Error Load DB: ${err}`);
	    process.exit(1);
	  });

	  wallet.on("sync_finished", async () => {
	    logger.info("sync_finished");
	    logger.info(`Balance ${JSON.stringify(await wallet.GetBalance())}`);
	  });

	  wallet.on("new_tx", async (list) => {
	    logger.info(`Received transaction ${JSON.stringify(list)}`);
	    logger.info(`Balance ${JSON.stringify(await wallet.GetBalance())}`);
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
	logger.info(process.env.MYSQL_HOST);
	logger.info(process.env.MYSQL_USER);
	logger.info(process.env.MYSQL_PASSWORD);

	var con = mysql.createConnection({
		host: process.env.MYSQL_HOST,
		user: process.env.MYSQL_USER,
		password: process.env.MYSQL_PASSWORD
	});

	con.connect(function(err)
	{
		if (err) throw err;
		logger.info("Connected to MySQL server.");
	});
	function invalidateProof(s)
	{
		logger.info("NFT Moved");
		logger.info("Old hash -> " + s[0][0]);
		logger.info("New hash -> " + s[1].spender_txhash);
		let table="proofs";
		let sql="SELECT id FROM nft."+table+" WHERE hash='"+s[0][0]+"' AND is_valid=1 LIMIT 1;";
		//logger.info(sql);
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
						logger.info("NFT ownership (proof) cannot invalidated -> " + err);
					}
					else
					{
						logger.info("NFT ownership (proof) successfully invalidated.");
					}
				});
			}
			else
			{
				logger.info("NFT ownership (proof) already invalidated.");
			}
		});
		table="orders";
		sql="SELECT id FROM nft."+table+" WHERE hash='"+s[0][0]+"' AND is_valid=1 LIMIT 1;";
		//logger.info(sql);
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
						logger.info("NFT ownership (order) cannot invalidated -> " + err);
					}
					else
					{
						logger.info("NFT ownership (order) successfully invalidated.");
					}
				});
			}
			else
			{
				logger.info("NFT ownership (order) already invalidated.");
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
				logger.info(post);
			}
			catch (err)
			{
				logger.error(err)
			}
			var now=new Date(); 
			var datetime=now.getHours()+':'+now.getMinutes()+':'+now.getSeconds(); 
			logger.info(datetime + " " + req.url);
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
				logger.info("Checking NFT order exist -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
				con.query("SELECT * FROM nft.orders WHERE token_id='"+post.proof.tokenId+"' AND nft_id="+post.proof.nftId+" AND is_valid=1", function (err, result, fields)
				{
					if (err) throw err;
					if (result.length>0)
					{
						logger.info("NFT order exist.");
						logger.info("Verifying NFT proof -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
						let hex=Buffer.from(post.proof.sig).toString('hex');
						let proof={nftId:parseInt(post.proof.nftId),tokenId:post.proof.tokenId.toString(),sig:Buffer.from(hex,'hex')};
						wallet.VerifyNftProof(post.proof.tokenId.toString(),parseInt(post.proof.nftId),proof).then((retval) =>
						{
							logger.info(retval);
							if (retval.result)
							{
								logger.info("NFT ownership verified -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
								logger.info("Cancelling NFT order -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
								con.query("UPDATE nft.orders SET is_valid=0 WHERE token_id='"+post.proof.tokenId.toString()+"' AND nft_id="+post.proof.nftId+" AND is_valid=1", async function (err, result, fields)
								{
									if (err) throw err;
									logger.info("NFT order cancelled -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
									let obj={status:"success",message:"NFT sell order successfully cancelled."};
									sendResponse(res, 200,JSON.stringify(obj));
								});
							}
						});
					}
					else
					{
						logger.info("NFT sell order doest not exist.");
						let obj={status:"nft_sell_order_does_not_exist",message:"NFT sell order does not exist."};
						sendResponse(res, 200,JSON.stringify(obj));
					}
				});
			}
			else if (req.url=="/CreateSellNftOrder")
			{
				let token_id=post.order.receive[0].tokenId;
				let nft_id=post.order.receive[0].tokenNftId;
				logger.info(post.proof);
				logger.info(post.order);
				logger.info(token_id);
				logger.info(nft_id);
				let hex=Buffer.from(post.proof.sig).toString('hex');
				let proof={nftId:parseInt(post.proof.nftId),tokenId:post.proof.tokenId.toString(),sig:Buffer.from(hex,'hex')};
				logger.info("Verifying Order...");
				logger.info(post.order);
				wallet.VerifyOrder(post.order).then((result) =>
				{
					logger.info("Verify order result -> " + result);
				})
				.catch((e) =>
				{
					logger.info("Error while verifying order");
					logger.info(e);
					logger.info(e.stack);
				});
				logger.info("Verifying NFT -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
				wallet.VerifyNftProof(post.proof.tokenId.toString(),parseInt(post.proof.nftId),proof).then((retval) =>
				{
					logger.info(retval);
					if (retval.result)
					{
						logger.info("NFT ownership verified -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
						logger.info("Fetching NFT collection metadata -> " + post.proof.tokenId);
						create_nft_collection(post.proof.tokenId);
						logger.info("Fetching NFT metadata -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
						wallet.GetNftInfo(post.proof.tokenId.toString(),parseInt(post.proof.nftId)).then((nftinfo) =>
						{
							logger.info(nftinfo);
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
									//logger.info(sql);
									con.query(sql,[JSON.stringify(nftinfo)], async function (err, result)
									{
										if (err)
										{
											let obj={status:"failed",message:"Database error.",order:post.order};
											logger.info(obj);
											logger.info("NFT sell order record not added -> " + err);
										}
										else
										{
											logger.info("NFT sell order record added to database.");
											logger.info("Subscribing nft sell order -> " + retval.txid + "->" + retval.nout);
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
									logger.info(obj);
									sendResponse(res, 200,JSON.stringify(obj));
								}
							});
						});
					}
					else
					{
						logger.info("NFT ownership verification failed -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
						let obj={status:"failed",proof:post.proof};
						sendResponse(res, 200,JSON.stringify(obj));
					}
				});
			}
			else if (req.url=="/CreateNftProof")
			{
				logger.info("Verifying NFT Ownership Proof -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
				let hex=Buffer.from(post.proof.sig).toString('hex');
				let proof={nftId:parseInt(post.proof.nftId),tokenId:post.proof.tokenId.toString(),sig:Buffer.from(hex,'hex')};
				wallet.VerifyNftProof(post.proof.tokenId.toString(),parseInt(post.proof.nftId),proof).then((retval) =>
				{
					logger.info(retval);
					if (retval.result)
					{
						logger.info("NFT ownership verified -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
						create_nft_collection(post.proof.tokenId);
						create_nft(post.proof.tokenId,post.proof.nftId);
						con.query("SELECT * FROM nft.proofs WHERE project_id='"+post.project_id+"' AND link_code='"+post.link_code+"' AND private_address='"+post.private_address+"' AND token_id='"+post.proof.tokenId.toString()+"' AND nft_id='"+post.proof.nftId+"' AND hash='"+retval.txid+"' AND nout="+retval.nout+"", function (err, result, fields)
						{
							if (err) throw err;
							if (result.length==0)
							{
								let sql = `INSERT INTO nft.proofs(
								    id,
								    project_id,
								    link_code,
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
								    '`+post.link_code+`',
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
										logger.info("NFT ownership record not added -> " + err);
									}
									else
									{
										logger.info("NFT ownership record added to database.");
										logger.info("Subscribing nft proof -> " + retval.txid + "->" + retval.nout);
										let currentStatus = await client.blockchain_outpoint_subscribe(retval.txid,retval.nout);
										verifyStatus([[retval.txid, retval.nout], currentStatus]);
										let obj={status:"verified",proof:post.proof};
										logger.info(sendResponse(res, 200,JSON.stringify(obj)));
									}
								});
							}
							else
							{
								logger.info("This NFT already verified.");
								let obj={status:"already_verified",proof:post.proof};
								logger.info(obj);
								sendResponse(res, 200,JSON.stringify(obj));
							}
						});
					}
					else
					{
						logger.info("NFT ownership verification failed -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
						let obj={status:"failed",proof:post.proof};
						sendResponse(res, 200,JSON.stringify(obj));
					}
				}).
				catch((e) =>
				{
					logger.info("Error while verifying nft proof");
					logger.info(e);
				});
			}
			else if (req.url=="/CheckQR")
			{
				logger.info("Checking QR code -> " + post.code);
				let arr=[];
				try
				{
					let sql="SELECT proofs.token_id,proofs.nft_id,collections.name,nfts.metadata FROM nft.proofs INNER JOIN nft.collections ON proofs.token_id=collections.token_id INNER JOIN nft.nfts ON proofs.token_id=nfts.token_id AND proofs.nft_id=nfts.nft_id WHERE proofs.link_code='"+post.code + "'";
					con.query(sql, async function (err, result, fields)
					{
						if (err) throw err;
						logger.info("Result length-> " + result.length);
						if (result.length<1)
						{
							logger.info("No NFT found...");
							let obj={status:"success",message:"No NFT found...",nfts:arr};
							sendResponse(res, 200,JSON.stringify(obj));
						}
						else
						{
							for (let e of result)
							{
								metadata=JSON.parse(e.metadata);
								arr.push(
								{
									token_id:e.token_id,
									nft_id:e.nft_id,
									collection_name:e.name,
									name:(metadata.name?metadata.name:null),
									family_id:(metadata.attributes.family_id?metadata.attributes.family_id:null),
									description:(metadata.description?metadata.description:null),
									nft_category:(metadata.category?metadata.category:null),
									nft_sub_category:(metadata.sub_category?metadata.sub_category:null),
									image:(metadata.image?metadata.image:null),
								});
							}
							let obj={status:"success",message:"Success",nfts:arr};
							sendResponse(res, 200,JSON.stringify(obj));
						}
					});
					logger.info(arr);
				}
				catch(e)
				{
					let obj={status:"failed",message:"Failed"};
					sendResponse(res, 200,JSON.stringify(obj));
				}
			}
			else
			{
				let obj={status:"failed",message:"Unsupported request URL"};
				sendResponse(res, 200,JSON.stringify(obj));
			}
		});
	});

	const verifyStatus = (s) => 
	{
		logger.info("Verifying status...");
		if (s[1] && s[1].spender_txhash)
		{
			invalidateProof(s);
		}
	}
	client.subscribe.on("blockchain.outpoint.subscribe", verifyStatus);

	function create_nft_collection(token_id)
	{
		logger.info("Checking NFT collection...");
		con.query("SELECT token_id FROM nft.collections WHERE token_id='"+token_id+"' LIMIT 1", async function (err, result, fields)
		{
			if (err) throw err;
			logger.info("Result length-> " + result.length);
			if (result.length<1)
			{
				logger.info("Fetching NFT collection data...");
				wallet.GetTokenInfo(token_id).then((token_info) =>
				{
					logger.info(token_info);
					logger.info("Creating NFT collection...");
					con.query("INSERT INTO nft.collections SET token_id='"+token_id+"',name='"+token_info.name+"',supply="+token_info.supply+",version="+token_info.version+",metadata=?",[token_info.code], async function (err, result, fields)
					{
						if (err) throw err;
						logger.info("NFT collection created...");
					});
				});
			}
			else
			{
				logger.info("NFT Collection already exist...");
			}
		});
	}


	function create_nft(token_id,nft_id)
	{
		logger.info("Checking NFT...");
		con.query("SELECT token_id,nft_id FROM nft.nfts WHERE token_id='"+token_id+"' AND nft_id='"+nft_id+"' LIMIT 1", async function (err, result, fields)
		{
			if (err) throw err;
			logger.info("Result length-> " + result.length);
			if (result.length<1)
			{
				logger.info("Fetching NFT data...");
				wallet.GetNftInfo(token_id,nft_id).then((nft_info) =>
				{
					logger.info(nft_info);
					logger.info("Creating NFT...");
					con.query("INSERT INTO nft.nfts SET token_id='"+token_id+"',nft_id="+nft_id+",metadata=?",[nft_info.metadata], async function (err, result, fields)
					{
						if (err) throw err;
						logger.info("NFT created...");
					});
				});
			}
			else
			{
				logger.info("NFT already exist...");
			}
		});
	}
	function subscribe_nfts()
	{
		logger.info("Subscribing for verified nfts...");
		con.query("SELECT hash,nout FROM nft.proofs WHERE is_valid=1", async function (err, result, fields)
		{
			if (err) throw err;
			for (let e of result)
			{
				logger.info("Subscribing for nft proof -> " + e.hash + "->" + e.nout);
				let currentStatus = await client.blockchain_outpoint_subscribe(e.hash,parseInt(e.nout));
				verifyStatus([[e.hash, parseInt(e.nout)], currentStatus]);
			}
		});
		logger.info("Subscribing for nft sell orders...");
		con.query("SELECT hash,nout FROM nft.orders WHERE is_valid=1", async function (err, result, fields)
		{
			if (err) throw err;
			for (let e of result)
			{
				logger.info("Subscribing nft sell order -> " + e.hash + "->" + e.nout);
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
		logger.error(err)
	}
	server.listen(argv.p || 3000);
	process.on('uncaughtException', function(err)
	{
		logger.error('Caught exception: ' + err);
	});
	logger.info('Server running on port ' + (argv.p || 3000))
}
main();