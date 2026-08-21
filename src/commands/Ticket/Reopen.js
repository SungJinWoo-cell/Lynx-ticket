
import { Command } from "#structures/classes/Command";
import {
  PermissionFlagsBits,
  MessageFlags,
  ButtonStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
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

class ReopenCommand extends Command {
  constructor() {
    super({
      name: "reopen",
      description: "Reopen a closed ticket",
      usage: "reopen",
      examples: ["reopen"],
      userPermissions: [],
      botPermissions: [],
      enabledSlash: true,
      slashData: {
        name: "reopen",
        description: "Reopen a closed ticket",
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

    if (ticket.status === "open") {
      return ctx.reply({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${emoji.unlock} Already Open\n\nThis ticket is already open`)
          )
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    const canReopen = await checkPermissions(ctx, ctx.client, ticket);

    if (!canReopen) {
      return ctx.reply({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${emoji.cross} Permission Denied\n\nYou don't have permission to reopen this ticket`)
          )
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    const c = new ContainerBuilder();
    c.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${emoji.unlock} Reopen Ticket\n\nAre you sure you want to reopen this ticket? This will restore full access and allow continued support.`
      )
    );
    c.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
    c.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`reopen_confirm_${ticket.ticketId}`)
          .setLabel("Confirm Reopen")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reopen_cancel`)
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
      if (i.customId === `reopen_confirm_${ticket.ticketId}`) {
        await i.deferUpdate();
        await ctx.client.db.reopenTicket(ticket.ticketId);
        
        await i.editReply({
          components: [
            new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`## ${emoji.check} Ticket Reopened\n\nThe ticket has been successfully reopened and is now active`)
            )
          ],
          flags: MessageFlags.IsComponentsV2,
        });
        col.stop();
      } else if (i.customId === "reopen_cancel") {
        await i.update({
          components: [
            new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`## ${emoji.cross} Action Cancelled\n\nThe reopen request has been cancelled`)
            )
          ],
          flags: MessageFlags.IsComponentsV2,
        });
        col.stop();
      }
    });
  }
}

export default new ReopenCommand();

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
