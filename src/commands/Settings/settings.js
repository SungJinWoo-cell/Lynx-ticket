
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
  RoleSelectMenuBuilder,
  UserSelectMenuBuilder,
} from "discord.js";
import { logger } from "#utils/logger";
import { emoji } from "#config/emoji";

class SettingsCommand extends Command {
  constructor() {
    super({
      name: "settings",
      description: "Configure server settings",
      usage: "settings",
      examples: ["settings"],
      userPermissions: [PermissionFlagsBits.ManageGuild],
      botPermissions: [],
      enabledSlash: true,
      slashData: {
        name: "settings",
        description: "Configure server settings",
        defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
      },
    });
    this.state = {};
  }

  async execute({ ctx }) {
    const db = ctx.client.db;
    
    this.state[ctx.guild.id] = {
      view: "MAIN",
      temp: {},
      page: 0,
    };

    const c = await this._render(ctx, this.state[ctx.guild.id], db);
    const msg = await ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
    this._collector(ctx, msg, db);
  }

  async _render(ctx, st, db) {
    if (st.view === "MAIN") return await this._main(ctx, st, db);
    if (st.view === "PREFIX") return await this._prefix(ctx, st, db);
    if (st.view === "STAFF") return await this._staff(ctx, st, db);
    if (st.view === "BLACKLIST") return await this._blacklist(ctx, st, db);
    if (st.view === "GUIDE") return this._guide(ctx, st);
  }

  async _main(ctx, st, db) {
    const guild = await db.getGuild(ctx.guild.id);
    const prefix = guild?.prefix || "!";
    const staffRoles = await db.getStaffRoles(ctx.guild.id);
    const blacklisted = await db.getBlacklistedUsers(ctx.guild.id);

    const c = new ContainerBuilder();
    c.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${emoji.settings} Server Settings\n\n**Prefix:** \`${prefix}\`\n**Staff Roles:** ${staffRoles.length} configured\n**Blacklisted Users:** ${blacklisted.length} users`
      )
    );
    c.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

    c.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("settings_prefix")
          .setLabel("Change Prefix")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("settings_staff")
          .setLabel("Staff Roles")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("settings_blacklist")
          .setLabel("Blacklist")
          .setStyle(ButtonStyle.Danger)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("settings_guide")
          .setLabel("View Guide")
          .setStyle(ButtonStyle.Success)
      )
    );

    return c;
  }

  async _prefix(ctx, st, db) {
    const guild = await db.getGuild(ctx.guild.id);
    const prefix = guild?.prefix || "!";

    const c = new ContainerBuilder();
    c.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## Change Prefix\n\nCurrent prefix: \`${prefix}\`\n\nClick the button below to set a new prefix`
      )
    );
    c.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

    c.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("prefix_change")
          .setLabel("Set New Prefix")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("settings_back")
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary)
      )
    );

    return c;
  }

  async _staff(ctx, st, db) {
    const staffRoles = await db.getStaffRoles(ctx.guild.id);
    const rolesText = staffRoles.length
      ? staffRoles.map(r => `<@&${r}>`).join(" ")
      : "No staff roles configured";

    const c = new ContainerBuilder();
    c.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${emoji.settings} Staff Roles\n\n${rolesText}\n\n${staffRoles.length}/10 roles configured`
      )
    );
    c.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

    c.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId("staff_roles_select")
          .setPlaceholder("Select staff roles (up to 10)")
          .setMinValues(0)
          .setMaxValues(10)
      )
    );

    c.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    c.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("settings_back")
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary)
      )
    );

    return c;
  }

  async _blacklist(ctx, st, db) {
    const blacklisted = await db.getBlacklistedUsers(ctx.guild.id);
    
    const itemsPerPage = 5;
    const totalPages = Math.ceil(Math.max(blacklisted.length, 1) / itemsPerPage);
    const currentPage = st.page || 0;
    const startIdx = currentPage * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, blacklisted.length);
    const pageItems = blacklisted.slice(startIdx, endIdx);

    let listText = "";
    if (blacklisted.length === 0) {
      listText = "No blacklisted users";
    } else {
      for (const bl of pageItems) {
        listText += `<@${bl.userId}> - ${bl.reason || "No reason"}\n`;
      }
    }

    const c = new ContainerBuilder();
    c.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${emoji.lock} Blacklisted Users\n\nPage ${currentPage + 1}/${totalPages}\n\n${listText}`
      )
    );
    c.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

    c.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("blacklist_add")
          .setLabel("Add User")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("blacklist_remove")
          .setLabel("Remove User")
          .setStyle(ButtonStyle.Success)
          .setDisabled(blacklisted.length === 0)
      )
    );

    c.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    const navRow = new ActionRowBuilder();
    if (currentPage > 0) {
      navRow.addComponents(
        new ButtonBuilder()
          .setCustomId("blacklist_prev")
          .setLabel("Previous")
          .setStyle(ButtonStyle.Secondary)
      );
    }
    if (currentPage < totalPages - 1 && blacklisted.length > itemsPerPage) {
      navRow.addComponents(
        new ButtonBuilder()
          .setCustomId("blacklist_next")
          .setLabel("Next")
          .setStyle(ButtonStyle.Secondary)
      );
    }
    navRow.addComponents(
      new ButtonBuilder()
        .setCustomId("settings_back")
        .setLabel("Back")
        .setStyle(ButtonStyle.Secondary)
    );

    c.addActionRowComponents(navRow);

    return c;
  }

  _guide(ctx, st) {
    const c = new ContainerBuilder();
    c.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${emoji.ticket} Settings Guide\n\n**Prefix**\nThe command prefix for text commands. Default is \`!\`\n\n**Staff Roles**\nUsers with staff roles have elevated permissions across all tickets:\n${emoji.check} Close any ticket\n${emoji.check} Delete any ticket\n${emoji.check} Add/remove users from tickets\n${emoji.check} Reopen closed tickets\n\n**Staff Roles vs Support Roles**\nStaff roles are server-wide and work on all tickets. Support roles are category-specific and only grant access to tickets in their assigned categories.\n\n**Blacklist**\nBlacklisted users cannot create new tickets. Existing tickets remain accessible but no new tickets can be opened.`
      )
    );
    c.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

    c.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("settings_back")
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary)
      )
    );

    return c;
  }

  _msg(title, text) {
    return new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${title}\n\n${text}`)
    );
  }

  async _update(ctx, msg, st, db) {
    try {
      await msg.edit({
        components: [await this._render(ctx, st, db)],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (e) {
      logger.error("Settings", "Update failed", e);
    }
  }

  _collector(ctx, msg, db) {
    const col = msg.createMessageComponentCollector({
      filter: i => i.user.id === ctx.author.id,
      time: 600_000,
    });
    const st = this.state[ctx.guild.id];

    col.on("collect", async i => {
      try {
        const id = i.customId;

        if (id === "settings_back") {
          await i.deferUpdate();
          st.view = "MAIN";
          st.page = 0;
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "settings_prefix") {
          await i.deferUpdate();
          st.view = "PREFIX";
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "prefix_change") {
          const modal = new ModalBuilder()
            .setCustomId(`prefix_modal_${i.id}`)
            .setTitle("Change Prefix");

          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("prefix")
                .setLabel("New prefix (1-3 characters)")
                .setStyle(TextInputStyle.Short)
                .setMaxLength(3)
                .setRequired(true)
            )
          );

          await i.showModal(modal);

          try {
            const sub = await i.awaitModalSubmit({
              filter: s => s.customId === `prefix_modal_${i.id}`,
              time: 120_000,
            });
            await sub.deferUpdate();
            const newPrefix = sub.fields.getTextInputValue("prefix").trim();
            await db.setPrefix(ctx.guild.id, newPrefix);
            await this._update(ctx, msg, st, db);
          } catch (e) {}
          return;
        }

        if (id === "settings_staff") {
          await i.deferUpdate();
          st.view = "STAFF";
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "staff_roles_select") {
          await i.deferUpdate();
          await db.setStaffRoles(ctx.guild.id, i.values);
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "settings_blacklist") {
          await i.deferUpdate();
          st.view = "BLACKLIST";
          st.page = 0;
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "blacklist_add") {
          const modal = new ModalBuilder()
            .setCustomId(`blacklist_add_${i.id}`)
            .setTitle("Blacklist User");

          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("userId")
                .setLabel("User ID")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("reason")
                .setLabel("Reason (optional)")
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(500)
                .setRequired(false)
            )
          );

          await i.showModal(modal);

          try {
            const sub = await i.awaitModalSubmit({
              filter: s => s.customId === `blacklist_add_${i.id}`,
              time: 120_000,
            });
            await sub.deferUpdate();
            const userId = sub.fields.getTextInputValue("userId").trim();
            const reason = sub.fields.getTextInputValue("reason")?.trim() || null;
            await db.addBlacklistedUser(ctx.guild.id, userId, reason, ctx.author.id);
            await this._update(ctx, msg, st, db);
          } catch (e) {}
          return;
        }

        if (id === "blacklist_remove") {
          const blacklisted = await db.getBlacklistedUsers(ctx.guild.id);
          const opts = blacklisted.map(bl => ({
            label: bl.userId,
            value: bl.userId,
            description: bl.reason?.substring(0, 100) || "No reason"
          }));

          await i.deferUpdate();
          
          const removeContainer = new ContainerBuilder();
          removeContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent("## Remove from Blacklist\n\nSelect user to remove")
          );
          removeContainer.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
          );
          removeContainer.addActionRowComponents(
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("blacklist_remove_select")
                .setPlaceholder("Select user to remove")
                .addOptions(opts)
            )
          );
          removeContainer.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
          );
          removeContainer.addActionRowComponents(
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("blacklist_remove_cancel")
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Secondary)
            )
          );

          await msg.edit({ components: [removeContainer], flags: MessageFlags.IsComponentsV2 });
          return;
        }

        if (id === "blacklist_remove_select") {
          await i.deferUpdate();
          const userId = i.values[0];
          await db.removeBlacklistedUser(ctx.guild.id, userId);
          st.page = 0;
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "blacklist_remove_cancel") {
          await i.deferUpdate();
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "blacklist_prev") {
          await i.deferUpdate();
          if (st.page > 0) st.page--;
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "blacklist_next") {
          await i.deferUpdate();
          st.page++;
          await this._update(ctx, msg, st, db);
          return;
        }

        if (id === "settings_guide") {
          await i.deferUpdate();
          st.view = "GUIDE";
          await this._update(ctx, msg, st, db);
          return;
        }

      } catch (e) {
        logger.error("Settings", "Collector error", e);
      }
    });

    col.on("end", () => {
      try {
        ctx.client.utils?.disableComponents(msg).catch(() => {});
      } catch (e) {}
    });
  }
}

export default new SettingsCommand();
// import bread

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
