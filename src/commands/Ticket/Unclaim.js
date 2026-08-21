import { Command } from "#structures/classes/Command";
import {
  ContainerBuilder,
  TextDisplayBuilder,
  PermissionFlagsBits,
} from "discord.js";
import TicketUI from "#bot/Interface";
import { emoji } from "#config/emoji";

class UnclaimCommand extends Command {
  constructor() {
    super({
      name: "unclaim",
      description: "Unclaim a ticket you have previously claimed",
      usage: "unclaim",
      examples: ["unclaim"],
      userPermissions: [],
      botPermissions: ["ManageChannels"],
      cooldown: 5,
      enabledSlash: true,
      slashData: {
        name: "unclaim",
        description: "Unclaim a ticket you have previously claimed",
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
        components: [TicketUI.buildWarning("Ticket Closed", "Cannot unclaim a closed ticket.")],
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
        components: [TicketUI.buildError("Permission Denied", "Only staff members can unclaim tickets.")],
        flags: TicketUI.getEphemeralFlags(),
      });
    }

    if (!ticket.claimedBy) {
      return ctx.reply({
        components: [TicketUI.buildWarning("Not Claimed", "This ticket is not currently claimed by anyone.")],
        flags: TicketUI.getEphemeralFlags(),
      });
    }

    if (ticket.claimedBy !== userId && !hasManage) {
      return ctx.reply({
        components: [TicketUI.buildWarning("Permission Denied", `This ticket is claimed by <@${ticket.claimedBy}>. Only they or server managers can unclaim it.`)],
        flags: TicketUI.getEphemeralFlags(),
      });
    }

    await ctx.client.db.unclaimTicket(ticket.ticketId);

    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${emoji.unlock} Ticket Unclaimed\n\n<@${userId}> has unclaimed this ticket. It is now open for staff to claim.`)
    );

    await ctx.reply({
      components: [container],
      flags: TicketUI.getFlags(),
    });
  }
}

export default new UnclaimCommand();
