const { ethers } = require('ethers');
const { swapGETHForMETH, swapMETHForGETH, getAmountsOut } = require('./router');
const Web3 = require('web3');
require('dotenv').config();
console.log('my_address:', process.env.MY_ADDRESS);

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.RPC_URL));
const web3_ws = new Web3(new Web3.providers.WebsocketProvider(process.env.RPC_URL.replace('https', 'wss')));

const targetAddress = '0x0A9f824C05A74F577A536A8A0c673183a872Dff4';

// 監視済みトランザクションのハッシュを格納するSet
const watchedTransactions = new Set();

// ================================================================================================
let amountsOutPromise = null; // getAmountsOut の結果を保持する Promise オブジェクト

// getAmountsOut を定期実行する関数
async function periodicallyGetAmountsOut(amountIn) {
  while (true) {
    try {
      const amountsOut = await getAmountsOut(amountIn);
      amountsOutPromise = Promise.resolve(amountsOut); // 結果を Promise オブジェクトに変換
      await sleep(5000); // 5秒待機してから再度実行
    } catch (error) {
      console.error('Error:', error);
      await sleep(5000); // エラーが発生した場合も一定時間待機してから再度実行
    }
  }
}

async function sandwich(amountIn, maxPriorityFeePerGas, maxFeePerGas) {
    try {
      const maxPriorityFeePerGasSmall = ethers.BigNumber.from(maxPriorityFeePerGas).sub(1).toString();
      const maxPriorityFeePerGasLarge = ethers.BigNumber.from(maxPriorityFeePerGas).add(1).toString();
      const maxFeePerGasSmall = ethers.BigNumber.from(maxFeePerGas).sub(1).toString();
      const maxFeePerGasLarge = ethers.BigNumber.from(maxFeePerGas).add(1).toString();

      console.log('maxFeePerGasSmall:', maxFeePerGasSmall);
      console.log('maxFeePerGasLarge:', maxFeePerGasLarge);
      console.log('maxPriorityFeePerGasSmall:', maxPriorityFeePerGasSmall);
      console.log('maxPriorityFeePerGasLarge:', maxPriorityFeePerGasLarge);
      
      const amountOutPromise = amountsOutPromise || getAmountsOut(amountIn);
      const [amountOut, nonce] = await Promise.all([
        amountOutPromise,
        web3.eth.getTransactionCount(process.env.MY_ADDRESS)
      ]);
  
      const amountInMax = amountOut.mul(110).div(100);

      const [tx1, tx2] = await Promise.all([
          swapGETHForMETH(amountIn, amountOut, maxPriorityFeePerGasLarge, maxFeePerGasLarge, nonce),
          swapMETHForGETH(amountIn, amountInMax, maxPriorityFeePerGasSmall, maxFeePerGasSmall, nonce + 1)
        ]);
  
      console.log('Transaction 1:', tx1.hash);
      console.log('Transaction 2:', tx2.hash);
    } catch (error) {
      console.error('Error:', error);
    }
  }

// ================================================================================================

// 未承認トランザクションの監視用の関数
function watchPendingTransactions() {
    web3_ws.eth.subscribe('pendingTransactions', (error, transactionHash) => {
        if (!error) {
            web3.eth.getTransaction(transactionHash).then(tx => {
                if (!tx) {
                    // console.log('トランザクションが見つかりません:', transactionHash);
                    return;
                }
                try {
                    if (
                        tx.to &&
                        tx.to.toLowerCase() === targetAddress.toLowerCase() &&
                        !watchedTransactions.has(tx.hash) &&
                        web3.utils.fromWei(tx.value, 'ether') > 500
                    ) {
                        const method_id = tx.input.slice(0, 10);
                        if (method_id === '0xae30f6ee') {
                            console.log('target:', tx.hash);
                            console.log('value:', web3.utils.fromWei(tx.value, 'ether'), 'ETH');
                            console.log('<===  SWAP_AND_BRIDGE  ===>');
                            const amountIn = web3.utils.toWei('100', 'ether');
                            sandwich(
                                amountIn,
                                tx.maxPriorityFeePerGas,              
                                tx.maxFeePerGas,
                            );
                        }
                        // else {
                        //     // console.log('<===  BRIDGE  ===>');
                        //     // console.log('maxFeePerGas: ', tx.maxFeePerGas);
                        //     // console.log('maxPriorityFeePerGas: ', tx.maxPriorityFeePerGas);
                        // }
                        console.log('');
                        watchedTransactions.add(tx.hash);
                    }
                } catch (error) {
                    console.error('未承認トランザクションの監視中にエラーが発生しました:', error);
                    console.log(tx.hash);
                }
            });
        } else {
            console.error(error);
        }
    });
}

// WebSocketを使って未承認トランザクションの監視を開始
watchPendingTransactions();

// 監視を開始するために、プログラムを実行します
console.log('未承認トランザクションの監視を開始します...');