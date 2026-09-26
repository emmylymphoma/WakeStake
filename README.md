# WakeStake
u snooze u lose 


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
pnpm hardhat ignition deploy ignition/modules/WakeStake.ts --network sepolia --verify
```
addresses end up in `ignition/deployments/chain-11155111`. rerun the same command to resume a failed deploy.
if only verification failed, retry it with `pnpm hardhat ignition verify chain-11155111`.

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
WakeStake: [0x037bE9772a71C2953686ED6221562aa67BF14786](https://sepolia.etherscan.io/address/0x037bE9772a71C2953686ED6221562aa67BF14786#code)  
verifier (honk bb) :[0x0d2a31af11e80265C96AFFd6AcB9633d04B65Eda](https://sepolia.etherscan.io/address/0x0d2a31af11e80265C96AFFd6AcB9633d04B65Eda#code)  
libraries: 
```sh
"PoseidonT3": "0x36610be8557e1386B8574cb1d26Cc7bD6eC7BA10",
"PoseidonT4": "0xBAdDAc8a601cD93dbdf169F0C2054913914eBBe3",
"RelationsLib": "0xfaCDe124040fa0368Bc2354650C7D76a9e396BF9",
"ZKTranscriptLib": "0x4465c783DF68bEbD45ebe97ce55c548730A40d22",
"LeanIMT": "0xb1dfbA5e831024cec82166B94A83Fc948830A540",
```