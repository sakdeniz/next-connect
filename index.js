const ElectrumClient = require('@aguycalled/electrum-client-js')

async function main() {
  const client = new ElectrumClient(
    'electrum-testnet.nav.community',
    40004,
    'wss'
  )

  const verifyStatus = (s) => 
  { if (s[1] && s[1].spender_txhash)
  	{
  		invalidateProof(s[0][0], s[0][1]);
  		console.log("moved");
		console.log(s);
  	}
  }
  client.subscribe.on(
        "blockchain.outpoint.subscribe", verifyStatus);

  try {
    await client.connect(
      'electrum-client-js', // optional client name
      '1.5' // optional protocol version
    )
    let txid="2c1d20fe60d6ab296a28e7db9d00efa2b6a3b7df40c270b5bc16be4dd58ba7bc";
    let vout="0";
    let currentStatus = await client.blockchain_outpoint_subscribe(
      txid,
      vout
    );
    verifyStatus([[txid, vout], currentStatus]);

    txid="dc3f313cf37175a0073665f5d1eaddd190d2ea08b648f6ea2659687b333ab740";
    vout="1";
    currentStatus = await client.blockchain_outpoint_subscribe(
      txid,
      vout
    );
    verifyStatus([[txid, vout], currentStatus]);

  } catch (err) {
    console.error(err)
  }
}

main();