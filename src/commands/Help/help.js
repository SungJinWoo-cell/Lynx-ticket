
import { Command } from "#structures/classes/Command";
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
} from "discord.js";
import { config } from "#config/config";
import { emoji } from "#config/emoji";

// Fallback emoji IDs for select menu options if bot hasn't loaded cache yet
const fallbackEmojiIds = {
  dashboard:  { id: "1535619223995420672", name: "dashboard" },
  ticket:     { id: "1535619183277113375", name: "ticket" },
  settings:   { id: "1535619200142549012", name: "settings" },
  logs:       { id: "1535619211747926076", name: "logs" },
  lock:       { id: "1535619217397784658", name: "lock" },
};

function resolveSelectEmoji(name, client) {
  if (client?.emojis?.cache) {
    const found = client.emojis.cache.find((e) => e.name?.toLowerCase() === name.toLowerCase());
    if (found) {
      return { name: found.name, id: found.id, animated: found.animated };
    }
  }
  return fallbackEmojiIds[name] || { name };
}

export function buildHelpPanel(category = "overview", botAvatarURL, p = config.prefix, client = null) {
  const container = new ContainerBuilder();

  let title = "";
  let content = "";

  if (category === "overview") {
    title = `## ${emoji.dashboard} Premium Ticket Support Desk`;
    content =
      `Welcome to the **Titan X Ticket System**!\n\n` +
      `Use the dropdown menu below to explore all features.\n\n` +
      `**Available Categories:**\n` +
      `${emoji.ticket} **Ticket Commands** — Manage active tickets & user permissions\n` +
      `${emoji.settings} **Panel Management** — Create, edit & deploy ticket panels\n` +
      `${emoji.logs} **Settings & Config** — Staff roles, logging & system config\n` +
      `${emoji.lock} **Admin Commands** — Prefix, stats & blacklist control\n\n` +
      `-# ${emoji.check} All commands work with prefix (\`${p}\`) and Slash (\`/\`)`;
  } else if (category === "ticket") {
    title = `## ${emoji.ticket} Ticket Management Commands`;
    content =
      `${emoji.add} **\`${p}add <@user>\`** — Grant user access to ticket\n\n` +
      `${emoji.remove} **\`${p}remove <@user>\`** — Revoke user access\n\n` +
      `${emoji.lock} **\`${p}close [reason]\`** — Close ticket\n\n` +
      `${emoji.unlock} **\`${p}reopen\`** — Re-open a closed ticket\n\n` +
      `${emoji.trash} **\`${p}delete\`** — Delete ticket channel permanently\n\n` +
      `${emoji.claim} **\`${p}claim\` / \`${p}unclaim\`** — Staff claim or unclaim a ticket\n\n` +
      `${emoji.transcript} **\`${p}transcript\`** — Generate HTML transcript of ticket`;
  } else if (category === "panel") {
    title = `## ${emoji.settings} Panel Management Commands`;
    content =
      `${emoji.settings} **\`${p}panel\`** — Open the Panel Manager to:\n` +
      `  • Create & configure ticket panels\n` +
      `  • Add & manage ticket categories\n` +
      `  • Customize emojis, names & messages\n` +
      `  • Deploy panels to any channel`;
  } else if (category === "settings") {
    title = `## ${emoji.logs} Server Settings Commands`;
    content =
      `${emoji.logs} **\`${p}settings\`** — Open the Settings Manager to:\n` +
      `  • Configure staff roles\n` +
      `  • Set log channels\n` +
      `  • Manage category defaults\n` +
      `  • Set welcome messages & limits\n\n` +
      `${emoji.timer} **Auto-Close** — Tickets automatically close after 24h of inactivity`;
  } else if (category === "admin") {
    title = `## ${emoji.lock} Administrative Commands`;
    content =
      `${emoji.settings} **\`${p}prefix [new]\`** — View/change bot prefix\n\n` +
      `${emoji.dashboard} **\`${p}stats\`** — View server ticket statistics\n\n` +
      `${emoji.cross} **\`${p}blacklist add <@user> [reason]\`** — Blacklist user\n\n` +
      `${emoji.check} **\`${p}blacklist remove <@user>\`** — Remove from blacklist\n\n` +
      `${emoji.logs} **\`${p}blacklist list\`** — View all blacklisted users`;
  }

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(title)
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
  );

  // Content with avatar thumbnail
  if (botAvatarURL) {
    container.addSectionComponents((section) =>
      section
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
        .setThumbnailAccessory((t) => t.setURL(botAvatarURL))
    );
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
  );

  // Dropdown with custom emojis
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("help_category_select")
    .setPlaceholder("Choose a command category...")
    .addOptions([
      { label: "Overview & Info",     value: "overview",  description: "General bot info & category overview",     emoji: resolveSelectEmoji("dashboard", client),  default: category === "overview" },
      { label: "Ticket Commands",     value: "ticket",    description: "Ticket control, claim & transcript",        emoji: resolveSelectEmoji("ticket", client),     default: category === "ticket" },
      { label: "Panel Management",    value: "panel",     description: "Create & deploy ticket panels",             emoji: resolveSelectEmoji("settings", client),   default: category === "panel" },
      { label: "Settings & Config",   value: "settings",  description: "Staff roles, auto-close & log config",     emoji: resolveSelectEmoji("logs", client),       default: category === "settings" },
      { label: "Admin Commands",      value: "admin",     description: "Prefix, stats & blacklist management",      emoji: resolveSelectEmoji("lock", client),       default: category === "admin" },
    ]);

  container.addActionRowComponents(new ActionRowBuilder().addComponents(selectMenu));

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Support Server")
        .setStyle(ButtonStyle.Link)
        .setURL(config.links.supportServer)
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# © Titan X Development`)
  );

  return container;
}

class HelpCommand extends Command {
  constructor() {
    super({
      name: "help",
      description: "Show all available commands in an interactive help panel",
      usage: "help",
      examples: ["help"],
      userPermissions: [],
      botPermissions: [],
      enabledSlash: true,
      slashData: {
        name: "help",
        description: "Show all available commands in an interactive help panel",
      },
    });
  }

  async execute({ ctx }) {
    const currentPrefix = (await ctx.client.db.getPrefix(ctx.guild.id)) || ctx.prefix || config.prefix;
    const botAvatarURL = ctx.client.user.displayAvatarURL({ size: 256 });
    const container = buildHelpPanel("overview", botAvatarURL, currentPrefix, ctx.client);

    const replyMsg = await ctx.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });

    if (replyMsg && typeof replyMsg.createMessageComponentCollector === "function") {
      const collector = replyMsg.createMessageComponentCollector({
        filter: (i) => i.customId === "help_category_select",
        time: 300_000,
      });

      collector.on("collect", async (i) => {
        const selectedCategory = i.values?.[0];
        if (!selectedCategory) return;
        const updatedContainer = buildHelpPanel(selectedCategory, botAvatarURL, currentPrefix, ctx.client);
        await i.update({
          components: [updatedContainer],
          flags: MessageFlags.IsComponentsV2,
        }).catch(() => {});
      });
    }
  }
}

export default new HelpCommand();

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
