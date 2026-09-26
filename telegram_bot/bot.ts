// WakeStake Telegram bot
//
// Posts in group chats when someone fails to wake up in time, with a link
// where the others can claim the slashed stake. Nobody has to /start the bot:
// add it to a group once and it remembers that group automatically.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Bot, InlineKeyboard } from "grammy";
import { createPublicClient, formatEther, http, parseAbi, type Address } from "viem";

try {
  process.loadEnvFile(new URL(".env", import.meta.url));
} catch {
  // no .env file, rely on the real environment
}

const BOT_TOKEN = requireEnv("BOT_TOKEN");
const DAPP_URL = requireEnv("DAPP_URL").replace(/\/$/, "");
const RPC_URL = process.env.RPC_URL;
const WAKESTAKE_ADDRESS = process.env.WAKESTAKE_ADDRESS as Address | undefined;
const DEV_MODE = process.env.DEV_MODE === "1";

// Placeholder: update once the contract's slash event is final.
const wakeStakeAbi = parseAbi([
  "event Slashed(address indexed sleeper, uint256 indexed stakeId, uint256 amount)",
]);

// Optional wallet -> display name mapping, e.g. {"0xabc...": "Emmy"}
const NAMES_FILE = new URL("names.json", import.meta.url);
const names: Record<string, string> = existsSync(NAMES_FILE)
  ? lowercaseKeys(JSON.parse(readFileSync(NAMES_FILE, "utf8")))
  : {};

// ---------------------------------------------------------------------------
// Group registry: remembered automatically when the bot is added to a group
// ---------------------------------------------------------------------------

const GROUPS_FILE = new URL("groups.json", import.meta.url);
const groups = new Set<number>(
  existsSync(GROUPS_FILE) ? JSON.parse(readFileSync(GROUPS_FILE, "utf8")) : [],
);
for (const id of (process.env.GROUP_CHAT_IDS ?? "").split(",").filter(Boolean)) {
  groups.add(Number(id));
}

function saveGroups() {
  writeFileSync(GROUPS_FILE, JSON.stringify([...groups], null, 2));
}

const bot = new Bot(BOT_TOKEN);

bot.on("my_chat_member", async (ctx) => {
  const chat = ctx.chat;
  if (chat.type !== "group" && chat.type !== "supergroup") return;

  const status = ctx.myChatMember.new_chat_member.status;
  if (status === "member" || status === "administrator") {
    if (!groups.has(chat.id)) {
      groups.add(chat.id);
      saveGroups();
      console.log(`Joined group "${chat.title}" (${chat.id})`);
      await ctx.reply(
        "⏰ WakeStake is watching! I'll post here whenever someone oversleeps " +
          "so the rest of you can claim their stake.",
      );
    }
  } else if (status === "left" || status === "kicked") {
    groups.delete(chat.id);
    saveGroups();
    console.log(`Removed from group "${chat.title}" (${chat.id})`);
  }
});

// A group upgraded to a supergroup gets a new chat id
bot.on("message:migrate_to_chat_id", (ctx) => {
  groups.delete(ctx.chat.id);
  groups.add(ctx.message.migrate_to_chat_id);
  saveGroups();
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export interface SlashInfo {
  sleeper: Address;
  stakeId: bigint;
  amount: bigint;
}

function displayName(address: Address) {
  return names[address.toLowerCase()] ?? `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export async function notifySlash({ sleeper, stakeId, amount }: SlashInfo) {
  const text =
    `😴 <b>${escapeHtml(displayName(sleeper))}</b> didn't wake up in time!\n\n` +
    `💰 <b>${formatEther(amount)} ETH</b> is up for grabs. First come, first served.`;
  const keyboard = new InlineKeyboard().url("Claim now", `${DAPP_URL}/claim?stake=${stakeId}`);

  for (const chatId of groups) {
    try {
      await bot.api.sendMessage(chatId, text, { parse_mode: "HTML", reply_markup: keyboard });
    } catch (err) {
      console.error(`Failed to notify chat ${chatId}:`, err);
    }
  }
}

// ---------------------------------------------------------------------------
// Contract watcher (only runs once the contract is deployed)
// ---------------------------------------------------------------------------

function watchContract() {
  if (!RPC_URL || !WAKESTAKE_ADDRESS) {
    console.warn("RPC_URL / WAKESTAKE_ADDRESS not set, not watching the contract.");
    return;
  }

  const client = createPublicClient({ transport: http(RPC_URL) });
  client.watchContractEvent({
    address: WAKESTAKE_ADDRESS,
    abi: wakeStakeAbi,
    eventName: "Slashed",
    onLogs: async (logs) => {
      for (const { args } of logs) {
        await notifySlash({ sleeper: args.sleeper!, stakeId: args.stakeId!, amount: args.amount! });
      }
    },
    onError: (err) => console.error("Contract watcher error:", err),
  });
  console.log(`Watching ${WAKESTAKE_ADDRESS} for Slashed events`);
}

// ---------------------------------------------------------------------------
// Dev helper: /testslash in a group posts a fake notification
// ---------------------------------------------------------------------------

if (DEV_MODE) {
  bot.command("testslash", async (ctx) => {
    groups.add(ctx.chat.id); // in case the bot was added before it was running
    saveGroups();
    await notifySlash({
      sleeper: "0x000000000000000000000000000000000000dEaD",
      stakeId: 1n,
      amount: 10n ** 16n,
    });
  });
}

// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name} (see .env.example)`);
  return value;
}

function lowercaseKeys(obj: Record<string, string>) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

bot.catch((err) => console.error("Bot error:", err));

watchContract();
bot.start({
  allowed_updates: ["message", "my_chat_member"],
  onStart: (me) => console.log(`@${me.username} running, ${groups.size} group(s) registered`),
});
