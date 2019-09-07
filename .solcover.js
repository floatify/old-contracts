const secrets = require('./secrets.json');

const infuraKey = secrets.infuraProjectId;

module.exports = {
  port: 8545,
  testrpcOptions: `-d -f https://mainnet.infura.io/v3/${infuraKey} -u "0x27949ccaf1ef209e8f2334205bf25bb05dbb8350"`,
  norpc: false,
  // dir: './secretDirectory',
  // copyPackages: ['openzeppelin-solidity'],
  // skipFiles: ['Routers/EtherRouter.sol']
  // Source for below settings: https://github.com/sc-forks/solidity-coverage/blob/master/docs/faq.md#running-truffle-as-a-local-dependency
  compileCommand: '../node_modules/.bin/truffle compile',
  testCommand: '../node_modules/.bin/truffle test --network coverage',
};