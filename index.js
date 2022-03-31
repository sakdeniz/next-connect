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
		console.log("Connected to MySQL!");
	});
	function invalidateProof(s)
	{
		console.log("NFT Moved");
		console.log("Old hash -> " + s[0][0]);
		console.log("New hash -> " + s[1].spender_txhash);
		let sql = "UPDATE `nft`.`proofs` SET `invalidated_date`=NOW(),`new_hash`='"+s[1].spender_txhash+"',`is_valid` = '0' WHERE `proofs`.`hash`='"+s[0][0]+"';";
		con.query(sql, function (err, result)
		{
			if (err)
			{
				console.log("NFT ownership cannot invalidated -> " + err);
			}
			else
			{
				console.log("NFT ownership successfully invalidated.");
			}
		});
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
						let sql = `INSERT INTO nft.proofs(
						    id,
						    private_address,
						    tokenid,
						    nft_id,
						    hash,
						    nout,
						    new_hash,
						    verification_date,
						    is_valid
						)
						VALUES(
						    NULL,
						    '`+post.proof.privateAddress+`',
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
							}
						});
					}
					else
					{
						console.log("NFT ownership verification failed -> " + post.proof.tokenId + "(" + post.proof.nftId + ")");
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
			invalidateProof(s);
		}
	}
	client.subscribe.on("blockchain.outpoint.subscribe", verifyStatus);

	function subscribe_nfts()
	{
		con.query("SELECT * FROM nft.proofs", async function (err, result, fields)
		{
			if (err) throw err;
			for (let e of result)
			{
				console.log("Subscribing -> " + e.hash + "->" + e.nout);
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