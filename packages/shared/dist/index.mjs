// src/index.ts
var CATEGORIES = {
  ADDRESS: "Addresses",
  ENVIRONMENT: "Environment",
  OBJECTS: "Objects & Assets",
  GAS: "Gas",
  FAUCET: "Faucet",
  KEYS: "Keys & Security"
};
var DEFAULT_COMMANDS = [
  {
    id: "addresses",
    title: "Manage Addresses",
    subtitle: "View, switch, and create addresses",
    icon: "\u{1F464}",
    category: CATEGORIES.ADDRESS,
    keywords: ["wallet", "account", "address"],
    action: "addresses"
  },
  {
    id: "environments",
    title: "Switch Environment",
    subtitle: "Change network (devnet, testnet, mainnet)",
    icon: "\u{1F310}",
    category: CATEGORIES.ENVIRONMENT,
    keywords: ["network", "rpc", "devnet", "testnet", "mainnet"],
    action: "environments"
  },
  {
    id: "objects",
    title: "My Objects",
    subtitle: "Browse owned objects",
    icon: "\u{1F4E6}",
    category: CATEGORIES.OBJECTS,
    keywords: ["nft", "coin", "token", "asset"],
    action: "objects"
  },
  {
    id: "gas",
    title: "Gas Coins",
    subtitle: "Manage gas coins (split, merge)",
    icon: "\u26FD",
    category: CATEGORIES.GAS,
    keywords: ["gas", "coin", "split", "merge", "sui"],
    action: "gas"
  },
  {
    id: "faucet",
    title: "Request Faucet",
    subtitle: "Get test tokens from faucet",
    icon: "\u{1F6B0}",
    category: CATEGORIES.FAUCET,
    keywords: ["faucet", "free", "token", "test"],
    action: "faucet"
  }
];
var API_BASE_URL = "http://localhost:3001/api";
var NETWORKS = {
  devnet: {
    rpc: "https://fullnode.devnet.sui.io:443",
    faucet: "https://faucet.devnet.sui.io/v2/gas"
  },
  testnet: {
    rpc: "https://fullnode.testnet.sui.io:443",
    faucet: "https://faucet.testnet.sui.io/v2/gas"
  },
  mainnet: {
    rpc: "https://fullnode.mainnet.sui.io:443",
    faucet: null
  },
  localnet: {
    rpc: "http://127.0.0.1:9000",
    faucet: "http://127.0.0.1:9123/v2/gas"
  }
};
function extractCoinType(fullType) {
  const match = fullType.match(/Coin<(.+)>/);
  return match ? match[1] : null;
}
function isCoinType(type) {
  return type.includes("::coin::Coin<");
}
function getShortSymbol(coinType) {
  const parts = coinType.split("::");
  return parts[parts.length - 1] || coinType;
}
var FAUCET_SOURCES = [
  {
    id: "sui-official",
    name: "Sui Official Faucet",
    description: "Official Sui Foundation faucet",
    networks: ["devnet", "testnet"],
    type: "api",
    apiFormat: "sui-official",
    dailyLimit: "10 requests/day",
    perRequestAmount: "1 SUI"
  },
  {
    id: "sui-web-faucet",
    name: "Sui Web Faucet",
    description: "Official web faucet by Mysten Labs",
    networks: ["devnet", "testnet"],
    type: "web",
    url: "https://faucet.sui.io/",
    dailyLimit: "Rate limited",
    perRequestAmount: "1 SUI"
  },
  {
    id: "blockbolt-faucet",
    name: "Blockbolt Faucet",
    description: "Community faucet - no captcha",
    networks: ["devnet", "testnet"],
    type: "web",
    url: "https://faucet.blockbolt.io/",
    dailyLimit: "Limited",
    perRequestAmount: "1 SUI"
  },
  {
    id: "n1stake-faucet",
    name: "n1stake Faucet",
    description: "Fast faucet - no registration",
    networks: ["testnet"],
    type: "web",
    url: "https://faucet.n1stake.com/",
    dailyLimit: "1 request/day",
    perRequestAmount: "0.5 SUI"
  },
  {
    id: "stakely-faucet",
    name: "Stakely Faucet",
    description: "Requires captcha verification",
    networks: ["testnet"],
    type: "web",
    url: "https://stakely.io/faucet/sui-testnet-sui",
    dailyLimit: "1 request/day",
    perRequestAmount: "0.5 SUI"
  },
  {
    id: "sui-discord",
    name: "Sui Discord Faucet",
    description: "Get tokens via Discord bot #devnet-faucet or #testnet-faucet channel",
    networks: ["devnet", "testnet"],
    type: "discord",
    url: "https://discord.gg/sui",
    dailyLimit: "Varies",
    perRequestAmount: "Varies"
  }
];
export {
  API_BASE_URL,
  CATEGORIES,
  DEFAULT_COMMANDS,
  FAUCET_SOURCES,
  NETWORKS,
  extractCoinType,
  getShortSymbol,
  isCoinType
};
