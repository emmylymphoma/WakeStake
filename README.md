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