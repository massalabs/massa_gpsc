import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { WalletClient } from '@massalabs/massa-sc-deployer';
import {
  Args,
  fromMAS,
  MAX_GAS_DEPLOYMENT,
  CHAIN_ID,
  EOperationStatus,
  IEvent,
  ClientFactory,
  DefaultProviderUrls,
} from '@massalabs/massa-web3';
import {
  deploySc,
  getEnv,
  getScAddressFromEvents,
  waitForEvents,
} from './utils';
import assert from 'node:assert';
import { installSmartContract, proxyCall } from './proxyUtils';

// Obtain the current file name and directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));

// Load .env file content into process.env
dotenv.config();

const publicApi = getEnv('JSON_RPC_URL_PUBLIC');
const secretKey = getEnv('WALLET_SECRET_KEY');
const secretKey2 = getEnv('WALLET_SECRET_KEY_2');
// Define deployment parameters
const chainId = CHAIN_ID.BuildNet; // Choose the chain ID corresponding to the network you want to deploy to
const traceEvents = true;

const deployerAccount = await WalletClient.getAccountFromSecretKey(secretKey);
let client = await ClientFactory.createDefaultClient(
  publicApi as DefaultProviderUrls,
  chainId,
  false,
  deployerAccount,
);

let ownerWasm = path.join(__dirname, 'build', 'owner.wasm');
console.log(`ownerWasm path: ${ownerWasm}`);
let operationId1 = await deploySc(
  publicApi,
  deployerAccount,
  chainId,
  ownerWasm,
  fromMAS(0.1),
  new Args(),
);
console.log(`operationId (deploy): ${operationId1}`);
let [opStatus1, events1] = await waitForEvents(client, operationId1, true);
if (traceEvents) {
  console.log('events:');
  console.log(events1);
}
assert.equal(opStatus1, EOperationStatus.FINAL_SUCCESS);
let detectAddr = getScAddressFromEvents(events1);
console.log(`detect proxy smart contract address:`, detectAddr);

let proxyWasm = path.join(__dirname, 'build', 'proxySlow.wasm');
console.log(`proxySlow.wasm path: ${proxyWasm}`);
let operationId2 = await deploySc(
  publicApi,
  deployerAccount,
  chainId,
  proxyWasm,
  fromMAS(2),
  new Args(),
);
console.log(`operationId (deploy proxy): ${operationId2}`);
let [opStatus2, events2] = await waitForEvents(client, operationId2, true);
if (traceEvents) {
  console.log('events:');
  console.log(events2);
}
assert.equal(opStatus2, EOperationStatus.FINAL_SUCCESS);
let proxyAddr = getScAddressFromEvents(events2);
console.log(`proxyMain smart contract address: ${proxyAddr}`);
// let proxyCallerAddr = getProxyCallerAddressFromEvents(events2);
// console.log(`proxy caller smart contract address: ${proxyCallerAddr}`);

let operationId3 = await installSmartContract(client, proxyAddr, detectAddr);
console.log(`operationId (install smart contract): ${operationId3}`);
let [opStatus3, events3] = await waitForEvents(client, operationId3, true);
if (traceEvents) {
  console.log('events:');
  console.log(events3);
}
assert.equal(opStatus3, EOperationStatus.FINAL_SUCCESS);

let operationId4 = await proxyCall(client, proxyAddr, 'msg', new Args());
console.log(`operationId (client proxyCall msg()): ${operationId4}`);
let [opStatus4, events4] = await waitForEvents(client, operationId4, true);
if (traceEvents) {
  console.log('events:');
  console.log(events4);
}
assert.equal(opStatus4, EOperationStatus.FINAL_SUCCESS);

// Setup another account
const deployerAccount2 = await WalletClient.getAccountFromSecretKey(secretKey2);
let client2 = await ClientFactory.createDefaultClient(
  publicApi as DefaultProviderUrls,
  chainId,
  false,
  deployerAccount2,
);

// let operationId5 = await proxyCall(client2, proxyAddr, 'msg', new Args());
// console.log(`operationId (client2 proxyCall msg()): ${operationId5}`);
// let [opStatus5, events5] = await waitForEvents(client2, operationId5, true);
// if (traceEvents) {
//     console.log('events:');
//     console.log(events5);
// }
// assert.equal(opStatus5, EOperationStatus.FINAL_ERROR);
//
// const lastEvent = events5[events5.length - 1];
// assert.equal(lastEvent.data.includes('Caller is not the owner'), true);

let operationId6 = await proxyCall(client, proxyAddr, 'ownerMsg', new Args());
console.log(`operationId (proxyCall ownerMsg()): ${operationId6}`);
let [opStatus6, events6] = await waitForEvents(client, operationId6, true);
if (traceEvents) {
  console.log('events:');
  console.log(events6);
}
assert.equal(opStatus6, EOperationStatus.FINAL_SUCCESS);

const lastEvent2 = events6[events6.length - 1];
assert.equal(lastEvent2.data, 'Owner msg');
