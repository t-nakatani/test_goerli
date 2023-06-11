const { ethers } = require('ethers');
const fs = require('fs');
require('dotenv').config();

// ABIファイルのパス
const abiFilePath = './uniRouter.json';

// ABIファイルを読み込む関数
function loadABI() {
  try {
    const abiData = fs.readFileSync(abiFilePath, 'utf8');
    return JSON.parse(abiData);
  } catch (error) {
    console.error('Error loading ABI:', error);
    return null;
  }
}
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const signer = wallet.connect(provider);

// Uniswap V2ルーターアドレスとABI
const METHAddress = '0xdD69DB25F6D620A7baD3023c5d32761D353D3De9'; // METH
const WETHAddress = '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6'; // WETH
const routerAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'; // Uniswap V2ルーターアドレス
// const routerAbi = [
//     "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
//     "function swapExactETHForTokens(uint256, address[], address, uint256) external payable returns (uint256[])",
// ];
const routerAbi = loadABI();

// ルーターコントラクトのインスタンスを作成
const routerContract = new ethers.Contract(routerAddress, routerAbi, provider);

async function getAmountsOut(amountIn) {
  const path = [WETHAddress, METHAddress];
    try {
        const amountOut = await routerContract.getAmountsOut(amountIn, path);
        return amountOut[1];
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

async function swapGETHForMETH(amountIn, amountOutMin, maxPriorityFeePerGas, maxFeePerGas, nonce) {
    try {
        const overrides = {
            value: amountIn,
            gasLimit: 500000,
            maxPriorityFeePerGas: maxPriorityFeePerGas,
            maxFeePerGas: maxFeePerGas,
            nonce: nonce
        };
        const deadline = Math.floor(Date.now() / 1000) + 60 * 1.5; // トランザクションの有効期限（90秒後）
        const targetAddress = process.env.MY_ADDRESS;
        const path = [WETHAddress, METHAddress];
        const tx = await routerContract.connect(signer).swapExactETHForTokens(
            amountOutMin,
            path,
            targetAddress,
            deadline,
            overrides,
        );
        return tx;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

async function swapMETHForGETH(amountInMax, amountOut, maxPriorityFeePerGas, maxFeePerGas, nonce) {
  try {
    const overrides = {
      value: 0, // 0に設定することでETHではなくMETHを送信することを示します
      gasLimit: 500000,
      maxPriorityFeePerGas: maxPriorityFeePerGas,
      maxFeePerGas: maxFeePerGas,
      nonce: nonce
    };
    const deadline = Math.floor(Date.now() / 1000) + 60 * 1.5; // トランザクションの有効期限（90秒後）
    const targetAddress = process.env.MY_ADDRESS;
    const path = [METHAddress, WETHAddress]; // METHをWETHに変換するためのパス
    const tx = await routerContract.connect(signer).swapTokensForExactETH(
      amountOut,
      amountInMax,
      path,
      targetAddress,
      deadline,
      overrides
    );
    return tx; // トランザクションオブジェクトを返す
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

module.exports = { swapGETHForMETH, swapMETHForGETH, getAmountsOut };
