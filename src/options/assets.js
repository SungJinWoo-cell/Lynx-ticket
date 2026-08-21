
let botClient = null;

export function initEmojiManager(client) {
  botClient = client;
}

export function getEmoji(name, fallback = "") {
  if (botClient?.emojis?.cache) {
    const targetName = name === "cross" ? "close" : name;
    const found = botClient.emojis.cache.find(
      (e) => e.name?.toLowerCase() === targetName.toLowerCase() || e.name?.toLowerCase() === name.toLowerCase()
    );
    if (found) {
      return found.toString();
    }
  }
  return hardcodedDefaults[name] || fallback;
}

const hardcodedDefaults = {
  unlock: "<:unlock:1535619172048969828>",
  trash: "<:trash:1535619177602220042>",
  ticket: "<:ticket:1535619183277113375>",
  starFill: "<:starFill:1535619188767588443>",
  starEmpty: "<:starEmpty:1535619193867731045>",
  settings: "<:settings:1535619200142549012>",
  remove: "<:remove:1535619205922299966>",
  logs: "<:logs:1535619211747926076>",
  lock: "<:lock:1535619217397784658>",
  dashboard: "<:dashboard:1535619223995420672>",
  cross: "<:close:1535619229749878825>",
  check: "<:check:1535619236435857438>",
  add: "<:add:1535619242781712406>",
  claim: "<:claim:1535619248599339019>",
  transcript: "<:transcript:1535619254236225547>",
  timer: "<:timer:1535619260024496128>",
  reopen: "<:reopen:1536046619869585458>",
  mail: "<:mail:1536046625623900340>",
};

export const emoji = new Proxy(hardcodedDefaults, {
  get(target, prop) {
    if (typeof prop !== "string") return target[prop];
    if (prop === "get") return (name, fallback) => getEmoji(name, fallback);
    if (prop === "toString") return () => "[EmojiManager]";
    return getEmoji(prop, target[prop] || "");
  },
});

export default emoji;

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
