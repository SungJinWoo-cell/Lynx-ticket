
import { Command } from "#structures/classes/Command";
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import TicketUI from "#bot/Interface";
import { emoji } from "#config/emoji";

class ClaimCommand extends Command {
  constructor() {
    super({
      name: "claim",
      aliases: ["unclaim"],
      description: "Claim this ticket as your own to handle it",
      usage: "claim",
      examples: ["claim"],
      userPermissions: [],
      botPermissions: ["ManageChannels"],
      cooldown: 5,
      enabledSlash: true,
      slashData: {
        name: "claim",
        description: "Claim this ticket as your own to handle it",
      },
    });
  }

  async execute({ ctx }) {
    const guildId = ctx.guild.id;
    const userId = ctx.author.id;

    const ticket = await ctx.client.db.getTicketByChannel(ctx.channel.id);
    if (!ticket) {
      return ctx.reply({
        components: [TicketUI.buildError("Not a Ticket", "This command can only be used inside an active ticket channel.")],
        flags: TicketUI.getEphemeralFlags(),
      });
    }

    if (ticket.status !== "open") {
      return ctx.reply({
        components: [TicketUI.buildWarning("Ticket Closed", "Cannot claim a closed ticket.")],
        flags: TicketUI.getEphemeralFlags(),
      });
    }

    // Check staff permissions
    const staffRoles = await ctx.client.db.getStaffRoles(guildId);
    const panel = await ctx.client.db.getPanel(ticket.panelId);
    const category = panel?.categories?.find(c => c.categoryId === ticket.categoryId);
    const hasSupportRole = ctx.member.roles.cache.some(r => category?.supportRoles?.includes(r.id));
    const hasStaffRole = ctx.member.roles.cache.some(r => staffRoles.includes(r.id));
    const hasManage = ctx.member.permissions.has(PermissionFlagsBits.ManageChannels);

    if (!hasManage && !hasStaffRole && !hasSupportRole) {
      return ctx.reply({
        components: [TicketUI.buildError("Permission Denied", "Only staff members can claim tickets.")],
        flags: TicketUI.getEphemeralFlags(),
      });
    }

    if (ticket.claimedBy) {
      if (ticket.claimedBy === userId) {
        // Unclaim
        await ctx.client.db.unclaimTicket(ticket.ticketId);
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## ${emoji.unlock} Ticket Unclaimed\n\nThis ticket is no longer assigned to anyone.`)
        );
        return ctx.reply({
          components: [container],
          flags: TicketUI.getFlags(),
        });
      }
      return ctx.reply({
        components: [TicketUI.buildWarning("Already Claimed", `This ticket is already claimed by <@${ticket.claimedBy}>. They must unclaim it first.`)],
        flags: TicketUI.getEphemeralFlags(),
      });
    }

    await ctx.client.db.claimTicket(ticket.ticketId, userId);

    const prefix = ctx.prefix || ".";
    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${emoji.claim} Ticket Claimed\n\n<@${userId}> has claimed this ticket and will be handling your request.\n\n-# Use \`${prefix}unclaim\` or \`${prefix}claim\` to unclaim.`
      )
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

    await ctx.reply({
      components: [container],
      flags: TicketUI.getFlags(),
    });
  }
}

export default new ClaimCommand();

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
