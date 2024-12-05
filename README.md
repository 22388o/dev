## SUSD 
This is the repository for the SUSD smart contract.

## Deployment to a Development Blockchain

The Hardhat migrations script and deployment helpers in `utils/deploymentHelpers.js` deploy all contracts, and connect all contracts to their dependency contracts, by setting the necessary deployed addresses.

The project is deployed on the Ropsten testnet.

## Running Tests

Run all tests with `npx hardhat test`, or run a specific test with `npx hardhat test ./test/contractTest.js`

Tests are run against the Hardhat EVM.

### Brownie Tests
There are some special tests that are using Brownie framework.

To test, install brownie with:
```
python3 -m pip install --user pipx
python3 -m pipx ensurepath

pipx install eth-brownie
```

and add numpy with:
```
pipx inject eth-brownie numpy
```

Add OpenZeppelin package:
```
brownie pm install OpenZeppelin/openzeppelin-contracts@3.3.0
```

Run, from `packages/contracts/`:
```
brownie test -s
```

### OpenEthereum

Add the local node as a `live` network at `~/.brownie/network-config.yaml`:
```
(...)
      - name: Local Openethereum
        chainid: 17
        id: openethereum
        host: http://localhost:8545
```

Make sure state is cleaned up first:
```
rm -Rf build/deployments/*
```

Start Openthereum node from this repo’s root with:
```
yarn start-dev-chain:openethereum
```

Then, again from `packages/contracts/`, run it with:
```
brownie test -s --network openethereum
```

To stop the Openethereum node, you can do it with:
```
yarn stop-dev-chain
```

### Coverage

To check test coverage you can run:
```
yarn coverage
```

You can see the coverage status at mainnet deployment [here](https://codecov.io/gh/liquity/dev/tree/8f52f2906f99414c0b1c3a84c95c74c319b7a8c6).

![Impacted file tree graph](https://codecov.io/gh/liquity/dev/pull/707/graphs/tree.svg?width=650&height=150&src=pr&token=7AJPQ3TW0O&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=liquity)

There’s also a [pull request](https://github.com/liquity/dev/pull/515) to increase the coverage, but it hasn’t been merged yet because it modifies some smart contracts (mostly removing unnecessary checks).

### Prerequisites

You'll need to install the following:

- [Git](https://help.github.com/en/github/getting-started-with-github/set-up-git) (of course)
- [Node v16.x](https://nodejs.org/dist/latest-v16.x/)
- [Docker](https://docs.docker.com/get-docker/)
- [Yarn](https://classic.yarnpkg.com/en/docs/install)

#### Making node-gyp work

Liquity indirectly depends on some packages with native addons. To make sure these can be built, you'll have to take some additional steps. Refer to the subsection of [Installation](https://github.com/nodejs/node-gyp#installation) in node-gyp's README that corresponds to your operating system.

Note: you can skip the manual installation of node-gyp itself (`npm install -g node-gyp`), but you will need to install its prerequisites to make sure Liquity can be installed.

### Clone & Install

```
git clone https://github.com/liquity/dev.git liquity
cd liquity
yarn
```

### Top-level scripts

There are a number of scripts in the top-level package.json file to ease development, which you can run with yarn.

#### Run all tests

```
yarn test
```

#### Deploy contracts to a testnet

E.g.:

```
yarn deploy --network ropsten
```

Supported networks are currently: ropsten, kovan, rinkeby, goerli. The above command will deploy into the default channel (the one that's used by the public dev-frontend). To deploy into the internal channel instead:

```
yarn deploy --network ropsten --channel internal
```

You can optionally specify an explicit gas price too:

```
yarn deploy --network ropsten --gas-price 20
```

After a successful deployment, the addresses of the newly deployed contracts will be written to a version-controlled JSON file under `packages/lib-ethers/deployments/default`.

To publish a new deployment, you must execute the above command for all of the following combinations:

| Network | Channel  |
| ------- | -------- |
| ropsten | default  |
| kovan   | default  |
| rinkeby | default  |
| goerli  | default  |

At some point in the future, we will make this process automatic. Once you're done deploying to all the networks, execute the following command:

```
yarn save-live-version
```

This copies the contract artifacts to a version controlled area (`packages/lib/live`) then checks that you really did deploy to all the networks. Next you need to commit and push all changed files. The repo's GitHub workflow will then build a new Docker image of the frontend interfacing with the new addresses.

#### Start a local blockchain and deploy the contracts

```
yarn start-dev-chain
```

Starts an openethereum node in a Docker container, running the [private development chain](https://openethereum.github.io/Private-development-chain), then deploys the contracts to this chain.

You may want to use this before starting the dev-frontend in development mode. To use the newly deployed contracts, switch MetaMask to the built-in "Localhost 8545" network.

> Q: How can I get Ether on the local blockchain?  
> A: Import this private key into MetaMask:  
> `0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7`  
> This account has all the Ether you'll ever need.

Once you no longer need the local node, stop it with:

```
yarn stop-dev-chain
```

#### Start dev-frontend in development mode

```
yarn start-dev-frontend
```

This will start dev-frontend in development mode on http://localhost:3000. The app will automatically be reloaded if you change a source file under `packages/dev-frontend`.

If you make changes to a different package under `packages`, it is recommended to rebuild the entire project with `yarn prepare` in the root directory of the repo. This makes sure that a change in one package doesn't break another.

To stop the dev-frontend running in this mode, bring up the terminal in which you've started the command and press Ctrl+C.

#### Start dev-frontend in demo mode

This will automatically start the local blockchain, so you need to make sure that's not already running before you run the following command.

```
yarn start-demo
```

This spawns a modified version of dev-frontend that ignores MetaMask, and directly uses the local blockchain node. Every time the page is reloaded (at http://localhost:3000), a new random account is created with a balance of 100 ETH. Additionally, transactions are automatically signed, so you no longer need to accept wallet confirmations. This lets you play around with Liquity more freely.

When you no longer need the demo mode, press Ctrl+C in the terminal then run:

```
yarn stop-demo
```

#### Start dev-frontend against a mainnet fork RPC node

This will start a hardhat mainnet forked RPC node at the block number configured in `hardhat.config.mainnet-fork.ts`, so you need to make sure you're not running a hardhat node on port 8545 already.

You'll need an Alchemy API key to create the fork.

```
ALCHEMY_API_KEY=enter_your_key_here yarn start-fork
```

```
yarn start-demo:dev-frontend
```

This spawns a modified version of dev-frontend that automatically signs transactions so you don't need to interact with a browser wallet. It directly uses the local forked RPC node. 

You may need to wait a minute or so for your fork mainnet provider to load and cache all the blockchain state at your chosen block number. Refresh the page after 5 minutes.


#### Build dev-frontend for production

In a freshly cloned & installed monorepo, or if you have only modified code inside the dev-frontend package:

```
yarn build
```

If you have changed something in one or more packages apart from dev-frontend, it's best to use:

```
yarn rebuild
```

This combines the top-level `prepare` and `build` scripts.

You'll find the output in `packages/dev-frontend/build`.

### Configuring your custom frontend

Your custom built frontend can be configured by putting a file named `config.json` inside the same directory as `index.html` built in the previous step. The format of this file is:

```
{
  "frontendTag": "0x2781fD154358b009abf6280db4Ec066FCC6cb435",
  "infuraApiKey": "158b6511a5c74d1ac028a8a2afe8f626"
}
```

## Running a frontend with Docker

The quickest way to get a frontend up and running is to use the [prebuilt image](https://hub.docker.com/r/liquity/dev-frontend) available on Docker Hub.

### Prerequisites

You will need to have [Docker](https://docs.docker.com/get-docker/) installed.

### Running with `docker`

```
docker pull liquity/dev-frontend
docker run --name liquity -d --rm -p 3000:80 liquity/dev-frontend
```

This will start serving your frontend using HTTP on port 3000. If everything went well, you should be able to open http://localhost:3000/ in your browser. To use a different port, just replace 3000 with your desired port number.

To stop the service:

```
docker kill liquity
```

### Configuring a public frontend

If you're planning to publicly host a frontend, you might need to pass the Docker container some extra configuration in the form of environment variables.

#### FRONTEND_TAG

If you want to receive a share of the LQTY rewards earned by users of your frontend, set this variable to the Ethereum address you want the LQTY to be sent to.

#### INFURA_API_KEY

This is an optional parameter. If you'd like your frontend to use Infura's [WebSocket endpoint](https://infura.io/docs/ethereum#section/Websockets) for receiving blockchain events, set this variable to an Infura Project ID.

### Setting a kickback rate

The kickback rate is the portion of LQTY you pass on to users of your frontend. For example with a kickback rate of 80%, you receive 20% while users get the other 80. Before you can start to receive a share of LQTY rewards, you'll need to set this parameter by making a transaction on-chain.

It is highly recommended that you do this while running a frontend locally, before you start hosting it publicly:

```
docker run --name liquity -d --rm -p 3000:80 \
  -e FRONTEND_TAG=0x2781fD154358b009abf6280db4Ec066FCC6cb435 \
  -e INFURA_API_KEY=158b6511a5c74d1ac028a8a2afe8f626 \
  liquity/dev-frontend
```

Remember to replace the environment variables in the above example. After executing this command, open http://localhost:3000/ in a browser with MetaMask installed, then switch MetaMask to the account whose address you specified as FRONTEND_TAG to begin setting the kickback rate.

### Setting a kickback rate with Gnosis Safe

If you are using Gnosis safe, you have to set the kickback rate mannually through contract interaction. On the dashboard of Gnosis safe, click on "New transaction" and pick "Contraction interaction." Then, follow the [instructions](https://help.gnosis-safe.io/en/articles/3738081-contract-interactions): 
- First, set the contract address as ```0x66017D22b0f8556afDd19FC67041899Eb65a21bb ```; 
- Second, for method, choose "registerFrontEnd" from the list; 
- Finally, type in the unit256 _Kickbackrate_. The kickback rate should be an integer representing an 18-digit decimal. So for a kickback rate of 99% (0.99), the value is: ```990000000000000000```. The number is 18 digits long.

### Next steps for hosting a frontend

Now that you've set a kickback rate, you'll need to decide how you want to host your frontend. There are way too many options to list here, so these are going to be just a few examples.

#### Example 1: using static website hosting

A frontend doesn't require any database or server-side computation, so the easiest way to host it is to use a service that lets you upload a folder of static files (HTML, CSS, JS, etc).

To obtain the files you need to upload, you need to extract them from a frontend Docker container. If you were following the guide for setting a kickback rate and haven't stopped the container yet, then you already have one! Otherwise, you can create it with a command like this (remember to use your own `FRONTEND_TAG` and `INFURA_API_KEY`):

```
docker run --name liquity -d --rm \
  -e FRONTEND_TAG=0x2781fD154358b009abf6280db4Ec066FCC6cb435 \
  -e INFURA_API_KEY=158b6511a5c74d1ac028a8a2afe8f626 \
  liquity/dev-frontend
```

While the container is running, use `docker cp` to extract the frontend's files to a folder of your choosing. For example to extract them to a new folder named "devui" inside the current folder, run:

```
docker cp liquity:/usr/share/nginx/html ./devui
```

Upload the contents of this folder to your chosen hosting service (or serve them using your own infrastructure), and you're set!

#### Example 2: wrapping the frontend container in HTTPS

If you have command line access to a server with Docker installed, hosting a frontend from a Docker container is a viable option.

The frontend Docker container simply serves files using plain HTTP, which is susceptible to man-in-the-middle attacks. Therefore it is highly recommended to wrap it in HTTPS using a reverse proxy. You can find an example docker-compose config [here](packages/dev-frontend/docker-compose-example/docker-compose.yml) that secures the frontend using [SWAG (Secure Web Application Gateway)](https://github.com/linuxserver/docker-swag) and uses [watchtower](https://github.com/containrrr/watchtower) for automatically updating the frontend image to the latest version on Docker Hub.

Remember to customize both [docker-compose.yml](packages/dev-frontend/docker-compose-example/docker-compose.yml) and the [site config](packages/dev-frontend/docker-compose-example/config/nginx/site-confs/liquity.example.com).

## Known Issues

### Temporary and slightly inaccurate TCR calculation within `batchLiquidateTroves` in Recovery Mode. 

When liquidating a trove with `ICR > 110%`, a collateral surplus remains claimable by the borrower. This collateral surplus should be excluded from subsequent TCR calculations, but within the liquidation sequence in `batchLiquidateTroves` in Recovery Mode, it is not. This results in a slight distortion to the TCR value used at each step of the liquidation sequence going forward. This distortion only persists for the duration the `batchLiquidateTroves` function call, and the TCR is again calculated correctly after the liquidation sequence ends. In most cases there is no impact at all, and when there is, the effect tends to be minor. The issue is not present at all in Normal Mode. 

There is a theoretical and extremely rare case where it incorrectly causes a loss for Stability Depositors instead of a gain. It relies on the stars aligning: the system must be in Recovery Mode, the TCR must be very close to the 150% boundary, a large trove must be liquidated, and the ETH price must drop by >10% at exactly the right moment. No profitable exploit is possible. For more details, please see [this security advisory](https://github.com/liquity/dev/security/advisories/GHSA-xh2p-7p87-fhgh).

### SortedTroves edge cases - top and bottom of the sorted list

When the trove is at one end of the `SortedTroves` list and adjusted such that its ICR moves further away from its neighbor, `findInsertPosition` returns unhelpful positional hints, which if used can cause the `adjustTrove` transaction to run out of gas. This is due to the fact that one of the returned addresses is in fact the address of the trove to move - however, at re-insertion, it has already been removed from the list. As such the insertion logic defaults to `0x0` for that hint address, causing the system to search for the trove starting at the opposite end of the list. A workaround is possible, and this has been corrected in the SDK used by front ends.

### Front-running issues

#### Loss evasion by front-running Stability Pool depositors

*Example sequence 1): evade liquidation tx*
- Depositor sees incoming liquidation tx that would cause them a net loss
- Depositor front-runs with `withdrawFromSP()` to evade the loss

*Example sequence 2): evade price drop*
- Depositor sees incoming price drop tx (or just anticipates one, by reading exchange price data), that would shortly be followed by unprofitable liquidation txs
- Depositor front-runs with `withdrawFromSP()` to evade the loss

Stability Pool depositors expect to make profits from liquidations which are likely to happen at a collateral ratio slightly below 110%, but well above 100%. In rare cases (flash crashes, oracle failures), troves may be liquidated below 100% though, resulting in a net loss for stability depositors. Depositors thus have an incentive to withdraw their deposits if they anticipate liquidations below 100% (note that the exact threshold of such “unprofitable” liquidations will depend on the current Dollar price of LUSD).

As long the difference between two price feed updates is <10% and price stability is maintained, loss evasion situations should be rare. The percentage changes between two consecutive prices reported by Chainlink’s ETH:USD oracle has only ever come close to 10% a handful of times in the past few years.

In the current implementation, deposit withdrawals are prohibited if and while there are troves with a collateral ratio (ICR) < 110% in the system. This prevents loss evasion by front-running the liquidate transaction as long as there are troves that are liquidatable in normal mode.

This solution is only partially effective since it does not prevent stability depositors from monitoring the ETH price feed and front-running oracle price update transactions that would make troves liquidatable. Given that we expect loss-evasion opportunities to be very rare, we do not expect that a significant fraction of stability depositors would actually apply front-running strategies, which require sophistication and automation. In the unlikely event that large fraction of the depositors withdraw shortly before the liquidation of troves at <100% CR, the redistribution mechanism will still be able to absorb defaults.


#### Reaping liquidation gains on the fly

*Example sequence:*
- User sees incoming profitable liquidation tx
- User front-runs it and immediately makes a deposit with `provideToSP()`
- User earns a profit

Front-runners could deposit funds to the Stability Pool on the fly (instead of keeping their funds in the pool) and make liquidation gains when they see a pending price update or liquidate transaction. They could even borrow the LUSD using a trove as a flash loan.

Such flash deposit-liquidations would actually be beneficial (in terms of TCR) to system health and prevent redistributions, since the pool can be filled on the spot to liquidate troves anytime, if only for the length of 1 transaction.


#### Front-running and changing the order of troves as a DoS attack

*Example sequence:**
-Attacker sees incoming operation(`openLoan()`, `redeemCollateral()`, etc) that would insert a trove to the sorted list
-Attacker front-runs with mass openLoan txs
-Incoming operation becomes more costly - more traversals needed for insertion

It’s theoretically possible to increase the number of the troves that need to be traversed on-chain. That is, an attacker that sees a pending borrower transaction (or redemption or liquidation transaction) could try to increase the number of traversed troves by introducing additional troves on the way. However, the number of troves that an attacker can inject before the pending transaction gets mined is limited by the amount of spendable gas. Also, the total costs of making the path longer by 1 are significantly higher (gas costs of opening a trove, plus the 0.5% borrowing fee) than the costs of one extra traversal step (simply reading from storage). The attacker also needs significant capital on-hand, since the minimum debt for a trove is 2000 LUSD.

In case of a redemption, the “last” trove affected by the transaction may end up being only partially redeemed from, which means that its ICR will change so that it needs to be reinserted at a different place in the sorted trove list (note that this is not the case for partial liquidations in recovery mode, which preserve the ICR). A special ICR hint therefore needs to be provided by the transaction sender for that matter, which may become incorrect if another transaction changes the order before the redemption is processed. The protocol gracefully handles this by terminating the redemption sequence at the last fully redeemed trove (see [here](https://github.com/liquity/dev#hints-for-redeemcollateral)).

An attacker trying to DoS redemptions could be bypassed by redeeming an amount that exactly corresponds to the debt of the affected trove(s).

The attack can be aggravated if a big trove is placed first in the queue, so that any incoming redemption is smaller than its debt, as no LUSD would be redeemed if the hint for that trove fails. But that attack would be very expensive and quite risky (risk of being redeemed if the strategy fails and of being liquidated as it may have a low CR).

Finally, this DoS could be avoided if the initial transaction avoids the public gas auction entirely and is sent direct-to-miner, via (for example) Flashbots.
