
import { Command } from "#structures/classes/Command";
import {
  PermissionFlagsBits,
  MessageFlags,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  AttachmentBuilder
} from "discord.js";
import fs from "fs";
import { logger } from "#utils/logger";
import { emoji } from "#config/emoji";
import TicketUI from "#bot/Interface";
class PanelCommand extends Command {
  constructor() {
    super({
      name: "panel",
      description: "Manage ticket panel",
      usage: "panel",
      examples: ["panel"],
      userPermissions: [PermissionFlagsBits.ManageGuild],
      botPermissions: [PermissionFlagsBits.ManageChannels],
      enabledSlash: true,
      slashData: {
        name: "panel",
        description: "Manage ticket panel",
        defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
      },
    });
    this.state = {};
  }

  async execute({ ctx }) {
    const db = ctx.client.db;
    const panels = await db.getGuildPanels(ctx.guild.id);
    const panel = panels[0];

    this.state[ctx.guild.id] = {
      view: panel ? "MAIN" : "CREATE",
      panelId: panel?.panelId,
      temp: {},
      page: 0,
    };

    const c = await this._render(ctx, this.state[ctx.guild.id], db);
    const msg = await ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
    this._collector(ctx, msg, db);
  }

  async _render(ctx, st, db) {
    if (st.view === "CREATE") return this._create(ctx);
    if (st.view === "MAIN") return await this._main(ctx, st, db);
    if (st.view === "CATEGORIES") return await this._categories(ctx, st, db);
    if (st.view === "CATEGORY_EDIT") return await this._categoryEdit(ctx, st, db);
    if (st.view === "CATEGORY_ROLES") return await this._categoryRoles(ctx, st, db);
    if (st.view === "CATEGORY_SETTINGS") return await this._categorySettings(ctx, st, db);
    if (st.view === "CATEGORY_QUESTIONS") return await this._categoryQuestions(ctx, st, db);
    if (st.view === "CATEGORY_CHANNEL") return this._categoryChannel(ctx, st,db);
    if (st.view === "SELECT_CAT_QUESTIONS") return await this._selectCategoryForFeature(ctx, st, db, "Setup Questions", "QUESTIONS");
    if (st.view === "SELECT_CAT_AI") return await this._selectCategoryForFeature(ctx, st, db, "AI Assistant", "AI");
    if (st.view === "LOGS") return await this._logs(ctx, st, db);
    if (st.view === "SEND") return this._send(ctx, st);
  }

  _create(ctx) {
    const c = new ContainerBuilder();
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${emoji.cross}Create Panel\n\nNo panel exists for this server`));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("create_panel").setLabel("Create Panel").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("panel_cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary)
    ));
    return c;
  }

  async _main(ctx, st, db) {
    const p = await db.getPanel(st.panelId);
    if (!p) return new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`Panel not found`));

    const activeCats = p.categories.filter(cat => cat.isActive).length;
    const statusText = p.isActive ? "Active" : "Inactive";
    const isButtons = p.displayType === "buttons";
    const maxTickets = p.categories?.[0]?.settings?.maxTicketsPerUser || 1;

    const c = new ContainerBuilder();
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `## ${emoji.dashboard} ${p.name}\n\n` +
      `**Status:** ${statusText}\n` +
      `**Display Mode:** ${isButtons ? "Buttons Mode" : "Dropdown Mode"}\n` +
      `**Max Open Tickets / User:** ${maxTickets}\n` +
      `**Categories:** ${activeCats}/${p.categories.length} active`
    ));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    c.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("panel_name").setLabel("Edit Name").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("panel_message").setLabel("Edit Message").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("panel_placeholder").setLabel("Edit Placeholder").setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("panel_display_type").setLabel(`Display Mode: ${isButtons ? "Buttons" : "Dropdown"}`).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("panel_status").setLabel(p.isActive ? "Disable Panel" : "Enable Panel").setStyle(p.isActive ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder().setCustomId("panel_categories").setLabel("Manage Categories").setStyle(ButtonStyle.Primary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("panel_questions").setLabel("Setup Questions").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("panel_max_tickets").setLabel(`Max Tickets: ${maxTickets}`).setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("panel_logs").setLabel("Configure Logs").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("panel_send").setLabel("Send Panel").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("panel_delete").setLabel("Delete Panel").setStyle(ButtonStyle.Danger)
      )
    );

    return c;
  }

  async _categories(ctx, st, db) {
    const p = await db.getPanel(st.panelId);
    if (!p) return new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`Panel not found`));

    const cats = p.categories;
    const isButtons = p.displayType === "buttons";

    const c = new ContainerBuilder();
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `## Manage Categories\n\n` +
      `**Display Mode:** ${isButtons ? "Buttons Mode" : "Dropdown Mode"}\n` +
      `**Total Categories:** ${cats.length}/25 created`
    ));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    if (cats.length > 0) {
      if (isButtons) {
        const rows = [];
        let currentRow = new ActionRowBuilder();

        cats.forEach((cat) => {
          if (currentRow.components.length >= 5) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
          }
          const btn = new ButtonBuilder()
            .setCustomId(`cat_edit_btn_${cat.categoryId}`)
            .setLabel(cat.name.slice(0, 80))
            .setStyle(cat.isActive ? ButtonStyle.Primary : ButtonStyle.Secondary);

          if (cat.emoji) btn.setEmoji(cat.emoji);
          else btn.setEmoji(emoji.ticket);

          currentRow.addComponents(btn);
        });
        if (currentRow.components.length > 0) rows.push(currentRow);

        rows.forEach(r => c.addActionRowComponents(r));
        c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
      } else {
        const opts = cats.map(cat => ({
          label: cat.name.substring(0, 100),
          value: cat.categoryId,
          emoji: cat.emoji || emoji.ticket,
          description: cat.isActive ? `Active - ${cat.supportRoles.length} roles` : `Inactive - ${cat.supportRoles.length} roles`
        }));

        c.addActionRowComponents(new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId("cat_select").setPlaceholder("Select category to edit...").addOptions(opts)
        ));
        c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
      }
    } else {
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`No categories found. Add one to get started.`));
      c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    }

    c.addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("cat_add").setLabel("Add Category").setStyle(ButtonStyle.Success).setDisabled(cats.length >= 25),
      new ButtonBuilder().setCustomId("panel_back").setLabel("Back to Main").setStyle(ButtonStyle.Secondary)
    ));

    return c;
  }

  async _categoryEdit(ctx, st, db) {
    const p = await db.getPanel(st.panelId);
    if (!p) return new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`Panel not found`));

    const cat = p.categories.find(c => c.categoryId === st.temp.catId);
    if (!cat) return new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`Category not found`));

    const statusText = cat.isActive ? "Active" : "Inactive";
    const desc = cat.description || "No description set";
    const emojiDisplay = cat.emoji || "No emoji set";
    const categoryChannel = cat.ticketChannelCategory ? `<#${cat.ticketChannelCategory}>` : "Not set";

    const qCount = cat.questions?.length || 0;

    const c = new ContainerBuilder();
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `## Edit Category: ${cat.name}\n\n` +
      `**Status:** ${statusText}\n` +
      `**Emoji:** ${emojiDisplay}\n` +
      `**Description:** ${desc}\n` +
      `**Ticket Channel Category:** ${categoryChannel}\n` +
      `**Pre-Ticket Questions:** ${qCount} configured`
    ));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    c.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("cat_name").setLabel("Edit Name").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("cat_desc").setLabel("Edit Description").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("cat_emoji").setLabel("Edit Emoji").setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("cat_roles").setLabel("Support Roles").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("cat_channel").setLabel("Ticket Category").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("cat_naming").setLabel("Naming Format").setStyle(ButtonStyle.Primary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("cat_questions").setLabel(`Setup Questions (${qCount})`).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("cat_settings").setLabel("Category Settings").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("cat_welcome").setLabel("Welcome Message").setStyle(ButtonStyle.Primary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("cat_status").setLabel(cat.isActive ? "Disable Category" : "Enable Category").setStyle(cat.isActive ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder().setCustomId("cat_delete").setLabel("Delete Category").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("panel_back").setLabel("Back to Main").setStyle(ButtonStyle.Secondary)
      )
    );

    return c;
  }

  async _categoryQuestions(ctx, st, db) {
    const p = await db.getPanel(st.panelId);
    const cat = p.categories.find(c => c.categoryId === st.temp.catId);
    if (!cat) return new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`Category not found`));

    const questions = cat.questions || [];
    let qText = `## Pre-Ticket Setup Questions: ${cat.name}\n\n`;
    if (questions.length === 0) {
      qText += `No setup questions configured. Users will create tickets instantly without filling out a form.\n\n` +
               `Click **Add Question** to ask users questions (e.g. Username, Issue details) before their ticket opens.`;
    } else {
      qText += `Users will be prompted with a modal form containing these questions before their ticket is created:\n\n`;
      questions.forEach((q, i) => {
        qText += `**${i + 1}. ${q.label}** (${q.style === "paragraph" ? "Long text" : "Short text"})\n`;
        if (q.placeholder) qText += `   └ *Placeholder:* ${q.placeholder}\n`;
      });
    }

    const c = new ContainerBuilder();
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(qText));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("cq_add").setLabel("Add Question").setStyle(ButtonStyle.Success).setDisabled(questions.length >= 5)
    );

    if (questions.length > 0) {
      row.addComponents(
        new ButtonBuilder().setCustomId("cq_remove").setLabel("Remove Last Question").setStyle(ButtonStyle.Danger)
      );
    }

    row.addComponents(
      new ButtonBuilder().setCustomId("panel_back").setLabel("Back to Main").setStyle(ButtonStyle.Secondary)
    );

    c.addActionRowComponents(row);
    return c;
  }

  async _categoryRoles(ctx, st, db) {
    const p = await db.getPanel(st.panelId);
    const cat = p.categories.find(c => c.categoryId === st.temp.catId);
    if (!cat) return new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`Category not found`));

    const rolesText = cat.supportRoles.length ? cat.supportRoles.map(r => `<@&${r}>`).join(" ") : "No support roles assigned";

    const c = new ContainerBuilder();
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Support Roles: ${cat.name}\n\n${rolesText}`));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    c.addActionRowComponents(new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId("cat_roles_select")
        .setPlaceholder("Select support roles (up to 10)")
        .setMinValues(0)
        .setMaxValues(10)
    ));

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

    c.addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("panel_back").setLabel("Back to Main").setStyle(ButtonStyle.Secondary)
    ));

    return c;
  }

  async _categorySettings(ctx, st, db) {
    const p = await db.getPanel(st.panelId);
    const cat = p.categories.find(c => c.categoryId === st.temp.catId);
    if (!cat) return new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`Category not found`));
    const s = cat.settings;
    const settingsText = `## Category Settings: ${cat.name}\n\n` +
      `**General Options:**\n` +
      `Ping User: ${s.pingUser ? emoji.check : emoji.cross }\n` +
      `Ping Roles: ${s.pingRole ? emoji.check : emoji.cross}\n` +
      `User Can Close: ${s.userCanClose ? emoji.check : emoji.cross}\n` +
      `DM on Open: ${s.dmUserOnOpen ? emoji.check : emoji.cross}\n` +
      `DM on Close: ${s.dmUserOnClose ? emoji.check : emoji.cross}\n` +
      `Max Tickets Per User: ${s.maxTicketsPerUser}`;

    const c = new ContainerBuilder();
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(settingsText));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    c.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("cs_pu").setLabel(`Ping User: ${s.pingUser ? "ON" : "OFF"}`).setStyle(s.pingUser ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("cs_pr").setLabel(`Ping Role: ${s.pingRole ? "ON" : "OFF"}`).setStyle(s.pingRole ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("cs_uc").setLabel(`User Close: ${s.userCanClose ? "ON" : "OFF"}`).setStyle(s.userCanClose ? ButtonStyle.Secondary : ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("cs_do").setLabel(`DM Open: ${s.dmUserOnOpen ? "ON" : "OFF"}`).setStyle(s.dmUserOnOpen ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("cs_dc").setLabel(`DM Close: ${s.dmUserOnClose ? "ON" : "OFF"}`).setStyle(s.dmUserOnClose ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("cs_max").setLabel(`Max: ${s.maxTicketsPerUser}`).setStyle(ButtonStyle.Secondary)
      )
    );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

    c.addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("panel_back").setLabel("Back to Main").setStyle(ButtonStyle.Secondary)
    ));

    return c;
  }
  async _categoryChannel(ctx, st, db){
    const p = await db.getPanel(st.panelId);
    const cat = p.categories.find(c => c.categoryId === st.temp.catId);
    if (!cat) return new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`Category not found`));
    const c = new ContainerBuilder();
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Ticket Category: ${cat.name}\n\nSelect a category to create tickets in`));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Current Category: ${cat.ticketChannelCategory ? `<#${cat.ticketChannelCategory}>` : "Not set"}`));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId("cat_channel_select").setPlaceholder("Select category").setChannelTypes([ChannelType.GuildCategory]).setMaxValues(1)))
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("panel_back").setLabel("Back to Main").setStyle(ButtonStyle.Secondary)))
    return c;
  }

  async _selectCategoryForFeature(ctx, st, db, title, nextView) {
    const p = await db.getPanel(st.panelId);
    if (!p) return new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`Panel not found`));

    const cats = p.categories;
    const isButtons = p.displayType === "buttons";

    const c = new ContainerBuilder();
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `## Select Category for ${title}\n\n` +
      `Choose which category you want to configure:`
    ));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    if (isButtons) {
      const rows = [];
      let currentRow = new ActionRowBuilder();

      cats.forEach((cat) => {
        if (currentRow.components.length >= 5) {
          rows.push(currentRow);
          currentRow = new ActionRowBuilder();
        }
        const btn = new ButtonBuilder()
          .setCustomId(`cat_pick_${nextView}_${cat.categoryId}`)
          .setLabel(cat.name.slice(0, 80))
          .setStyle(cat.isActive ? ButtonStyle.Primary : ButtonStyle.Secondary);

        if (cat.emoji) btn.setEmoji(cat.emoji);
        else btn.setEmoji(emoji.ticket);

        currentRow.addComponents(btn);
      });
      if (currentRow.components.length > 0) rows.push(currentRow);

      rows.forEach(r => c.addActionRowComponents(r));
      c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    } else {
      const opts = cats.map(cat => ({
        label: cat.name.substring(0, 100),
        value: `${nextView}:${cat.categoryId}`,
        emoji: cat.emoji || emoji.ticket,
        description: `${cat.questions?.length || 0} questions configured`
      }));

      c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId("cat_pick_select").setPlaceholder("Select category...").addOptions(opts)
      ));
      c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    }

    c.addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("panel_back").setLabel("Back to Main").setStyle(ButtonStyle.Secondary)
    ));

    return c;
  }

  async _logs(ctx, st, db) {
    const p = await db.getPanel(st.panelId);
    if (!p) return new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`Panel not found`));

    const l = p.logs || {};
    const c = new ContainerBuilder();
    const logTypes = [
      { key: "createChannel", label: "Ticket Create" },
      { key: "closeChannel", label: "Ticket Close" },
      { key: "deleteChannel", label: "Ticket Delete" },
      { key: "userAddChannel", label: "User Add" },
      { key: "userRemoveChannel", label: "User Remove" },
      { key: "ratingChannel", label: "Rating" }
    ];

    const itemsPerPage = 3;
    const totalPages = Math.ceil(logTypes.length / itemsPerPage);
    const currentPage = st.page || 0;
    const startIdx = currentPage * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, logTypes.length);
    const pageItems = logTypes.slice(startIdx, endIdx);

    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Log Channel Configuration\n\nPage ${currentPage + 1}/${totalPages}`));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    let logText = "";
    for (const log of pageItems) {
      const channel = l[log.key] ? `<#${l[log.key]}>` : "Not configured";
      logText += `**${log.label}**: ${channel}\n`;
    }
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(logText));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

    for (const log of pageItems) {
      const customId = `log_${log.key}_${currentPage}`;
      c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(customId)
          .setPlaceholder(`Select channel for ${log.label}`)
          .setChannelTypes([ChannelType.GuildText])
          .setMaxValues(1)
      ));
    }

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

    const navRow = new ActionRowBuilder();
    if (currentPage > 0) {
      navRow.addComponents(new ButtonBuilder().setCustomId("log_prev").setLabel("Previous").setStyle(ButtonStyle.Secondary));
    }
    if (currentPage < totalPages - 1) {
      navRow.addComponents(new ButtonBuilder().setCustomId("log_next").setLabel("Next").setStyle(ButtonStyle.Secondary));
    }
    navRow.addComponents(
      new ButtonBuilder().setCustomId("log_reset").setLabel("Clear All Logs").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("panel_back").setLabel("Back to Main").setStyle(ButtonStyle.Secondary)
    );

    c.addActionRowComponents(navRow);

    return c;
  }

  _send(ctx, st) {
    const c = new ContainerBuilder();
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Send Panel\n\nSelect a channel to send the ticket panel message`));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    c.addActionRowComponents(new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("send_channel")
        .setPlaceholder("Select channel")
        .setChannelTypes([ChannelType.GuildText])
        .setMaxValues(1)
    ));

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

    c.addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("send_current").setLabel("Send to Current Channel").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("panel_back").setLabel("Back to Main").setStyle(ButtonStyle.Secondary)
    ));

    return c;
  }

  _msg(title, text) {
    return new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}\n\n${text}`));
  }

  async _update(ctx, msg, st, db) {
    try {
      await msg.edit({ components: [await this._render(ctx, st, db)], flags: MessageFlags.IsComponentsV2 });

      // Auto-sync deployed live panel message in channel if present
      const p = await db.getPanel(st.panelId);
      if (p?.channelId && p?.messageId) {
        try {
          const ch = await ctx.guild.channels.fetch(p.channelId).catch(() => null);
          if (ch?.isTextBased()) {
            const liveMsg = await ch.messages.fetch(p.messageId).catch(() => null);
            if (liveMsg) {
              const activeCats = p.categories.filter(c => c.isActive);
              await liveMsg.edit({
                components: [this._buildPanel(p, activeCats)],
                flags: MessageFlags.IsComponentsV2
              }).catch(() => {});
            }
          }
        } catch (e) {
          logger.debug("Panel", "Live panel message sync skipped");
        }
      }
    } catch (e) {
      logger.error("Panel", "Update failed", e);
    }
  }

  _collector(ctx, msg, db) {
    const col = msg.createMessageComponentCollector({ filter: i => i.user.id === ctx.author.id, time: 600_000 });
    const st = this.state[ctx.guild.id];

    col.on("collect", async i => {
      try {
        const id = i.customId;
        const idBase = id.split("_").slice(0, 2).join("_");

        if (id === "panel_cancel") {
          await i.deferUpdate();
          col.stop();
          await msg.edit({ components: [this._msg("Cancelled", "Operation cancelled")] });
          return;
        }

        if (id === "create_panel") {
          await i.deferUpdate();
          const panel = await db.createPanel(ctx.guild.id, { name: "Ticket Panel" });
          st.panelId = panel.panelId;
          st.view = "MAIN";
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "panel_back") {
          await i.deferUpdate();
          st.view = "MAIN";
          st.temp = {};
          st.page = 0;
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "panel_display_type") {
          await i.deferUpdate();
          const p = await db.getPanel(st.panelId);
          const nextType = p.displayType === "buttons" ? "select" : "buttons";
          await db.setPanelDisplayType(st.panelId, nextType);
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "panel_questions") {
          await i.deferUpdate();
          const p = await db.getPanel(st.panelId);
          if (!p.categories || p.categories.length === 0) {
            st.view = "CATEGORIES";
          } else if (p.categories.length === 1) {
            st.temp.catId = p.categories[0].categoryId;
            st.view = "CATEGORY_QUESTIONS";
          } else {
            st.view = "SELECT_CAT_QUESTIONS";
          }
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "panel_ai") {
          await i.deferUpdate();
          const p = await db.getPanel(st.panelId);
          if (!p.categories || p.categories.length === 0) {
            st.view = "CATEGORIES";
          } else if (p.categories.length === 1) {
            st.temp.catId = p.categories[0].categoryId;
            st.view = "CATEGORY_SETTINGS";
          } else {
            st.view = "SELECT_CAT_AI";
          }
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id.startsWith("cat_pick_QUESTIONS_") || id.startsWith("cat_pick_AI_")) {
          await i.deferUpdate();
          const parts = id.split("_");
          const targetType = parts[2];
          const catId = parts.slice(3).join("_");
          st.temp.catId = catId;
          st.view = targetType === "QUESTIONS" ? "CATEGORY_QUESTIONS" : "CATEGORY_SETTINGS";
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "cat_pick_select") {
          await i.deferUpdate();
          const [targetType, catId] = i.values[0].split(":");
          st.temp.catId = catId;
          st.view = targetType === "QUESTIONS" ? "CATEGORY_QUESTIONS" : "CATEGORY_SETTINGS";
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "panel_max_tickets") {
          const p = await db.getPanel(st.panelId);
          const currentMax = p.categories?.[0]?.settings?.maxTicketsPerUser || 1;

          const modal = new ModalBuilder().setCustomId(`pmt_${i.id}`).setTitle("Max Tickets Per User");
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("max")
                .setLabel("Max open tickets per user (1-100)")
                .setStyle(TextInputStyle.Short)
                .setValue(currentMax.toString())
                .setRequired(true)
            )
          );
          await i.showModal(modal);

          try {
            const sub = await i.awaitModalSubmit({ filter: s => s.customId === `pmt_${i.id}`, time: 120_000 });
            await sub.deferUpdate();
            const num = parseInt(sub.fields.getTextInputValue("max").trim(), 10);
            if (!isNaN(num) && num >= 1 && num <= 100) {
              for (const cat of p.categories) {
                await db.updateCategorySettings(st.panelId, cat.categoryId, { maxTicketsPerUser: num });
              }
            }
            await this._update(ctx, msg, st, db);
          } catch (e) {}
          return;
        }

        if (id === "panel_name") {
          const modal = new ModalBuilder().setCustomId(`pn_${i.id}`).setTitle("Panel Name");
          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("input").setLabel("Enter panel name").setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true)
          ));
          await i.showModal(modal);

          try {
            const sub = await i.awaitModalSubmit({ filter: s => s.customId === `pn_${i.id}`, time: 120_000 });
            await sub.deferUpdate();
            const val = sub.fields.getTextInputValue("input").trim();
            await db.setPanelName(st.panelId, val);
            await this._update(ctx, msg, st, db);
          } catch (e) {}
          return;
        }

        if (id === "panel_message") {
          const p = await db.getPanel(st.panelId);
          const modal = new ModalBuilder().setCustomId(`pm_${i.id}`).setTitle("Panel Message");
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("title")
                .setLabel("Title")
                .setStyle(TextInputStyle.Short)
                .setMaxLength(100)
                .setValue(p.panelMessage?.title || "Ticket Panel")
                .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("description")
                .setLabel("Description")
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(500)
                .setValue(p.panelMessage?.description || "Select a category below to create a ticket")
                .setRequired(true)
            )
          );
          await i.showModal(modal);

          try {
            const sub = await i.awaitModalSubmit({ filter: s => s.customId === `pm_${i.id}`, time: 120_000 });
            await sub.deferUpdate();
            const title = sub.fields.getTextInputValue("title").trim();
            const description = sub.fields.getTextInputValue("description").trim();
            await db.setPanelMessage(st.panelId, { title, description });
            await this._update(ctx, msg, st, db);
          } catch (e) {}
          return;
        }

        if (id === "panel_placeholder") {
          const modal = new ModalBuilder().setCustomId(`pp_${i.id}`).setTitle("Menu Placeholder");
          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("input").setLabel("Enter placeholder text").setStyle(TextInputStyle.Short).setMaxLength(150).setRequired(true)
          ));
          await i.showModal(modal);

          try {
            const sub = await i.awaitModalSubmit({ filter: s => s.customId === `pp_${i.id}`, time: 120_000 });
            await sub.deferUpdate();
            const val = sub.fields.getTextInputValue("input").trim();
            await db.setPanelSelectMenu(st.panelId, { placeholder: val });
            await this._update(ctx, msg, st, db);
          } catch (e) {}
          return;
        }

        if (id === "panel_status") {
          await i.deferUpdate();
          await db.togglePanelActive(st.panelId);
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "panel_categories") {
          await i.deferUpdate();
          st.view = "CATEGORIES";
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "panel_logs") {
          await i.deferUpdate();
          st.view = "LOGS";
          st.page = 0;
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "panel_send") {
          await i.deferUpdate();
          st.view = "SEND";
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "panel_delete") {
          await i.deferUpdate();
          await db.deletePanel(st.panelId);
          col.stop();
          await msg.edit({ components: [this._msg("Panel Deleted", "The panel has been deleted successfully")] });
          return;
        }

        if (id === "cat_add") {
          const modal = new ModalBuilder().setCustomId(`ca_${i.id}`).setTitle("Add Category");
          modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("name").setLabel("Category name").setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("desc").setLabel("Description (optional)").setStyle(TextInputStyle.Short).setMaxLength(200).setRequired(false)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("emoji").setLabel("Emoji (optional)").setStyle(TextInputStyle.Short).setMaxLength(10).setRequired(false))
          );
          await i.showModal(modal);

          try {
            const sub = await i.awaitModalSubmit({ filter: s => s.customId === `ca_${i.id}`, time: 120_000 });
            await sub.deferUpdate();
            const name = sub.fields.getTextInputValue("name").trim();
            const desc = sub.fields.getTextInputValue("desc")?.trim() || null;
            const emojiVal = sub.fields.getTextInputValue("emoji")?.trim() || null;
            await db.addCategory(st.panelId, { name, description: desc, emoji: emojiVal, supportRoles: [] });
            await this._update(ctx, msg, st, db);
          } catch (e) {}
          return;
        }

        if (id === "cat_select" || id.startsWith("cat_edit_btn_")) {
          await i.deferUpdate();
          st.temp.catId = id.startsWith("cat_edit_btn_") ? id.replace("cat_edit_btn_", "") : i.values[0];
          st.view = "CATEGORY_EDIT";
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "cat_back") {
          await i.deferUpdate();
          st.view = "CATEGORIES";
          st.temp = {};
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "cat_back_edit") {
          await i.deferUpdate();
          st.view = "CATEGORY_EDIT";
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "cat_questions") {
          await i.deferUpdate();
          st.view = "CATEGORY_QUESTIONS";
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "cq_add") {
          const modal = new ModalBuilder().setCustomId(`cqa_${i.id}`).setTitle("Add Setup Question");
          modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("label").setLabel("Question Title / Label").setStyle(TextInputStyle.Short).setMaxLength(45).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("placeholder").setLabel("Placeholder text (optional)").setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(false)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("style").setLabel("Type: 'short' or 'paragraph'").setStyle(TextInputStyle.Short).setValue("short").setMaxLength(10).setRequired(true))
          );
          await i.showModal(modal);

          try {
            const sub = await i.awaitModalSubmit({ filter: s => s.customId === `cqa_${i.id}`, time: 120_000 });
            await sub.deferUpdate();
            const label = sub.fields.getTextInputValue("label").trim();
            const placeholder = sub.fields.getTextInputValue("placeholder")?.trim() || "";
            const styleInput = sub.fields.getTextInputValue("style")?.trim()?.toLowerCase();
            const style = styleInput === "paragraph" ? "paragraph" : "short";

            await db.addCategoryQuestion(st.panelId, st.temp.catId, { label, placeholder, style, required: true });
            await this._update(ctx, msg, st, db);
          } catch (e) {}
          return;
        }

        if (id === "cq_remove") {
          await i.deferUpdate();
          const p = await db.getPanel(st.panelId);
          const cat = p.categories.find(c => c.categoryId === st.temp.catId);
          if (cat?.questions?.length > 0) {
            await db.removeCategoryQuestion(st.panelId, st.temp.catId, cat.questions.length - 1);
          }
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "cat_name") {
          const modal = new ModalBuilder().setCustomId(`cn_${i.id}`).setTitle("Category Name");
          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("input").setLabel("Enter category name").setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true)
          ));
          await i.showModal(modal);

          try {
            const sub = await i.awaitModalSubmit({ filter: s => s.customId === `cn_${i.id}`, time: 120_000 });
            await sub.deferUpdate();
            const val = sub.fields.getTextInputValue("input").trim();
            await db.updateCategory(st.panelId, st.temp.catId, { name: val });
            await this._update(ctx, msg, st, db);
          } catch (e) {}
          return;
        }

        if (id === "cat_desc") {
          const modal = new ModalBuilder().setCustomId(`cd_${i.id}`).setTitle("Category Description");
          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("input").setLabel("Enter description (optional)").setStyle(TextInputStyle.Short).setMaxLength(200).setRequired(false)
          ));
          await i.showModal(modal);

          try {
            const sub = await i.awaitModalSubmit({ filter: s => s.customId === `cd_${i.id}`, time: 120_000 });
            await sub.deferUpdate();
            const val = sub.fields.getTextInputValue("input")?.trim() || null;
            await db.updateCategory(st.panelId, st.temp.catId, { description: val });
            await this._update(ctx, msg, st, db);
          } catch (e) {}
          return;
        }

        if (id === "cat_emoji") {
          const modal = new ModalBuilder().setCustomId(`ce_${i.id}`).setTitle("Category Emoji");
          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("input").setLabel("Enter emoji (optional)").setStyle(TextInputStyle.Short).setMaxLength(10).setRequired(false)
          ));
          await i.showModal(modal);

          try {
            const sub = await i.awaitModalSubmit({ filter: s => s.customId === `ce_${i.id}`, time: 120_000 });
            await sub.deferUpdate();
            const val = sub.fields.getTextInputValue("input")?.trim() || null;
            await db.updateCategory(st.panelId, st.temp.catId, { emoji: val });
            await this._update(ctx, msg, st, db);
          } catch (e) {}
          return;
        }

        if (id === "cat_roles") {
          await i.deferUpdate();
          st.view = "CATEGORY_ROLES";
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "cat_roles_select") {
          await i.deferUpdate();
          await db.updateCategory(st.panelId, st.temp.catId, { supportRoles: i.values });
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "cat_channel") {
          await i.deferUpdate();
          st.view = "CATEGORY_CHANNEL";
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "cat_naming") {
          const modal = new ModalBuilder().setCustomId(`cnf_${i.id}`).setTitle("Naming Format");
          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("input")
              .setLabel("Format (use {username} {number})")
              .setStyle(TextInputStyle.Short)
              .setMaxLength(100)
              .setValue("ticket-{username}-{number}")
              .setRequired(true)
          ));
          await i.showModal(modal);

          try {
            const sub = await i.awaitModalSubmit({ filter: s => s.customId === `cnf_${i.id}`, time: 120_000 });
            await sub.deferUpdate();
            const val = sub.fields.getTextInputValue("input").trim();
            await db.updateCategory(st.panelId, st.temp.catId, { namingFormat: val });
            await this._update(ctx, msg, st, db);
          } catch (e) {}
          return;
        }

        if (id === "cat_settings") {
          await i.deferUpdate();
          st.view = "CATEGORY_SETTINGS";
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "cs_pu" || id === "cs_pr" || id === "cs_uc" || id === "cs_do" || id === "cs_dc") {
          await i.deferUpdate();
          const p = await db.getPanel(st.panelId);
          const cat = p.categories.find(c => c.categoryId === st.temp.catId);
          const s = cat.settings;

          if (id === "cs_pu") await db.updateCategorySettings(st.panelId, st.temp.catId, { pingUser: !s.pingUser });
          else if (id === "cs_pr") await db.updateCategorySettings(st.panelId, st.temp.catId, { pingRole: !s.pingRole });
          else if (id === "cs_uc") await db.updateCategorySettings(st.panelId, st.temp.catId, { userCanClose: !s.userCanClose });
          else if (id === "cs_do") await db.updateCategorySettings(st.panelId, st.temp.catId, { dmUserOnOpen: !s.dmUserOnOpen });
          else if (id === "cs_dc") await db.updateCategorySettings(st.panelId, st.temp.catId, { dmUserOnClose: !s.dmUserOnClose });

          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "cs_max") {
          const modal = new ModalBuilder().setCustomId(`csm_${i.id}`).setTitle("Max Tickets");
          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("input")
              .setLabel("Max tickets per user (1-100)")
              .setStyle(TextInputStyle.Short)
              .setValue("1")
              .setRequired(true)
          ));
          await i.showModal(modal);

          try {
            const msub = await i.awaitModalSubmit({ filter: ms => ms.customId === `csm_${i.id}`, time: 120_000 });
            await msub.deferUpdate();
            const num = parseInt(msub.fields.getTextInputValue("input"));
            if (num > 0 && num <= 100) {
              await db.updateCategorySettings(st.panelId, st.temp.catId, { maxTicketsPerUser: num });
            }
            await this._update(ctx, msg, st, db);
          } catch (e) {}
          return;
        }

        if (id === "cat_welcome") {
          const modal = new ModalBuilder().setCustomId(`cw_${i.id}`).setTitle("Welcome Message");
          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("input")
              .setLabel("Message (optional)")
              .setStyle(TextInputStyle.Paragraph)
              .setMaxLength(1000)
              .setRequired(false)
          ));
          await i.showModal(modal);

          try {
            const sub = await i.awaitModalSubmit({ filter: s => s.customId === `cw_${i.id}`, time: 120_000 });
            await sub.deferUpdate();
            const val = sub.fields.getTextInputValue("input")?.trim() || null;
            await db.updateCategorySettings(st.panelId, st.temp.catId, { welcomeMessage: val });
            await this._update(ctx, msg, st, db);
          } catch (e) {}
          return;
        }

        if (id === "cat_status") {
          await i.deferUpdate();
          await db.toggleCategoryActive(st.panelId, st.temp.catId);
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "cat_delete") {
          await i.deferUpdate();
          await db.removeCategory(st.panelId, st.temp.catId);
          st.view = "CATEGORIES";
          st.temp = {};
          await this._update(ctx, msg, st, db);
          return;
        }
        if (id === "cat_channel_select"){
          await i.deferUpdate();
          const channelId = i.values[0];
          await db.updateCategory(st.panelId, st.temp.catId, { ticketChannelCategory: channelId });
           st.view = "CATEGORY_CHANNEL";
          await this._update(ctx, msg, st, db);
        }

        if (id === "log_prev") {
          await i.deferUpdate();
          if (st.page > 0) st.page--;
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "log_next") {
          await i.deferUpdate();
          st.page++;
          await this._update(ctx, msg, st, db);
          return;
        }

        if (idBase === "log_createChannel" || idBase === "log_closeChannel" || 
            idBase === "log_deleteChannel" || idBase === "log_userAddChannel" || 
            idBase === "log_userRemoveChannel" || idBase === "log_ratingChannel") {
          await i.deferUpdate();
          const logKey = id.split("_").slice(1, -1).join("_");
          const ch = i.values?.[0];
          const p = await db.getPanel(st.panelId);
          const logs = p.logs || {};
          logs[logKey] = ch;
          await db.setPanelLogs(st.panelId, logs);
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "log_reset") {
          await i.deferUpdate();
          await db.setPanelLogs(st.panelId, {});
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "send_channel" || id === "send_current") {
          await i.deferUpdate();
          const chId = id === "send_current" ? ctx.channel.id : i.values[0];
          const ch = await ctx.guild.channels.fetch(chId);
          if (!ch?.isTextBased()) {
            await msg.edit({ components: [this._msg("Error", "Invalid channel selected")] });
            return;
          }

          const p = await db.getPanel(st.panelId);
          const cats = p.categories.filter(c => c.isActive);

          if (cats.length === 0) {
            await msg.edit({ components: [this._msg("Error", "No active categories. Enable at least one category first.")] });
            return;
          }

          const pmsg = await ch.send({ components: [this._buildPanel(p, cats)], flags: MessageFlags.IsComponentsV2 });
          await db.setPanelMessageId(st.panelId, ch.id, pmsg.id);
          col.stop();
          await msg.edit({ components: [this._msg("Panel Sent", `The ticket panel has been sent to <#${ch.id}>`)] });
          return;
        }

      } catch (e) {
        logger.error("Panel", "Collector error", e);
      }
    });

    col.on("end", () => {
      try {
        ctx.client.utils?.disableComponents(msg).catch(() => {});
      } catch (e) {}
    });
  }

  _buildPanel(panel, cats) {
    return TicketUI.buildPanel(panel, cats);
  }
}

export default new PanelCommand();
// warm bread

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
