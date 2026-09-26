# WakeStake
u snooze u lose 

# mobile UI prototype
see [app/README.md](app/README.md) — `cd app && npm install && npm run dev`


# install zk: noir + bb

## noir
```sh
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash;
source ~/.bashrc;
noirup -v 1.0.0-beta.22
```

## bb
```sh
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/next/barretenberg/bbup/install | bash
source ~/.bashrc;
bbup --version  5.0.0-nightly.20260525   
```  

check version:  
```sh  
source ~/.bashrc
nargo --version   # 1.0.0-beta.22
bb --version      # 5.0.0-nightly.20260525
```

# install javascript/typescript: 
nvm + pnpm + node v24
```sh
# Download and install nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
# in lieu of restarting the shell
\. "$HOME/.nvm/nvm.sh"
# Download and install Node.js:
nvm install 24
# Verify the Node.js version:
node -v # Should print "v24.21.0".
# Download and install pnpm:
corepack enable pnpm
# Verify pnpm version:
pnpm -v
```

## install dependencies
```sh
pnpm install
```
`msgpackr-extract` (native dep of `@aztec/bb.js`) is already allowed to run its build script
via `allowBuilds` in `pnpm-workspace.yaml`. if pnpm ever complains about
`ERR_PNPM_IGNORED_BUILDS` for another package, run `pnpm approve-builds` and pick it, or add it to that list.

# deploy (sepolia)
store rpc url (`https://sepolia.infura.io/v3/<key>`), a funded deployer key and an [etherscan api key](https://etherscan.io/myapikey) in the encrypted keystore:
```sh
pnpm hardhat keystore set SEPOLIA_RPC_URL
pnpm hardhat keystore set SEPOLIA_PRIVATE_KEY
pnpm hardhat keystore set ETHERSCAN_API_KEY
```
regenerate the verifier if the circuit changed, then deploy and verify on etherscan:
```sh
pnpm build:verifier
pnpm hardhat ignition deploy ignition/modules/WakeStake.ts --network sepolia --parameters ignition/parameters.json --verify
```
addresses end up in `ignition/deployments/chain-11155111`. rerun the same command to resume a failed deploy.
if only verification failed, retry it with `pnpm hardhat ignition verify chain-11155111`.

`ignition/parameters.json` sets the contract `owner` (only account that can change the fee payout address), `feePayoutAddress` and `feePercentage`. anything left out defaults to the deployer and 5%.
after changing the circuit or contracts, redeploy with `--reset` (or a new `--deployment-id`), otherwise ignition refuses because the old deployment doesn't match.

# setup github
## install
```sh
sudo apt  install gh 
```

## log in
```sh
gh auth login
```
pick: GitHub.com → HTTPS → authenticate git with your GitHub credentials: **Yes** → login with a web browser.
copy the one-time code from the terminal and paste it into the github page that opens.

## set commit identity
```sh
git config --global user.name "<github username>"
git config --global user.email "<email on your github account>"
```

# deployments
sepolia, with fee (10%), `lose` and Ownable. owner: `0x6E6E6f5B804ce0874939D5BFcfe6f5bCbABAFB8E`  
WakeStake: [0xcF16ab3255EEB05ef8fC57932f6470FEaBA8deAF](https://sepolia.etherscan.io/address/0xcF16ab3255EEB05ef8fC57932f6470FEaBA8deAF#code)  
verifier (honk bb): [0xe241fe1088738e83057F69b65c19912684ee0B78](https://sepolia.etherscan.io/address/0xe241fe1088738e83057F69b65c19912684ee0B78#code)  
libraries: 
```sh
"PoseidonT3": "0xdDfF2a61bDCeD14669D5AaBC8DF9087839d5942B",
"PoseidonT4": "0xA6c1A2d728880d77F6c3030b1fd9549292E0991A",
"RelationsLib": "0xa0568b6194082Cdb4b3de7Fad45D5447cDD30240",
"ZKTranscriptLib": "0x02078800187B4E831479775c4e240064578602aE",
"LeanIMT": "0x8817422387ac287Af6D0735678F53ed21308Fd80",
```