import Web3 from 'web3'
const provider = new Web3.providers.HttpProvider("http://localhost:7545")
const web3 = new Web3(provider)

var mydata = require("../env.json");
const { abi } = require("./build/contracts/HitAndSunk.json")
const contractAddress = mydata.contractAddress


const HitAndSunkContract = web3 =>
{
    console.log(abi);
    return new web3.eth.Contract(abi, contractAddress)
}

export default HitAndSunkContract
