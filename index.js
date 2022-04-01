var mysql = require('mysql');
var http=require('http');
var server;
var argv=require('minimist')(process.argv.slice(2));
const config={headers: {'Content-Type': 'application/x-www-form-urlencoded'},responseType: 'text'};
const ElectrumClient = require('@aguycalled/electrum-client-js')

	global.window = global;
	const setGlobalVars = require("indexeddbshim");
	setGlobalVars(null, { checkOrigin: false });

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
	var con = mysql.createConnection({
		host: "localhost",
		user: "root",
		password: ""
	});

	con.connect(function(err)
	{
		if (err) throw err;
		console.log("Connected to MySQL server.");
	});
	function invalidateProof(t,s)
	{
		console.log(t);
		let table="";
		if (t=="proof") table="proofs";
		if (t=="order") table="orders";
		console.log("NFT Moved");
		console.log("Old hash -> " + s[0][0]);
		console.log("New hash -> " + s[1].spender_txhash);
		let sql="SELECT id FROM nft."+table+" WHERE hash='"+s[0][0]+"' AND is_valid=1 LIMIT 1;";
		console.log(sql);
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
						console.log("NFT ownership ("+t+")cannot invalidated -> " + err);
					}
					else
					{
						console.log("NFT ownership ("+t+") successfully invalidated.");
					}
				});
			}
			else
			{
				console.log("NFT ownership ("+t+") already invalidated.");
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
			var post=body?JSON.parse(body) : {}
			var now=new Date(); 
			var datetime=now.getHours()+':'+now.getMinutes()+':'+now.getSeconds(); 
			console.log(datetime + " " + req.url);
			if (req.url=="/GetSellOrders")
			{
				con.query("SELECT * FROM nft.orders WHERE is_valid=1", async function (err, result, fields)
				{
					if (err) throw err;
					let obj={status:"success",orders:result};
					sendResponse(res, 200,JSON.stringify(obj))
				});
			}
			if (req.url=="/CreateSellNftOrder")
			{
				let token_id=post.order.receive[0].tokenId;
				let nft_id=post.order.receive[0].tokenNftId;
				console.log(post.proof);
				console.log(post.order);
				console.log(token_id);
				console.log(nft_id);
				console.log("Verifying NFT -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
				let hex=Buffer.from(post.proof.sig).toString('hex');
				let proof={nftId:parseInt(post.proof.nftId),tokenId:post.proof.tokenId.toString(),sig:Buffer.from(hex,'hex')};
				wallet.VerifyNftProof(post.proof.tokenId.toString(),parseInt(post.proof.nftId),proof).then((retval) =>
				{
					console.log(retval);
					if (retval.result)
					{
						console.log("NFT ownership verified -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
						con.query("SELECT * FROM nft.orders WHERE token_id='"+token_id+"' AND nft_id='"+nft_id+"' AND is_valid=1", function (err, result, fields)
						{
							if (err) throw err;
							if (result.length==0)
							{
								let sql = `INSERT INTO nft.orders(
								    id,
								    token_id,
								    nft_id,
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
								    '`+retval.txid+`',
								    '`+retval.nout+`',
								    '`+JSON.stringify(post.order)+`',
								    NOW(),
								    '1'
								);`;
								console.log(sql);
								con.query(sql, function (err, result)
								{
									if (err)
									{
										let obj={status:"failed",order:post.order};
										console.log(obj);
										console.log("NFT sell order record not added -> " + err);
									}
									else
									{
										console.log("NFT sell order record added to database.");
										let obj={status:"order_created",proof:post.proof};
										sendResponse(res, 200,JSON.stringify(obj));
									}
								});
							}
							else
							{
								let obj={status:"failed",order:post.order};
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
				});
			}
			if (req.url=="/proof")
			{
				console.log("Proof");
				console.log(post.proof);
				console.log("Result");
				console.log(post.result);
				//
				console.log("Verifying NFT -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
				let hex=Buffer.from(post.proof.sig).toString('hex');
				let proof={nftId:parseInt(post.proof.nftId),tokenId:post.proof.tokenId.toString(),sig:Buffer.from(hex,'hex')};
				wallet.VerifyNftProof(post.proof.tokenId.toString(),parseInt(post.proof.nftId),proof).then((retval) =>
				{
					console.log(retval);
					if (retval.result)
					{
						console.log("NFT ownership verified -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
						con.query("SELECT * FROM nft.proofs WHERE project_id='"+post.project_id+"' AND private_address='"+post.private_address+"' AND token_id='"+post.proof.tokenId.toString()+"' AND nft_id='"+post.proof.nftId+"' AND hash='"+post.result.txid+"'", function (err, result, fields)
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
								    '`+post.result.txid+`',
								    '`+post.result.nout+`',
								    NULL,
								    NOW(),
								    '1'
								);`;
								con.query(sql, function (err, result)
								{
									if (err)
									{
										console.log("NFT ownership record not added -> " + err);
									}
									else
									{
										console.log("NFT ownership record added to database.");
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
		});
	});

	const verifyStatus = (s) => 
	{
		if (s[1] && s[1].spender_txhash)
		{
			invalidateProof("proof",s);
		}
	}
	const verifyOrderStatus = (s) => 
	{
		if (s[1] && s[1].spender_txhash)
		{
			invalidateProof("order",s);
		}
	}
	client.subscribe.on("blockchain.outpoint.subscribe", verifyStatus);

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
				verifyOrderStatus([[e.hash, parseInt(e.nout)], currentStatus]);
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