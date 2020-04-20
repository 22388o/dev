import fs from "fs";
import "colors";

import { Wallet, Signer } from "ethers";
import { BigNumber } from "ethers/utils";
import { task, usePlugin, BuidlerConfig, types } from "@nomiclabs/buidler/config";
import { NetworkConfig } from "@nomiclabs/buidler/types";

import { deployAndSetupContracts, setSilent } from "./test/utils/deploy";
import { Liquity, Trove } from "./src/Liquity";
import { Decimal, Difference, Decimalish, Percent } from "./utils";
import { CDPManagerFactory } from "./types/ethers/CDPManagerFactory";
import { PoolManagerFactory } from "./types/ethers/PoolManagerFactory";
// import { PriceFeedFactory } from "./types/ethers/PriceFeedFactory";
// import { NameRegistryFactory } from "./types/ethers/NameRegistryFactory";
import { addressesOf, addressesOnNetwork } from "./src/contracts";

usePlugin("@nomiclabs/buidler-web3");
usePlugin("@nomiclabs/buidler-truffle5");
usePlugin("@nomiclabs/buidler-waffle");

const generateRandomAccounts = (numberOfAccounts: number) => {
  const accounts = new Array<string>(numberOfAccounts);

  for (let i = 0; i < numberOfAccounts; ++i) {
    accounts[i] = Wallet.createRandom().privateKey;
  }

  return accounts;
};

const deployerAccount = "0x543ab4105a87fa14619bad9b85b6e989412b2f30380a3f36f49b9327b5967fb1";
const devChainRichAccount = "0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7";

const infuraApiKey = "ad9cef41c9c844a7b54d10be24d416e5";

const infuraNetwork = (name: string): { [name: string]: NetworkConfig } => ({
  [name]: {
    url: `https://${name}.infura.io/v3/${infuraApiKey}`,
    accounts: [deployerAccount]
  }
});

const config: BuidlerConfig = {
  defaultNetwork: "buidlerevm",
  networks: {
    dev: {
      url: "http://localhost:8545",
      accounts: [deployerAccount, devChainRichAccount, ...generateRandomAccounts(40)]
    },
    ...infuraNetwork("ropsten"),
    ...infuraNetwork("rinkeby"),
    ...infuraNetwork("goerli"),
    ...infuraNetwork("kovan")
  },
  paths: {
    artifacts: "../contracts/artifacts",
    cache: "../contracts/cache"
  }
};

task("deploy", "Deploys the contracts to the network", async (_taskArgs, bre) => {
  const [deployer] = await bre.ethers.signers();

  setSilent(false);
  const contracts = await deployAndSetupContracts(bre.web3, bre.artifacts, deployer);

  console.log();
  console.log(addressesOf(contracts));
  console.log();
});

type SetPriceFeedParams = { priceFeedAddress: string };

task("set-pricefeed", "Set the address of the PriceFeed in the deployed contracts")
  .addPositionalParam("priceFeedAddress", "Address of new PriceFeed", undefined, types.string)
  .setAction(async ({ priceFeedAddress }: SetPriceFeedParams, bre) => {
    const [deployer] = await bre.ethers.signers();
    const addresses = addressesOnNetwork[bre.network.name];

    // const priceFeed = PriceFeedFactory.connect(addresses.priceFeed, deployer);
    const cdpManager = CDPManagerFactory.connect(addresses.cdpManager, deployer);
    const poolManager = PoolManagerFactory.connect(addresses.poolManager, deployer);
    // const nameRegistry = NameRegistryFactory.connect(addresses.nameRegistry, deployer);

    // await priceFeed.setCDPManagerAddress(cdpManager.address);
    await cdpManager.setPriceFeed(priceFeedAddress);
    await poolManager.setPriceFeed(priceFeedAddress);
    // await nameRegistry.updateAddress("PriceFeed", priceFeed.address);
  });

task(
  "deploy-warzone",
  "Deploys the contracts to the network then creates lots of Troves",
  // TODO: for some reason Buidler can't seem to handle much more than 40 accounts with an external
  // network, so this task must be called repeatedly (e.g. in an infinite loop) to actually create
  // many Troves.
  async (_taskArgs, bre) => {
    const [deployer, funder, ...randomUsers] = await bre.ethers.signers();
    const addresses =
      addressesOnNetwork[bre.network.name] ||
      addressesOf(await deployAndSetupContracts(bre.web3, bre.artifacts, deployer));

    const deployerLiquity = await Liquity.connect(addresses.cdpManager, deployer);

    const price = await deployerLiquity.getPrice();
    const priceAsNumber = parseFloat(price.toString(4));

    let i = 0;
    for (const user of randomUsers) {
      const userAddress = await user.getAddress();
      const collateral = 999 * Math.random() + 1;
      const debt = (priceAsNumber * collateral) / (3 * Math.random() + 1.11);

      const liquity = await Liquity.connect(addresses.cdpManager, user);

      await funder.sendTransaction({
        to: userAddress,
        value: Decimal.from(collateral).bigNumber
      });

      await liquity.openTrove(new Trove({ collateral, debt }), price);
      if (i % 4 === 0) {
        await liquity.depositQuiInStabilityPool(debt);
      }

      if (++i % 10 === 0) {
        console.log(`Created ${i} Troves.`);
      }

      await new Promise(resolve => setTimeout(resolve, 4000));
    }
  }
);

const getListOfTroves = async (liquity: Liquity) => {
  let list: string[] = [];
  let current = await liquity._getFirstTroveAddress();

  while (current) {
    list.push(current);
    current = await liquity._getNextTroveAddress(current);
  }

  return list;
};

const tinyDifference = Decimal.from("0.000000001");

const sortedByICR = async (liquity: Liquity, listOfTroves: string[], price: Decimalish) => {
  if (listOfTroves.length < 2) {
    return true;
  }

  let currentTrove = await liquity.getTrove(listOfTroves[0]);

  for (let i = 1; i < listOfTroves.length; ++i) {
    const nextTrove = await liquity.getTrove(listOfTroves[i]);

    if (
      nextTrove
        .collateralRatioAfterRewards(price)
        .gt(currentTrove.collateralRatioAfterRewards(price).add(tinyDifference))
    ) {
      return false;
    }

    currentTrove = nextTrove;
  }

  return true;
};

const listDifference = (listA: string[], listB: string[]) => {
  const setB = new Set(listB);
  return listA.filter(x => !setB.has(x));
};

const shortenAddress = (address: string) => address.substr(0, 6) + "..." + address.substr(-4);

const troveToString = (address: string, trove: Trove, price: Decimalish) => {
  return (
    `[${shortenAddress(address)}]: ` +
    `ICR = ${new Percent(trove.collateralRatioAfterRewards(price)).toString(2)}, ` +
    `ICR w/o reward = ${new Percent(trove.collateralRatio(price)).toString(2)}, ` +
    `stake = ${trove._stake?.toString(2)}, ` +
    `coll = ${trove.collateral.toString(2)}, ` +
    `debt = ${trove.debt.toString(2)}, ` +
    `coll reward = ${trove.pendingCollateralReward.toString(2)}, ` +
    `debt reward = ${trove.pendingDebtReward.toString(2)}`
  );
};

const dumpTroves = async (liquity: Liquity, listOfTroves: string[], price: Decimalish) => {
  if (listOfTroves.length === 0) {
    return;
  }

  let currentTrove = await liquity.getTrove(listOfTroves[0]);
  console.log(`   ${troveToString(listOfTroves[0], currentTrove, price)}`);

  for (let i = 1; i < listOfTroves.length; ++i) {
    const nextTrove = await liquity.getTrove(listOfTroves[i]);

    if (
      nextTrove
        .collateralRatioAfterRewards(price)
        .gt(currentTrove.collateralRatioAfterRewards(price))
    ) {
      console.log(`!! ${troveToString(listOfTroves[i], nextTrove, price)}`.red);
    } else {
      console.log(`   ${troveToString(listOfTroves[i], nextTrove, price)}`);
    }

    currentTrove = nextTrove;
  }
};

task(
  "chaos",
  "Chaotically interact with the system and monitor pool errors",
  async (_taskArgs, bre) => {
    const benford = (max: number) => Math.floor(Math.exp(Math.log(max) * Math.random()));

    const truncateLastDigits = (n: number) => {
      if (n > 100000) {
        return 1000 * Math.floor(n / 1000);
      } else if (n > 10000) {
        return 100 * Math.floor(n / 100);
      } else if (n > 1000) {
        return 10 * Math.floor(n / 10);
      } else {
        return n;
      }
    };

    const connectUsers = (users: Signer[]) =>
      Promise.all(users.map(user => Liquity.connect(addresses.cdpManager, user)));

    const [deployer, funder, ...randomUsers] = await bre.ethers.signers();

    const addresses =
      addressesOnNetwork[bre.network.name] ||
      addressesOf(await deployAndSetupContracts(bre.web3, bre.artifacts, deployer));

    const [deployerLiquity, funderLiquity, ...randomLiquities] = await connectUsers([
      deployer,
      funder,
      ...randomUsers
    ]);

    let price = await deployerLiquity.getPrice();

    let funderTrove = await funderLiquity.getTrove();
    if (funderTrove.isEmpty) {
      await funderLiquity.openTrove(new Trove({ collateral: 10000, debt: 1000000 }), price);
    }

    let totalNumberOfLiquidations = 0;

    for (let i = 1; i <= 25; ++i) {
      console.log();
      console.log(`// Round #${i}`);

      price = price.add(100 * Math.random() + 150).div(2);
      console.log(`[deployer] setPrice(${price})`);
      await deployerLiquity.setPrice(price);
      price = await deployerLiquity.getPrice();

      const trovesBefore = await getListOfTroves(deployerLiquity);
      //const numberOfTrovesBefore = (await deployerLiquity.getNumberOfTroves()).toNumber();

      console.log(`[deployer] liquidateUpTo(30)`);
      await deployerLiquity.liquidateUpTo(30); // Anything higher may run out of gas

      const trovesAfter = await getListOfTroves(deployerLiquity);
      const liquidatedTroves = listDifference(trovesBefore, trovesAfter);
      // const numberOfTrovesAfter = (await deployerLiquity.getNumberOfTroves()).toNumber();

      if (liquidatedTroves.length > 0) {
        totalNumberOfLiquidations += liquidatedTroves.length;
        for (const liquidatedTrove of liquidatedTroves) {
          console.log(`// Liquidated ${shortenAddress(liquidatedTrove)}`);
        }
      }
      // if (numberOfTrovesAfter < numberOfTrovesBefore) {
      //   const numberOfLiquidations = numberOfTrovesBefore - numberOfTrovesAfter;
      //   totalNumberOfLiquidations += numberOfLiquidations;
      //   console.log(`// Liquidated ${numberOfLiquidations} Trove(s)`);
      // }

      for (const liquity of randomLiquities) {
        if (Math.random() < 0.5) {
          const trove = await liquity.getTrove();
          let total = await liquity.getTotal();

          if (trove.isEmpty) {
            let newTrove: Trove;

            do {
              let collateral: Decimal, debt: Decimal;
              let randomValue = truncateLastDigits(benford(1000));

              if (Math.random() < 0.5) {
                collateral = Decimal.from(randomValue);

                const maxDebt = parseInt(
                  price
                    .mul(collateral)
                    .div(1.1)
                    .toString(0)
                );

                debt = Decimal.from(truncateLastDigits(maxDebt - benford(maxDebt)));
              } else {
                debt = Decimal.from(100 * randomValue);
                collateral = Decimal.from(
                  debt
                    .div(price)
                    .mul(10 + benford(20))
                    .div(10)
                    .toString(1)
                );
              }

              newTrove = new Trove({ collateral, debt });
            } while (newTrove.collateralRatioIsBelowMinimum(price));

            while (total.add(newTrove).collateralRatioIsBelowCritical(price)) {
              // Would fail to open the Trove due to TCR
              newTrove = new Trove({
                collateral: newTrove.collateral.mul(2),
                debt: newTrove.debt
              });
            }

            await funder.sendTransaction({
              to: liquity.userAddress,
              value: newTrove.collateral.bigNumber
            });

            console.log(
              `[${shortenAddress(liquity.userAddress!)}] openTrove({ ` +
                `collateral: ${newTrove.collateral}, ` +
                `debt: ${newTrove.debt} })`
            );

            await liquity.openTrove(newTrove, price);
          } else {
            while (total.subtract(trove).collateralRatioIsBelowCritical(price)) {
              // Would fail to close Trove due to TCR
              const funderTrove = await funderLiquity.getTrove();
              await funderLiquity.depositEther(funderTrove, benford(50000), price);

              total = await liquity.getTotal();
            }

            await funderLiquity.sendQui(liquity.userAddress!, trove.debtAfterReward);

            console.log(`[${shortenAddress(liquity.userAddress!)}] closeTrove()`);
            await liquity.closeTrove();
          }
        } else {
          const exchangedQui = benford(5000);

          await funderLiquity.sendQui(liquity.userAddress!, exchangedQui);

          console.log(`[${shortenAddress(liquity.userAddress!)}] redeemCollateral(${exchangedQui})`);
          await liquity.redeemCollateral(exchangedQui, price);
        }

        const quiBalance = await liquity.getQuiBalance();
        await liquity.sendQui(funderLiquity.userAddress!, quiBalance);

        // const listOfTroves = await getListOfTroves(deployerLiquity);
        // if (!(await sortedByICR(deployerLiquity, listOfTroves, price))) {
        //   console.log();
        //   console.log("// List of Troves:");
        //   await dumpTroves(deployerLiquity, listOfTroves, price);
        //   throw new Error("last operation broke sorting");
        // }
      }
    }

    const total = await funderLiquity.getTotal();
    const numberOfTroves = await funderLiquity.getNumberOfTroves();

    console.log();
    console.log(`Number of Troves: ${numberOfTroves}`);
    console.log(`Total collateral: ${total.collateralAfterReward}`);

    fs.appendFileSync(
      "chaos.csv",
      `${numberOfTroves},${totalNumberOfLiquidations},${total.collateralAfterReward}\n`
    );
  }
);

task(
  "order",
  "End chaos and restore order by liquidating every Trove except the Funder's",
  async (_taskArgs, bre) => {
    const connectUsers = (users: Signer[]) =>
      Promise.all(users.map(user => Liquity.connect(addresses.cdpManager, user)));

    const [deployer, funder] = await bre.ethers.signers();

    const addresses =
      addressesOnNetwork[bre.network.name] ||
      addressesOf(await deployAndSetupContracts(bre.web3, bre.artifacts, deployer));

    const [deployerLiquity, funderLiquity] = await connectUsers([deployer, funder]);

    const priceBefore = await deployerLiquity.getPrice();

    if ((await funderLiquity._getFirstTroveAddress()) !== funderLiquity.userAddress) {
      let funderTrove = await funderLiquity.getTrove();

      if (funderTrove.debtAfterReward.isZero) {
        await funderLiquity.borrowQui(funderTrove, 1, priceBefore);
        funderTrove = await funderLiquity.getTrove();
      }

      await funderLiquity.repayQui(funderTrove, funderTrove.debtAfterReward, priceBefore);
    }

    if ((await funderLiquity._getFirstTroveAddress()) !== funderLiquity.userAddress) {
      throw new Error("didn't manage to hoist Funder's Trove to head of SortedCDPs");
    }

    await deployerLiquity.setPrice(0.001);

    const initialNumberOfTroves = await funderLiquity.getNumberOfTroves();

    let numberOfTroves: BigNumber;
    while ((numberOfTroves = await funderLiquity.getNumberOfTroves()).gt(1)) {
      const numberOfTrovesToLiquidate = numberOfTroves.gt(10) ? 10 : numberOfTroves.sub(1);

      console.log(`${numberOfTroves} Troves left.`);
      await funderLiquity.liquidateUpTo(numberOfTrovesToLiquidate);
    }

    await deployerLiquity.setPrice(priceBefore);

    if (!(await funderLiquity.getNumberOfTroves()).eq(1)) {
      throw new Error("didn't manage to liquidate every Trove");
    }

    const funderTrove = await funderLiquity.getTrove();
    const total = await funderLiquity.getTotal();

    const collateralDifference = Difference.between(
      total.collateralAfterReward,
      funderTrove.collateralAfterReward
    );
    const debtDifference = Difference.between(total.debtAfterReward, funderTrove.debtAfterReward);

    console.log();
    console.log("Discrepancies:");
    console.log(`Collateral: ${collateralDifference}`);
    console.log(`Debt: ${debtDifference}`);

    fs.appendFileSync(
      "chaos.csv",
      `${numberOfTroves},` +
        `${initialNumberOfTroves.sub(1)},` +
        `${total.collateralAfterReward},` +
        `${collateralDifference.absoluteValue?.bigNumber},` +
        `${debtDifference.absoluteValue?.bigNumber}\n`
    );
  }
);

task("check-sorting", "Check if Troves are sorted by ICR", async (_taskArgs, bre) => {
  const [deployer] = await bre.ethers.signers();

  const addresses =
    addressesOnNetwork[bre.network.name] ||
    addressesOf(await deployAndSetupContracts(bre.web3, bre.artifacts, deployer));

  const deployerLiquity = await Liquity.connect(addresses.cdpManager, deployer);

  const price = await deployerLiquity.getPrice();

  const listOfTroves = await getListOfTroves(deployerLiquity);
  if (!(await sortedByICR(deployerLiquity, listOfTroves, price))) {
    await dumpTroves(deployerLiquity, listOfTroves, price);
    throw new Error("not all Troves are sorted");
  }

  console.log("All Troves are sorted.");
});

export default config;