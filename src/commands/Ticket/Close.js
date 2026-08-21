
import { Command } from "#structures/classes/Command";
import {
  PermissionFlagsBits,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  Component,
} from "discord.js";
import { logger } from "#utils/logger";
import { emoji } from "#config/emoji";

async function checkPermissions(ctx, client, ticket) {
  const panel = await client.db.getPanel(ticket.panelId);
  if (!panel) return false;

  const category = panel.categories.find(c => c.categoryId === ticket.categoryId);
  if (!category) return false;

  const staffRoles = await client.db.getStaffRoles(ctx.guild.id);
  const hasStaffRole = ctx.member.roles.cache.some(r => staffRoles.includes(r.id));
  const hasSupportRole = ctx.member.roles.cache.some(r => category.supportRoles.includes(r.id));
  const isTicketOwner = ctx.author.id === ticket.userId;
  const hasManageChannels = ctx.member.permissions.has(PermissionFlagsBits.ManageChannels);

  return hasManageChannels || hasStaffRole || hasSupportRole || (category.settings.userCanClose && isTicketOwner);
}

class CloseCommand extends Command {
  constructor() {
    super({
      name: "close",
      description: "Close a ticket",
      usage: "close [reason]",
      examples: ["close", "close Issue resolved"],
      userPermissions: [],
      botPermissions: [],
      enabledSlash: true,
      slashData: {
        name: "close",
        description: "Close a ticket",
        options: [
          {
            name: "reason",
            description: "Reason for closing",
            type: 3,
            required: false,
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
            new TextDisplayBuilder().setContent(`## ${emoji.lock} Already Closed\n\nThis ticket is already closed`)
          )
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    const canClose = await checkPermissions(ctx, ctx.client, ticket);

    if (!canClose) {
      return ctx.reply({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${emoji.cross} Permission Denied\n\nYou don't have permission to close this ticket`)
          )
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    let reason = null;
    
    if (ctx.isSlash && ctx.interaction.options.getString("reason")) {
      reason = ctx.interaction.options.getString("reason");
      await ctx.client.db.closeTicket(ticket.ticketId, ctx.author.id, reason);
      return ctx.reply({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${emoji.check} Ticket Closed\n\nThe ticket has been closed successfully`)
          )
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    if (!ctx.isSlash && ctx.args.length > 0) {
      reason = ctx.args.join(" ");
      await ctx.client.db.closeTicket(ticket.ticketId, ctx.author.id, reason);
      return ctx.reply({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${emoji.check} Ticket Closed\n\nThe ticket has been closed successfully`)
          )
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }
    if(!ctx.isSlash && !ctx.args.length){
      await ctx.client.db.closeTicket(ticket.ticketId, ctx.author.id, "none");
      return ctx.reply({components:[new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${emoji.check} Ticket Closed\n\nThe ticket has been closed successfully`))],flags:MessageFlags.IsComponentsV2})
    }

    const modalId = `close_modal_${ticket.ticketId}_${Date.now()}`;
    const modal = new ModalBuilder()
      .setCustomId(modalId)
      .setTitle("Close Ticket");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Reason for closing (optional)")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Provide a reason for closing this ticket...")
          .setMaxLength(500)
          .setRequired(false)
      )
    );

    await ctx.interaction.showModal(modal);

    try {
      const modalSubmit = await ctx.interaction.awaitModalSubmit({
        filter: (i) => i.customId === modalId && i.user.id === ctx.author.id,
        time: 120_000,
      });

      await modalSubmit.deferUpdate();

      reason = modalSubmit.fields.getTextInputValue("reason")?.trim() || null;
      await ctx.client.db.closeTicket(ticket.ticketId, ctx.author.id, reason);

      await modalSubmit.followUp({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${emoji.check} Ticket Closed\n\nThe ticket has been closed successfully`)
          )
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    } catch (e) {
      logger.debug("Close", "Modal timeout");
    }
  }
}

export default new CloseCommand();
// bread reject

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
