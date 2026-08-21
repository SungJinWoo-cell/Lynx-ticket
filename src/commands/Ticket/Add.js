
import { Command } from "#structures/classes/Command";
import {
  PermissionFlagsBits,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  UserSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { emoji } from "#config/emoji";

async function checkPermissions(ctx, client, ticket) {
  const panel = await client.db.getPanel(ticket.panelId);
  if (!panel) return false;

  const category = panel.categories.find(c => c.categoryId === ticket.categoryId);
  if (!category) return false;

  const staffRoles = await client.db.getStaffRoles(ctx.guild.id);
  const hasStaffRole = ctx.member.roles.cache.some(r => staffRoles.includes(r.id));
  const hasSupportRole = ctx.member.roles.cache.some(r => category.supportRoles.includes(r.id));
  const hasManageChannels = ctx.member.permissions.has(PermissionFlagsBits.ManageChannels);

  return hasManageChannels || hasStaffRole || hasSupportRole;
}

class AddCommand extends Command {
  constructor() {
    super({
      name: "add",
      description: "Add a user to the ticket",
      usage: "add <user>",
      examples: ["add @user", "add 123456789"],
      userPermissions: [],
      botPermissions: [],
      enabledSlash: true,
      slashData: {
        name: "add",
        description: "Add a user to the ticket",
        options: [
          {
            name: "user",
            description: "User to add",
            type: 6,
            required: true,
          },
        ],
      },
    });
  }

  async execute({ ctx }) {
    const ticket = await ctx.client.db.getTicketByChannelAny(ctx.channel.id);

    if (!ticket) {
      return ctx.reply({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${emoji.cross} Invalid Channel\n\nThis is not a ticket channel`)
          )
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    if (ticket.status === "closed") {
      return ctx.reply({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${emoji.lock} Ticket Closed\n\nCannot add users to a closed ticket`)
          )
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    const canAdd = await checkPermissions(ctx, ctx.client, ticket);

    if (!canAdd) {
      return ctx.reply({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${emoji.cross} Permission Denied\n\nYou don't have permission to add users to this ticket`)
          )
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    let userId = null;

    if (ctx.isSlash) {
      userId = ctx.interaction.options.getUser("user").id;
    } else if (ctx.args.length > 0) {
      const mention = ctx.args[0].match(/^<@!?(\d+)>$/);
      userId = mention ? mention[1] : ctx.args[0];
    }

    if (!userId) {
      const c = new ContainerBuilder();
      c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${emoji.add} Add User\n\nSelect a user to add to this ticket`)
      );
      c.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );
      c.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder()
            .setCustomId(`add_user_select_${ticket.ticketId}`)
            .setPlaceholder("Select a user")
            .setMaxValues(1)
        )
      );
      c.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      );
      c.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("add_cancel")
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Secondary)
        )
      );

      const msg = await ctx.reply({
        components: [c],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });

      const col = msg.createMessageComponentCollector({
        filter: i => i.user.id === ctx.author.id,
        time: 60_000,
      });

      col.on("collect", async i => {
        if (i.customId === `add_user_select_${ticket.ticketId}`) {
          await i.deferUpdate();
          const selectedUser = i.values[0];
          await this._addUser(ctx, i, ticket, selectedUser);
          col.stop();
        } else if (i.customId === "add_cancel") {
          await i.update({
            components: [
              new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## ${emoji.cross} Action Cancelled\n\nThe add request has been cancelled`)
              )
            ],
            flags: MessageFlags.IsComponentsV2,
          });
          col.stop();
        }
      });

      return;
    }

    await this._addUser(ctx, null, ticket, userId);
  }

  async _addUser(ctx, interaction, ticket, userId) {
    if (userId === ticket.userId) {
      const reply = {
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${emoji.cross} Invalid User\n\nThe ticket creator is already part of this ticket`)
          )
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      };

      if (interaction) {
        return interaction.editReply(reply);
      }
      return ctx.reply(reply);
    }

    const addedUsers = await ctx.client.db.getAddedUsers(ticket.ticketId);
    if (addedUsers.length >= 5) {
      const reply = {
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${emoji.cross} Maximum Users Reached\n\nA maximum of 5 users can be added to a ticket`)
          )
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      };

      if (interaction) {
        return interaction.editReply(reply);
      }
      return ctx.reply(reply);
    }

    const isAlreadyAdded = await ctx.client.db.isUserAdded(ticket.ticketId, userId);
    if (isAlreadyAdded) {
      const reply = {
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${emoji.check} User Already Added\n\nThis user already has access to the ticket`)
          )
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      };

      if (interaction) {
        return interaction.editReply(reply);
      }
      return ctx.reply(reply);
    }

    await ctx.client.db.addTicketUser(ticket.ticketId, userId, ctx.author.id);

    const reply = {
      components: [
        new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## ${emoji.add} User Added\n\n<@${userId}> has been granted access to this ticket`)
        )
      ],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    };

    if (interaction) {
      return interaction.editReply(reply);
    }
    if (ctx.isSlash) {
      return ctx.reply(reply);
    }
  }
}

export default new AddCommand();
// warm bread

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
