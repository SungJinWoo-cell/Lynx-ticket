
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  MessageFlags,
  AllowedMentionsTypes
} from "discord.js";
import { emoji } from "#config/emoji"

export class TicketUI {
  static buildPanel(panel, categories) {
    const cats = categories || panel.categories?.filter(c => c.isActive) || [];
    const container = new ContainerBuilder();
    const title = panel.panelMessage?.title || "Ticket Support Hub";
    const description = panel.panelMessage?.description || `${emoji.ticket} Click a button or select a category below to open a ticket.`;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`));
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(description));
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    if (panel.displayType === "buttons") {
      const rows = [];
      let currentRow = new ActionRowBuilder();

      cats.forEach((cat) => {
        if (currentRow.components.length >= 5) {
          rows.push(currentRow);
          currentRow = new ActionRowBuilder();
        }
        const btn = new ButtonBuilder()
          .setCustomId(`ticket_create_btn_${cat.categoryId}`)
          .setLabel(cat.name.slice(0, 80))
          .setStyle(ButtonStyle.Primary);

        if (cat.emoji) btn.setEmoji(cat.emoji);
        else btn.setEmoji(emoji.ticket);

        currentRow.addComponents(btn);
      });
      if (currentRow.components.length > 0) rows.push(currentRow);

      rows.forEach((r) => container.addActionRowComponents(r));
    } else {
      const opts = cats.map(cat => ({
        label: cat.name.substring(0, 100),
        value: cat.categoryId,
        emoji: cat.emoji || emoji.ticket,
        description: cat.description?.substring(0, 100) || undefined
      }));

      container.addActionRowComponents(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("ticket_create")
          .setPlaceholder(panel.selectMenuConfig?.placeholder || "Select a ticket category...")
          .addOptions(opts)
      ));
    }

    return container;
  }

  static buildTicketPanel(ticket, category, addedUsers = []) {
    const container = new ContainerBuilder();

    const isOpen = ticket.status === "open";
    const statusEmoji = isOpen ? emoji.check : emoji.lock;
    const statusText = isOpen ? "Open" : "Closed";
    const welcomeMsg = category.settings?.welcomeMessage || "Welcome! Our support team will be with you shortly.";

    // Build Q&A section with code-block style for easy copying
    let answersSection = "";
    if (ticket.answers && ticket.answers.length > 0) {
      const validAnswers = ticket.answers.filter(ans => {
        if (!ans || !ans.answer) return false;
        const lower = ans.answer.trim().toLowerCase();
        return lower !== "" && lower !== "<no answer>" && lower !== "<no response>" && lower !== "no answer" && lower !== "none" && lower !== "n/a";
      });

      if (validAnswers.length > 0) {
        answersSection = `\n\n**${emoji.logs} Questionnaire Responses**\n`;
        for (const ans of validAnswers) {
          answersSection += `> **${ans.question}**\n> \`\`\`\n> ${ans.answer}\n> \`\`\`\n`;
        }
      }
    }

    // Header + welcome + Q&A + status
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${emoji.ticket} ${category.name}\n` +
        `\n${welcomeMsg}` +
        `${answersSection}` +
        `\n\n${statusEmoji} **Status:** ${statusText}`
      )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

    // User management dropdowns (open tickets only)
    if (isOpen) {
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder()
            .setCustomId(`ticket_add_user_${ticket.ticketId}`)
            .setPlaceholder("Add member to ticket...")
            .setMaxValues(1)
        )
      );

      if (addedUsers.length > 0) {
        const removeOptions = addedUsers.map(u => ({
          label: u.username || `User ${u.userId}`,
          value: u.userId,
          emoji: emoji.remove,
          description: `Added by ${u.addedByUsername || 'Unknown'}`,
        }));

        container.addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`ticket_remove_user_${ticket.ticketId}`)
              .setPlaceholder("Remove member from ticket...")
              .addOptions(removeOptions)
              .setMaxValues(1)
          )
        );
      }

      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      );
    }

    // Action buttons
    const buttons = [];

    if (isOpen) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`ticket_close_${ticket.ticketId}`)
          .setLabel("Close Ticket")
          .setEmoji(emoji.lock)
          .setStyle(ButtonStyle.Danger)
      );
    } else {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`ticket_reopen_${ticket.ticketId}`)
          .setLabel("Reopen")
          .setEmoji(emoji.unlock)
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`ticket_delete_${ticket.ticketId}`)
          .setLabel("Delete Ticket")
          .setEmoji(emoji.trash)
          .setStyle(ButtonStyle.Danger)
      );
    }

    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(...buttons)
    );

    return container;
  }

  static buildRatingRequest(ticketId, userId) {
    const container = new ContainerBuilder();
    
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${emoji.starFill} Rate Your Experience\n\n<@${userId}>, please rate your support experience:`
      )
    );
    
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
    
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_rate_btn_${ticketId}_1`).setLabel("1").setEmoji(emoji.starFill).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`ticket_rate_btn_${ticketId}_2`).setLabel("2").setEmoji(emoji.starFill).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`ticket_rate_btn_${ticketId}_3`).setLabel("3").setEmoji(emoji.starFill).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`ticket_rate_btn_${ticketId}_4`).setLabel("4").setEmoji(emoji.starFill).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`ticket_rate_btn_${ticketId}_5`).setLabel("5").setEmoji(emoji.starFill).setStyle(ButtonStyle.Success)
      )
    );

    return container;
  }

  static buildError(title, message) {
    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${emoji.cross} ${title}\n\n${message}`)
    );
    return container;
  }

  static buildSuccess(title, message) {
    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${emoji.check} ${title}\n\n${message}`)
    );
    return container;
  }

  static buildWarning(title, message) {
    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${emoji.logs} ${title}\n\n${message}`)
    );
    return container;
  }

  static buildInfo(title, message) {
    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${emoji.logs} ${title}\n\n${message}`)
    );
    return container;
  }

  static buildConfirmation(title, message, confirmId, cancelId, confirmLabel = "Confirm", confirmStyle = ButtonStyle.Danger) {
    const container = new ContainerBuilder();
    
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${title}\n\n${message}`)
    );
    
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
    
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(confirmId)
          .setLabel(confirmLabel)
          .setStyle(confirmStyle),
        new ButtonBuilder()
          .setCustomId(cancelId)
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary)
      )
    );

    return container;
  }

  static buildLogEmbed(title, data) {
    const container = new ContainerBuilder();
    
    let content = `## ${title}\n\n`;
    
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined) {
        content += `**${key}:** ${value}\n`;
      }
    }
    
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(content)
    );

    return container;
  }

  static getFlags() {
    return MessageFlags.IsComponentsV2;
  }
  
  static getEphemeralFlags() {
    return MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
  }

  static buildError(title, message) {
    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${emoji.cross} ${title}\n\n${message}`)
    );
    return container;
  }

  static buildWarning(title, message) {
    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${emoji.logs} ${title}\n\n${message}`)
    );
    return container;
  }

  static buildSuccess(title, message) {
    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${emoji.check} ${title}\n\n${message}`)
    );
    return container;
  }

  static buildDMOpenEmbed(guild, channel, category) {
    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${emoji.ticket} Ticket Created!\n\n` +
        `Your ticket in **[${guild.name}](https://discord.com/channels/${guild.id})** has been created successfully.\n\n` +
        `**Category:** ${category.name}\n\n` +
        `-# Use the button below to jump directly to your ticket.`
      )
    );
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Go to Ticket")
          .setEmoji(emoji.ticket)
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/channels/${guild.id}/${channel.id}`)
      )
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# © Titan X Development`)
    );
    return container;
  }

  static buildDMCloseEmbed(guild, guildId, channelId, closedBy, reason) {
    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${emoji.lock} Ticket Closed\n\n` +
        `Your support ticket in **[${guild.name}](https://discord.com/channels/${guildId})** has been closed.\n\n` +
        `**Closed By:** <@${closedBy}>\n` +
        (reason ? `**Reason:** ${reason}\n\n` : "\n") +
        `-# You can view or reopen the ticket using the button below.`
      )
    );
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Go to Ticket")
          .setEmoji(emoji.reopen)
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/channels/${guildId}/${channelId}`)
      )
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# © Titan X Development`)
    );
    return container;
  }
}

export default TicketUI;

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
