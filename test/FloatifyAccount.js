
// =================================================================================================
//                                       SETUP TESTING TOOLS
// =================================================================================================
const BigNumber = require('bignumber.js'); // easier to work with than web3's big number library
const chai = require('chai');
const {
  BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');

const { expect } = chai;


// =================================================================================================
//                                     SETUP CONTRACTS AND VARIABLES
// =================================================================================================
const FloatifyAccount = artifacts.require('FloatifyAccount');

// Configure details for interacting with Dai
const daiABI = require('../externalAbis/DAI.json').abi; // the ABI of DAI contract
const cdaiABI = require('../externalAbis/cDAI.json').abi; // the ABI of DAI contract

const daiAddress = '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359'; // address of DAI contract
const cdaiAddress = '0xF5DCe57282A584D2746FaF1593d3121Fcac444dC'; // address of cDAI contract
const wyreAddress = '0x27949Ccaf1ef209e8F2334205BF25bB05DBb8350'; // random address to get DAI from

// Instantiate contract instances
const DaiContract = new web3.eth.Contract(daiABI, daiAddress);
const CdaiContract = new web3.eth.Contract(cdaiABI, cdaiAddress);

// Define variables we need. Values are assigned in the global beforeEach() hook
let FloatifyInstance; // instance of FloatifyAccount contract
let floatifyAddress; // address of FloatifyInstance
let initialDaiDepositHuman; // amount of Dai, as a human-readable number
let initialDaiDepositMachine; // amount of Dai, as a machine-readable number for Solidity calls
const maxUint256Value = '115792089237316195423570985008687907853269984665640564039457584007913129639935';


// =================================================================================================
//                                    DEFINE HELPER FUNCTIONS
// =================================================================================================
/**
 * @notice Convert human-readable values into values required for Solidity calls. Only for Ether
 * and other tokens that use 18 decimal places
 * @param {string} token Token to convert value for
 * @param {number, string, BigNumber} value Number to convert
 * @returns {string} output value to use in Solidity calls
 */
function humanToMachine(token, value) {
  const x = new BigNumber(value);
  switch (token.toLowerCase()) {
    case 'dai': return x.multipliedBy('1e18').toString();
    case 'cdai': return x.multipliedBy('1e8').toString();
    default: throw Error('Invalid token specified');
  }
}


/**
 * @notice Convert machine values from Solidity into human-readable values. Only for Ether
 * and other tokens that use 18 decimal places
 * @param {string} token Token to convert value for
 * @param {number, string, BigNumber} value Number to convert
 * @returns {string} output value to use in Solidity calls
 */
function machineToHuman(token, value) {
  const x = new BigNumber(value);
  switch (token.toLowerCase()) {
    case 'dai': return x.dividedBy('1e18').toNumber();
    case 'cdai': return x.dividedBy('1e8').toNumber();
    default: throw Error('Invalid token specified');
  }
}


/**
 * Get DAI or cDAI balance of a given contract
 * @param {token} string 'DAI' or 'cDAI'
 * @param {string} address account address to get balance of
 * @returns {number} human-readable balance
 */
async function getTokenBalance(token, address) {
  let balance;
  switch (token.toLowerCase()) {
    case 'dai':
      balance = await DaiContract.methods.balanceOf(address).call();
      return machineToHuman(token, balance);
    case 'cdai':
      balance = await CdaiContract.methods.balanceOf(address).call();
      return machineToHuman(token, balance);
    default:
      throw Error('Invalid token specified');
  }
}


/**
 * Mine blocks to accrue interest
 * @param {number} amount number of blocks to mine
 */
async function mineBlocks(amount) {
  const originalBlockNumber = await web3.eth.getBlockNumber();
  // eslint-disable-next-line no-await-in-loop
  for (let i = 0; i < amount; i += 1) await time.advanceBlock();
  const newBlockNumber = await web3.eth.getBlockNumber();
  expect(newBlockNumber + amount).to.be.above(originalBlockNumber);
}


beforeEach('Setup deployed contract', async () => {
  // Get instance of deployed contract
  FloatifyInstance = await FloatifyAccount.deployed();
  floatifyAddress = await FloatifyAccount.address;
  // Define the amount of DAI that will be used throughout
  initialDaiDepositHuman = 100; // amount of DAI to initialize contract with
  initialDaiDepositMachine = humanToMachine('DAI', initialDaiDepositHuman);
});


contract('FloatifyAccount', (accounts) => {
  // Configure accounts we need
  const ownerDeployAddress = accounts[0]; // account used by server to deploy contract
  const ownerReceiveAddress = accounts[1]; // account where our profits are sent
  const userPersonalAddress = accounts[2]; // a user's personal Ethereum account
  const userWyreAddress = accounts[3]; // address generated by Wyre to convert DAI to USD
  const randomNonUserAddress = accounts[4]; // address of a random user or attacker
  console.log(`Owner deploy address: ${ownerDeployAddress}`);
  console.log(`Owner receive address: ${ownerReceiveAddress}`);
  console.log(`User personal address: ${userPersonalAddress}`);
  console.log(`User Wyre address: ${userWyreAddress}`);
  console.log(`Random user address: ${randomNonUserAddress}`);
  console.log(`Wyre address: ${wyreAddress}`);

  contract('Access control tests', () => {
    it('should properly set owner on deployment', async () => {
      console.log(`Floatify contract address: ${floatifyAddress}`);
      const contractOwner = await FloatifyInstance.owner();
      expect(ownerDeployAddress).to.equal(contractOwner);
    });


    it('should let the owner be changed to the user', async () => {
      await FloatifyInstance.transferOwnership(userPersonalAddress, { from: ownerDeployAddress });
      expect(userPersonalAddress).to.equal(await FloatifyInstance.owner());
      // change owner back for any future tests in this test suite
      await FloatifyInstance.transferOwnership(ownerDeployAddress, { from: userPersonalAddress });
      expect(ownerDeployAddress).to.equal(await FloatifyInstance.owner());
    });


    it('should only let the owner call `deposit()`', async () => {
      await expectRevert(
        FloatifyInstance.deposit({ from: randomNonUserAddress }),
        'Ownable: caller is not the owner',
      );
    });

    it('should only let the owner call `redeemAndWithdrawMax()`', async () => {
      await expectRevert(
        FloatifyInstance.redeemAndWithdrawMax(userWyreAddress, { from: randomNonUserAddress }),
        'Ownable: caller is not the owner',
      );
    });


    it('should only let the owner call `redeemAndWithdrawPartial()`', async () => {
      const daiAmountMachine = humanToMachine('dai', 1);
      await expectRevert(
        FloatifyInstance.redeemAndWithdrawPartial(
          userWyreAddress, daiAmountMachine, { from: randomNonUserAddress },
        ),
        'Ownable: caller is not the owner',
      );
    });


    it('should only let the owner call `withdraw()`', async () => {
      await expectRevert(
        FloatifyInstance.withdraw(userWyreAddress, { from: randomNonUserAddress }),
        'Ownable: caller is not the owner',
      );
    });
  }); // end access control tests


  contract('Invariants', () => {
    it('should give cDAI contract an allowance of 2**256-1 to spend our Dai', async () => {
      const cdaiAllowance = await DaiContract.methods.allowance(floatifyAddress, cdaiAddress).call();
      expect(cdaiAllowance).to.equal(maxUint256Value);
    });


    it('should have initial DAI and cDAI token balances of 0', async () => {
      // Ensure both tokens start at zero value
      const contractDaiBalance = await getTokenBalance('DAI', floatifyAddress);
      const contractCdaiBalance = await getTokenBalance('cDAI', floatifyAddress);
      expect(contractDaiBalance).to.equal(0);
      expect(contractCdaiBalance).to.equal(0);
    });
  }); // end invariants


  contract('Basic deposit functionality', () => {
    beforeEach('Send DAI to Floatify contract', async () => {
      // Send DAI to the contract
      await DaiContract.methods.transfer(floatifyAddress, initialDaiDepositMachine).send({
        from: wyreAddress,
      });

      // At this point, we should have some DAI
      const contractDaiBalance = await getTokenBalance('DAI', floatifyAddress);
      expect(contractDaiBalance).to.equal(initialDaiDepositHuman);
    });


    it('should deposit all its DAI in Compound when owner calls `deposit()` function', async () => {
      // Make sure we start with more than 0 DAI
      const initialDaiBalance = await getTokenBalance('DAI', floatifyAddress);
      expect(initialDaiBalance).to.be.above(0);

      // Now we need to call the cDAI mint function. This transfers our DAI to the cDAI contract,
      // and gives us cDAI
      await FloatifyInstance.deposit({ from: ownerDeployAddress });

      // At this point, we should have no DAI and some cDAI
      // cDAI exchange rate starts at 0.02 and grows, so we'll just loosely check the quantity to
      // ensure it's greater than the amount of DAI
      const newContractDaiBalance = await getTokenBalance('DAI', floatifyAddress);
      const newContractCdaiBalance = await getTokenBalance('cDAI', floatifyAddress);
      expect(newContractDaiBalance).to.equal(0);
      expect(newContractCdaiBalance).to.be.above(initialDaiDepositHuman);
    });
  }); // end deposit functionality


  contract('Basic withdrawal functionality', () => {
    it('should redeem all cDAI and send DAI to an account when owner calls `redeemAndWithdrawMax()`', async () => {
      // Need to check two things:
      //    1. That the user's Wyre address receives more than it deposited
      //    2. That the contract's DAI and cDAI balance are both zero

      // Send DAI to contract
      await DaiContract.methods.transfer(floatifyAddress, initialDaiDepositMachine).send({ from: wyreAddress });

      // Check that initial conditions are correct
      const initialUserDaiBalance = await getTokenBalance('DAI', userWyreAddress);
      const initialFloatifyDaiBalance = await getTokenBalance('DAI', floatifyAddress);
      const initialFloatifyCdaiBalance = await getTokenBalance('cDAI', floatifyAddress);

      expect(initialUserDaiBalance).to.equal(0);
      expect(initialFloatifyDaiBalance).to.equal(initialDaiDepositHuman);
      expect(initialFloatifyCdaiBalance).to.equal(0);

      // Deposit and get cDAI, then mine blocks
      await FloatifyInstance.deposit({ from: ownerDeployAddress });
      await mineBlocks(25);

      // Redeem all funds
      await FloatifyInstance.redeemAndWithdrawMax(userWyreAddress, { from: ownerDeployAddress });
      const finalUserDaiBalance = await getTokenBalance('DAI', userWyreAddress);
      const finalFloatifyDaiBalance = await getTokenBalance('DAI', floatifyAddress);
      const finalFloatifyCdaiBalance = await getTokenBalance('cDAI', floatifyAddress);

      expect(finalUserDaiBalance).to.be.above(initialDaiDepositHuman);
      expect(finalUserDaiBalance).to.be.below(initialDaiDepositHuman * 1.1); // loose check of exchange rate
      expect(finalFloatifyDaiBalance).to.equal(0); // sent everything to user
      expect(finalFloatifyCdaiBalance).to.equal(0); // sent everything to user
    });


    it('should let all DAI be withdrawn without depositing it in Compound', async () => {
      // Manually clear existing balances and make sure we are starting at 0
      const daiBalance = await DaiContract.methods.balanceOf(userWyreAddress).call();
      await DaiContract.methods.transfer(constants.ZERO_ADDRESS, daiBalance).send({ from: userWyreAddress });
      expect(await getTokenBalance('DAI', userWyreAddress)).to.equal(0);
      expect(await getTokenBalance('DAI', floatifyAddress)).to.equal(0);

      // Now the contract needs some DAI
      await DaiContract.methods.transfer(floatifyAddress, initialDaiDepositMachine).send({ from: wyreAddress });

      // Withdraw to user's Wyre address and check that it succeeded
      await FloatifyInstance.withdraw(userWyreAddress, { from: ownerDeployAddress });
      const finalFloatifyDaiBalance = await getTokenBalance('DAI', floatifyAddress);
      const finalUserBalanceMachine = await DaiContract.methods.balanceOf(userWyreAddress).call();

      expect(finalUserBalanceMachine).to.equal(initialDaiDepositMachine);
      expect(finalFloatifyDaiBalance).to.equal(0);
    });
  }); // end withdraw functionality


  contract('Additional deposit and withdrawal functionality', async () => {
    it('should allow consecutive deposits then a full withdraw', async () => {
      // Make sure all initial balances are 0
      expect(await getTokenBalance('DAI', userWyreAddress)).to.equal(0);
      expect(await getTokenBalance('DAI', floatifyAddress)).to.equal(0);
      expect(await getTokenBalance('cDAI', floatifyAddress)).to.equal(0);

      // Send DAI, deposit it, wait a few blocks, repeat
      await DaiContract.methods.transfer(floatifyAddress, initialDaiDepositMachine).send({ from: wyreAddress });
      await FloatifyInstance.deposit({ from: ownerDeployAddress });
      await mineBlocks(10);
      await DaiContract.methods.transfer(floatifyAddress, initialDaiDepositMachine).send({ from: wyreAddress });
      await FloatifyInstance.deposit({ from: ownerDeployAddress });
      await mineBlocks(10);

      // Make sure we now only have cDAI in our contract
      expect(await getTokenBalance('DAI', userWyreAddress)).to.equal(0);
      expect(await getTokenBalance('DAI', floatifyAddress)).to.equal(0);
      expect(await getTokenBalance('cDAI', floatifyAddress)).to.be.above(2 * initialDaiDepositHuman);

      // Withdraw to user's Wyre address
      await FloatifyInstance.redeemAndWithdrawMax(userWyreAddress, { from: ownerDeployAddress });
      expect(await getTokenBalance('DAI', userWyreAddress)).to.be.above(2 * initialDaiDepositHuman);
      expect(await getTokenBalance('DAI', userWyreAddress)).to.be.below(2 * initialDaiDepositHuman * 1.1);
      expect(await getTokenBalance('DAI', floatifyAddress)).to.equal(0);
      expect(await getTokenBalance('cDAI', floatifyAddress)).to.equal(0);
    });


    it('should allow partial withdraws', async () => {
      // Manually clear out all existing balances
      const daiBalance = await DaiContract.methods.balanceOf(userWyreAddress).call();
      await DaiContract.methods.transfer(constants.ZERO_ADDRESS, daiBalance).send({ from: userWyreAddress });
      const cdaiBalance = await CdaiContract.methods.balanceOf(userWyreAddress).call();
      await CdaiContract.methods.transfer(constants.ZERO_ADDRESS, cdaiBalance).send({ from: userWyreAddress });

      // Ensure balances are now 0
      expect(await getTokenBalance('DAI', userWyreAddress)).to.equal(0);
      expect(await getTokenBalance('DAI', floatifyAddress)).to.equal(0);
      expect(await getTokenBalance('cDAI', floatifyAddress)).to.equal(0);

      // Send and deposit DAI
      await DaiContract.methods.transfer(floatifyAddress, initialDaiDepositMachine).send({ from: wyreAddress });
      await FloatifyInstance.deposit({ from: ownerDeployAddress });
      const initialFloatifyCdaiBalance = await getTokenBalance('cDAI', floatifyAddress);

      // Execute a partial withdraw
      const daiToWithdrawHuman = initialDaiDepositHuman / 2;
      const daiToWithdrawMachine = humanToMachine('DAI', daiToWithdrawHuman);
      await FloatifyInstance.redeemAndWithdrawPartial(
        userWyreAddress, daiToWithdrawMachine, { from: ownerDeployAddress },
      );
      const finalUserDaiBalance = await getTokenBalance('DAI', userWyreAddress);
      const finalFloatifyCdaiBalance = await getTokenBalance('cDAI', floatifyAddress);
      expect(finalUserDaiBalance).to.equal(daiToWithdrawHuman);
      expect(finalFloatifyCdaiBalance).to.be.above(0);
      expect(finalFloatifyCdaiBalance).to.be.below(initialFloatifyCdaiBalance);
    });
  }); // end additional deposit and withdraw functionality


  contract('Event tests', async () => {
    it('should emit Deposit event on successful deposits', async () => {
      await DaiContract.methods.transfer(floatifyAddress, initialDaiDepositMachine).send({ from: wyreAddress });
      const { logs } = await FloatifyInstance.deposit({ from: ownerDeployAddress });
      await expectEvent.inLogs(logs, 'Deposit', { daiAmount: initialDaiDepositMachine });
    });


    it('should emit RedeemMax and Withdraw on `redeemAndWithdrawMax()`', async () => {
      // Withdraw the funds deposited in the previous test
      // const floatifyCdaiBalance = await CdaiContract.methods.balanceOf(floatifyAddress).call();
      const { logs } = await FloatifyInstance.redeemAndWithdrawMax(
        userWyreAddress, { from: ownerDeployAddress },
      );
      const userDaiBalance = await DaiContract.methods.balanceOf(userWyreAddress).call();

      // TODO add check of emitted cDAI balance
      await expectEvent.inLogs(logs, 'RedeemMax', { daiAmount: userDaiBalance });
      await expectEvent.inLogs(logs, 'Withdraw', { destinationAddress: userWyreAddress, daiAmount: userDaiBalance });
    });


    it('should emit RedeemPartial and Withdraw on `redeemAndWithdrawPartial()`', async () => {
      // Contract is now empty from previous test to send and deposit new funds
      await DaiContract.methods.transfer(floatifyAddress, initialDaiDepositMachine).send({ from: wyreAddress });
      await FloatifyInstance.deposit({ from: ownerDeployAddress });

      const daiToWithdrawHuman = initialDaiDepositHuman / 2;
      const daiToWithdrawMachine = humanToMachine('DAI', daiToWithdrawHuman);
      const { logs } = await FloatifyInstance.redeemAndWithdrawPartial(
        userWyreAddress, daiToWithdrawMachine, { from: ownerDeployAddress },
      );

      // TODO add check of emitted cDAI balance
      await expectEvent.inLogs(logs, 'RedeemPartial', { daiAmount: daiToWithdrawMachine });
      await expectEvent.inLogs(logs, 'Withdraw', {
        destinationAddress: userWyreAddress, daiAmount: daiToWithdrawMachine,
      });
    });
  }); // end event tests


  contract('State tracking tests', async () => {
    it('should not track DAI deposits and withdraws that were not used to mint cDAI', async () => {
      // Initial balances stored in contract should be 0
      expect(await FloatifyInstance.totalDeposited()).to.be.bignumber.equal('0');
      expect(await FloatifyInstance.totalWithdrawn()).to.be.bignumber.equal('0');
      // Send DAI to contract and ensure balances remain 0
      await DaiContract.methods.transfer(floatifyAddress, initialDaiDepositMachine).send({ from: wyreAddress });
      expect(await FloatifyInstance.totalDeposited()).to.be.bignumber.equal('0');
      expect(await FloatifyInstance.totalWithdrawn()).to.be.bignumber.equal('0');
      // Withdraw the DAI and ensure they're still 0
      await FloatifyInstance.withdraw(constants.ZERO_ADDRESS, { from: ownerDeployAddress });
      expect(await FloatifyInstance.totalDeposited()).to.be.bignumber.equal('0');
      expect(await FloatifyInstance.totalWithdrawn()).to.be.bignumber.equal('0');
    });


    it('should keep track of all DAI deposits that were used to mint cDAI', async () => {
      // Balance from previous test should have been reset to 0 due to the withdraw() call
      expect(await FloatifyInstance.totalDeposited()).to.be.bignumber.equal('0');
      expect(await FloatifyInstance.totalWithdrawn()).to.be.bignumber.equal('0');
      // Receive and deposit DAI, confirm that deposit total increases
      await DaiContract.methods.transfer(floatifyAddress, initialDaiDepositMachine).send({ from: wyreAddress });
      await FloatifyInstance.deposit({ from: ownerDeployAddress });
      expect(await FloatifyInstance.totalDeposited()).to.be.bignumber.equal(initialDaiDepositMachine);
    });


    it('should keep track of partial withdrawals of DAI that were used to mint cDAI', async () => {
      // Redeem some DAI that was deposited in previous test, confirm that withdraw total increases
      const partialDaiWithdrawAmtMachine = humanToMachine('DAI', initialDaiDepositHuman / 4);
      await FloatifyInstance.redeemAndWithdrawPartial(
        userWyreAddress, partialDaiWithdrawAmtMachine, { from: ownerDeployAddress },
      );
      expect(await FloatifyInstance.totalWithdrawn()).to.be.bignumber.equal(partialDaiWithdrawAmtMachine);
    });

    it('should keep track of max withdrawals of DAI that were used to mint cDAI', async () => {
      // Redeem remaining DAI left after partial withdrawal and ensure total increases
      await FloatifyInstance.redeemAndWithdrawMax(userWyreAddress, { from: ownerDeployAddress });
      expect(await FloatifyInstance.totalWithdrawn()).to.be.bignumber.above(initialDaiDepositMachine);
    });
  }); // end tests about tracking state
});
