const FloatifyAccount = artifacts.require('FloatifyAccount');

// eslint-disable-next-line func-names
module.exports = function (deployer) {
  // These commented out lines are left for reference
  // deployer.deploy(ConvertLib);
  // deployer.link(ConvertLib, FloatifyAccount);
  deployer.deploy(FloatifyAccount);
};
