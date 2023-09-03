const HitAndSunk = artifacts.require("../contracts/HitAndSunk.sol");

module.exports = function (instance)
{
    instance.deploy(HitAndSunk);
};
