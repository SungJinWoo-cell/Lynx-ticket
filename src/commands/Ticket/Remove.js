
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
  StringSelectMenuBuilder,
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

class RemoveCommand extends Command {
  constructor() {
    super({
      name: "remove",
      description: "Remove a user from the ticket",
      usage: "remove <user>",
      examples: ["remove @user", "remove 123456789"],
      userPermissions: [],
      botPermissions: [],
      enabledSlash: true,
      slashData: {
        name: "remove",
        description: "Remove a user from the ticket",
        options: [
          {
            name: "user",
            description: "User to remove",
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
            new TextDisplayBuilder().setContent(`## ${emoji.lock} Ticket Closed\n\nCannot remove users from a closed ticket`)
          )
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    const canRemove = await checkPermissions(ctx, ctx.client, ticket);

    if (!canRemove) {
      return ctx.reply({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${emoji.cross} Permission Denied\n\nYou don't have permission to remove users from this ticket`)
          )
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    const addedUsers = await ctx.client.db.getAddedUsers(ticket.ticketId);

    if (addedUsers.length === 0) {
      return ctx.reply({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${emoji.cross} No Added Users\n\nThere are no added users to remove from this ticket`)
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
      const opts = addedUsers.map(u => ({
        label: u.userId,
        value: u.userId,
        description: `Added by ${u.addedBy}`,
      }));

      const c = new ContainerBuilder();
      c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${emoji.remove} Remove User\n\nSelect a user to remove from this ticket`)
      );
      c.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );
      c.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`remove_user_select_${ticket.ticketId}`)
            .setPlaceholder("Select a user")
            .addOptions(opts)
        )
      );
      c.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      );
      c.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("remove_cancel")
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
        if (i.customId === `remove_user_select_${ticket.ticketId}`) {
          await i.deferUpdate();
          const selectedUser = i.values[0];
          await this._removeUser(ctx, i, ticket, selectedUser);
          col.stop();
        } else if (i.customId === "remove_cancel") {
          await i.update({
            components: [
              new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## ${emoji.cross} Action Cancelled\n\nThe remove request has been cancelled`)
              )
            ],
            flags: MessageFlags.IsComponentsV2,
          });
          col.stop();
        }
      });

      return;
    }

    await this._removeUser(ctx, null, ticket, userId);
  }

  async _removeUser(ctx, interaction, ticket, userId) {
    const isAdded = await ctx.client.db.isUserAdded(ticket.ticketId, userId);

    if (!isAdded) {
      const reply = {
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${emoji.cross} User Not Found\n\nThis user is not added to the ticket`)
          )
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      };

      if (interaction) {
        return interaction.editReply(reply);
      }
      return ctx.reply(reply);
    }

    await ctx.client.db.removeTicketUser(ticket.ticketId, userId, ctx.author.id);

    const reply = {
      components: [
        new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## ${emoji.remove} User Removed\n\n<@${userId}> has been removed from this ticket`)
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

export default new RemoveCommand();
// bread signature

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
