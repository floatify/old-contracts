# Floatify Contracts

- [Floatify Contracts](#floatify-contracts)
  - [Getting Started](#getting-started)
    - [Install JavaScript dependencies](#install-javascript-dependencies)
    - [Setup Web3](#setup-web3)
    - [Setup Security Analyses](#setup-security-analyses)
  - [Run Tests](#run-tests)
  - [Run Code Coverage](#run-code-coverage)
  - [Run Security Analysis](#run-security-analysis)
    - [MythX](#mythx)
    - [Trail of Bits Tools](#trail-of-bits-tools)

## Getting Started

### Install JavaScript dependencies

```text
yarn install
```

### Setup Web3

Create a file called `secrets.json` that looks like this:

```json
{
  "infuraProjectId": "",
}
```

Fill in your Infura Project ID. If you'd also like to use this project to deploy with Truffle, add
your mnemonic to this file and update `truffle-config.js` accordingly. Make sure not to commit
`secrets.json` to a repository.

### Setup Security Analyses

Install Trail of Bits' Ethereum Security toolbox with
`docker pull trailofbits/eth-security-toolbox`. This is about a 15GB image so will take some time
to download. If you don't have Docker installed, find instructions for your operating system
[here](https://mattsolomon.dev/docker).

## Run Tests

1. Start a node that forks the mainnet by running

```text
ganache-cli -d -f https://mainnet.infura.io/v3/yourInfuraProjectId -u "0x27949ccaf1ef209e8f2334205bf25bb05dbb8350"
```

2. Run tests with `npm run test`

## Run Code Coverage

A code coverage report can be generated with
[solidity-coverage](https://github.com/sc-forks/solidity-coverage). This can be generated
by running `npm run coverage`. Please be patient as this can take quite a while.

## Run Security Analysis

### MythX

MythX will run in trial mode by default, which you may use. Alternatively, follow the
steps [here](https://docs.mythx.io/en/latest/tools/truffle/index.html#accounts-and-access)
for instructions on how to set up a full account.

Afterwards, run the tests using `truffle run verify contracts/FloatifyAccount.sol`

### Trail of Bits Tools

Start the Docker container and bind mount to a local directory with:

```text
docker run -it -v $(pwd)/contracts:/share trailofbits/eth-security-toolbox
```

This will open a prompt where you can now run Trail of Bit's security tools

```text
cd /share # this is so outputs from printers show up in our contracts folder
solc-select 0.5.8 # use the solc version required by this contract

# You can now run any valid command from their suite of tools. For example
slither FloatifyAccount.sol
```
