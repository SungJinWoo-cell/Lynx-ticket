import {
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize
} from "discord.js";
import { logger } from "#utils/logger";
import TicketUI from "#bot/Interface";
import { emoji } from "#config/emoji";
import { buildHelpPanel } from "#commands/Help/help";

// Safe reply helper - tries reply, falls back to followUp if already replied/deferred
async function safeReply(interaction, options) {
  try {
    if (interaction.replied || interaction.deferred) {
      return await interaction.followUp(options).catch(() => {});
    }
    return await interaction.reply(options).catch(() => {});
  } catch {
    return await interaction.followUp(options).catch(() => {});
  }
}

export default {
  name: "interactionCreate",

  async execute({ eventArgs, client }) {
    const [interaction] = eventArgs;

    // 1. Global Modal Submit Router
    if (interaction.isModalSubmit()) {
      if (
        interaction.customId.startsWith("ticket_modal_submit_") ||
        interaction.customId.startsWith("ticket_modal_submit:")
      ) {
        return handleTicketModalSubmit(interaction, client);
      }
      if (interaction.customId.startsWith("close_modal_")) {
        return handleCloseModalSubmit(interaction, client);
      }
      return;
    }

    // 2. Message Component Router (buttons, select menus)
    if (!interaction.isMessageComponent()) return;

    const handlers = {
      help_category_select: handleHelpSelect,
      ticket_create: handleTicketCreate,
      ticket_close: handleTicketClose,
      ticket_add_user: handleTicketAddUser,
      ticket_remove_user: handleTicketRemoveUser,
      ticket_rate: handleTicketRate,
      ticket_reopen: handleTicketReopen,
      ticket_delete: handleTicketDelete,
      confirm_reopen: handleConfirmReopen,
      cancel_reopen: handleCancelReopen,
      confirm_delete: handleConfirmDelete,
      cancel_delete: handleCancelDelete,
    };

    for (const [key, handler] of Object.entries(handlers)) {
      const matches =
        interaction.customId === key ||
        interaction.customId.startsWith(`${key}_`) ||
        (key === "ticket_create" && interaction.customId.startsWith("ticket_create_btn_")) ||
        (key === "ticket_rate" && interaction.customId.startsWith("ticket_rate_btn_"));

      if (matches) {
        try {
          await handler(interaction, client);
        } catch (error) {
          logger.error("Interaction", `${key} failed`, error);
          await safeReply(interaction, {
            components: [TicketUI.buildError("Error", "An unexpected error occurred.")],
            flags: TicketUI.getEphemeralFlags()
          });
        }
        return;
      }
    }
  },
};

async function handleTicketCreate(interaction, client) {
  let categoryId;
  if (interaction.customId.startsWith("ticket_create_btn_")) {
    categoryId = interaction.customId.replace("ticket_create_btn_", "");
  } else if (interaction.values?.[0]) {
    categoryId = interaction.values[0];
  }

  if (!categoryId) return;

  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  const panels = await client.db.getGuildPanels(guildId);
  const panel = panels.find(p => p.categories.some(c => c.categoryId === categoryId));

  if (!panel) {
    return safeReply(interaction, {
      components: [TicketUI.buildError("Panel Not Found", "The ticket panel could not be located.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  const category = panel.categories.find(c => c.categoryId === categoryId);

  if (!category || !category.isActive) {
    return safeReply(interaction, {
      components: [TicketUI.buildWarning("Category Unavailable", "This ticket category is currently disabled.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  const isBlacklisted = await client.db.isUserBlacklisted(guildId, userId);
  if (isBlacklisted) {
    return safeReply(interaction, {
      components: [TicketUI.buildError("Access Denied", "You are blacklisted from creating tickets.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  const openTickets = await client.db.getUserCategoryOpenTickets(guildId, userId, categoryId);
  if (openTickets.length >= category.settings.maxTicketsPerUser) {
    if (interaction.isStringSelectMenu() && interaction.message) {
      const activeCats = panel.categories.filter(c => c.isActive);
      interaction.message.edit({
        components: [TicketUI.buildPanel(panel, activeCats)],
        flags: TicketUI.getFlags()
      }).catch(() => {});
    }
    return safeReply(interaction, {
      components: [TicketUI.buildWarning(
        "Maximum Tickets Reached",
        `You already have **${category.settings.maxTicketsPerUser}** open ticket(s) in this category.`
      )],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  // Reset dropdown menu selection back to placeholder
  if (interaction.isStringSelectMenu() && interaction.message) {
    const activeCats = panel.categories.filter(c => c.isActive);
    interaction.message.edit({
      components: [TicketUI.buildPanel(panel, activeCats)],
      flags: TicketUI.getFlags()
    }).catch(() => {});
  }

  // Pre-ticket Questionnaire Modal Flow
  if (category.questions && category.questions.length > 0) {
    const modal = new ModalBuilder()
      .setCustomId(`ticket_modal_submit:${panel.panelId}:${categoryId}`)
      .setTitle(`${category.name.slice(0, 30)} Setup`);

    category.questions.slice(0, 5).forEach((q, index) => {
      const input = new TextInputBuilder()
        .setCustomId(`q_${index}`)
        .setLabel(q.label.slice(0, 45))
        .setStyle(q.style === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(q.required !== false);

      if (q.placeholder) input.setPlaceholder(q.placeholder.slice(0, 100));

      modal.addComponents(new ActionRowBuilder().addComponents(input));
    });

    return await interaction.showModal(modal);
  }

  // Direct Ticket Creation without questions
  // Guard: if already replied (from duplicate event), bail silently
  if (interaction.replied || interaction.deferred) return;

  // Use reply() (not deferReply) so no "thinking..." spinner ever shows
  await interaction.reply({
    components: [TicketUI.buildSuccess("Ticket Creating", "Your ticket is being created, please wait...")],
    flags: TicketUI.getEphemeralFlags()
  }).catch(() => {});

  // Store interaction so Create.js can editReply with the real channel link
  client.pendingTicketInteractions = client.pendingTicketInteractions || new Map();
  const pendingKey = `${guildId}_${userId}`;
  client.pendingTicketInteractions.set(pendingKey, interaction);
  setTimeout(() => client.pendingTicketInteractions?.delete(pendingKey), 60_000);

  await client.db.createTicket(guildId, panel.panelId, categoryId, userId);
}

async function handleTicketModalSubmit(interaction, client) {
  // Guard: if already replied (e.g. from duplicate event), bail out silently
  if (interaction.replied || interaction.deferred) return;

  let panelId, categoryId;
  if (interaction.customId.includes(":")) {
    const parts = interaction.customId.split(":");
    panelId = parts[1];
    categoryId = parts[2];
  } else {
    const raw = interaction.customId.replace("ticket_modal_submit_", "");
    const catIdx = raw.indexOf("_cat_");
    if (catIdx !== -1) {
      panelId = raw.substring(0, catIdx);
      categoryId = raw.substring(catIdx + 1);
    } else {
      const parts = raw.split("_");
      panelId = parts[0];
      categoryId = parts[1];
    }
  }

  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  const panel = await client.db.getPanel(panelId);
  const category = panel?.categories?.find(c => c.categoryId === categoryId);

  if (!panel || !category) {
    return interaction.reply({
      components: [TicketUI.buildError("Panel/Category Not Found", "The panel or category for this ticket could not be located.")],
      flags: TicketUI.getEphemeralFlags()
    }).catch(() => {});
  }

  const answers = [];
  if (category?.questions) {
    category.questions.slice(0, 5).forEach((q, index) => {
      try {
        const val = interaction.fields.getTextInputValue(`q_${index}`);
        const trimmed = val ? val.trim() : "";
        const lower = trimmed.toLowerCase();
        if (trimmed && lower !== "<no answer>" && lower !== "<no response>" && lower !== "no answer" && lower !== "none" && lower !== "n/a") {
          answers.push({ question: q.label, answer: trimmed });
        }
      } catch (e) {}
    });
  }

  // Reply immediately — no deferReply, no "thinking..." spinner
  await interaction.reply({
    components: [TicketUI.buildSuccess("Ticket Creating", "Your answers have been submitted! Your ticket is opening now, please wait...")],
    flags: TicketUI.getEphemeralFlags()
  }).catch(() => {});

  // Store interaction so Create.js can editReply with the real channel link
  client.pendingTicketInteractions = client.pendingTicketInteractions || new Map();
  const pendingKey2 = `${guildId}_${userId}`;
  client.pendingTicketInteractions.set(pendingKey2, interaction);
  setTimeout(() => client.pendingTicketInteractions?.delete(pendingKey2), 60_000);

  await client.db.createTicket(guildId, panelId, categoryId, userId, { answers });
}

async function handleCloseModalSubmit(interaction, client) {
  // Guard: if already replied, bail silently
  if (interaction.replied || interaction.deferred) return;

  const ticketId = interaction.customId.replace("close_modal_", "");
  const reason = interaction.fields.getTextInputValue("reason")?.trim() || null;

  const ticket = await client.db.getTicket(ticketId).catch(() => null);
  if (!ticket) {
    return interaction.reply({
      components: [TicketUI.buildError("Ticket Not Found", "The ticket could not be located.")],
      flags: TicketUI.getEphemeralFlags()
    }).catch(() => {});
  }

  if (ticket.status === "closed") {
    return interaction.reply({
      components: [TicketUI.buildWarning("Already Closed", "This ticket is already closed.")],
      flags: TicketUI.getEphemeralFlags()
    }).catch(() => {});
  }

  // Acknowledge instantly before async DB write
  await interaction.reply({
    components: [TicketUI.buildSuccess("Ticket Closed", "The ticket has been closed successfully.")],
    flags: TicketUI.getEphemeralFlags()
  }).catch(() => {});

  // Now do the heavy work after replying
  await client.db.closeTicket(ticketId, interaction.user.id, reason).catch(() => {});
}

async function checkPermissions(interaction, client, ticket, action) {
  const panel = await client.db.getPanel(ticket.panelId);
  if (!panel) return false;

  const category = panel.categories.find(c => c.categoryId === ticket.categoryId);
  if (!category) return false;

  const staffRoles = await client.db.getStaffRoles(interaction.guild.id);
  const hasStaffRole = interaction.member.roles.cache.some(r => staffRoles.includes(r.id));
  const hasSupportRole = interaction.member.roles.cache.some(r => category.supportRoles.includes(r.id));
  const isTicketOwner = interaction.user.id === ticket.userId;
  const hasManageChannels = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

  if (action === "close") {
    return hasManageChannels || hasStaffRole || hasSupportRole || (category.settings.userCanClose && isTicketOwner);
  }

  return hasManageChannels || hasStaffRole || hasSupportRole;
}

async function getTicketFromChannel(interaction, client) {
  const ticket = await client.db.getTicketByChannelAny(interaction.channelId);

  if (!ticket) {
    await safeReply(interaction, {
      components: [TicketUI.buildError("Invalid Channel", "This is not a ticket channel.")],
      flags: TicketUI.getEphemeralFlags()
    });
    return null;
  }

  return ticket;
}

async function handleTicketClose(interaction, client) {
  const ticket = await getTicketFromChannel(interaction, client);
  if (!ticket) return;

  if (ticket.status === "closed") {
    return safeReply(interaction, {
      components: [TicketUI.buildWarning("Already Closed", "This ticket is already closed.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  const canClose = await checkPermissions(interaction, client, ticket, "close");

  if (!canClose) {
    return safeReply(interaction, {
      components: [TicketUI.buildError("Permission Denied", "You don't have permission to close this ticket.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`close_modal_${ticket.ticketId}`)
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

  await interaction.showModal(modal);
}

async function handleTicketAddUser(interaction, client) {
  const userId = interaction.values?.[0];
  if (!userId) {
    return safeReply(interaction, {
      components: [TicketUI.buildError("No User Selected", "Please select a user to add.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  // deferUpdate = silent acknowledgement, no loading spinner
  await interaction.deferUpdate().catch(() => {});

  const ticketId = interaction.customId.replace("ticket_add_user_", "");
  const ticket = await client.db.getTicket(ticketId);
  if (!ticket) {
    return interaction.followUp({
      components: [TicketUI.buildError("Ticket Not Found", "The ticket could not be located.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  if (ticket.status === "closed") {
    return interaction.followUp({
      components: [TicketUI.buildWarning("Ticket Closed", "Cannot add users to a closed ticket.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  const canAdd = await checkPermissions(interaction, client, ticket, "add");
  if (!canAdd) {
    return interaction.followUp({
      components: [TicketUI.buildError("Permission Denied", "You don't have permission to add users to this ticket.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  if (userId === ticket.userId) {
    return interaction.followUp({
      components: [TicketUI.buildWarning("Invalid User", "The ticket creator is already part of this ticket.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  const addedUsers = await client.db.getAddedUsers(ticketId);
  if (addedUsers.length >= 5) {
    return interaction.followUp({
      components: [TicketUI.buildWarning("Maximum Users Reached", "A maximum of 5 users can be added to a ticket.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  const isAlreadyAdded = await client.db.isUserAdded(ticketId, userId);
  if (isAlreadyAdded) {
    return interaction.followUp({
      components: [TicketUI.buildInfo("User Already Added", "This user already has access to the ticket.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  await client.db.addTicketUser(ticketId, userId, interaction.user.id);
}

async function handleTicketRemoveUser(interaction, client) {
  const userId = interaction.values?.[0];
  if (!userId) {
    return safeReply(interaction, {
      components: [TicketUI.buildError("No User Selected", "Please select a user to remove.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  // deferUpdate = silent acknowledgement, no loading spinner
  await interaction.deferUpdate().catch(() => {});

  const ticketId = interaction.customId.replace("ticket_remove_user_", "");
  const ticket = await client.db.getTicket(ticketId);
  if (!ticket) {
    return interaction.followUp({
      components: [TicketUI.buildError("Ticket Not Found", "The ticket could not be located.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  if (ticket.status === "closed") {
    return interaction.followUp({
      components: [TicketUI.buildWarning("Ticket Closed", "Cannot remove users from a closed ticket.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  const canRemove = await checkPermissions(interaction, client, ticket, "remove");
  if (!canRemove) {
    return interaction.followUp({
      components: [TicketUI.buildError("Permission Denied", "You don't have permission to remove users from this ticket.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  await client.db.removeTicketUser(ticketId, userId, interaction.user.id);
}

async function handleTicketRate(interaction, client) {
  let ticketId, stars;
  if (interaction.customId.startsWith("ticket_rate_btn_")) {
    const raw = interaction.customId.replace("ticket_rate_btn_", "");
    const lastUnderscore = raw.lastIndexOf("_");
    ticketId = raw.substring(0, lastUnderscore);
    stars = parseInt(raw.substring(lastUnderscore + 1), 10);
  } else if (interaction.values?.[0]) {
    ticketId = interaction.customId.replace("ticket_rate_", "");
    stars = parseInt(interaction.values[0], 10);
  } else {
    return;
  }

  if (!ticketId || isNaN(stars)) return;

  const ticket = await client.db.getTicket(ticketId);

  if (!ticket) {
    return safeReply(interaction, {
      components: [TicketUI.buildError("Ticket Not Found", "The ticket could not be located.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  if (interaction.user.id !== ticket.userId) {
    return safeReply(interaction, {
      components: [TicketUI.buildError("Permission Denied", "Only the ticket creator can provide a rating.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  if (ticket.rating?.stars) {
    return safeReply(interaction, {
      components: [TicketUI.buildInfo("Already Rated", "You have already submitted a rating for this ticket.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  // Save 1-click rating directly to database & return instant response
  await client.db.rateTicket(ticketId, stars, null);

  const starDisplay = emoji.starFill.repeat(stars) + emoji.starEmpty.repeat(5 - stars);
  return safeReply(interaction, {
    components: [TicketUI.buildSuccess("Thank You!", `Your **${starDisplay} (${stars}/5)** rating has been recorded successfully.`)],
    flags: TicketUI.getEphemeralFlags()
  });
}

async function handleTicketReopen(interaction, client) {
  const ticket = await getTicketFromChannel(interaction, client);
  if (!ticket) return;

  if (ticket.status === "open") {
    return safeReply(interaction, {
      components: [TicketUI.buildInfo("Already Open", "This ticket is already open.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  const canReopen = await checkPermissions(interaction, client, ticket, "reopen");

  if (!canReopen) {
    return safeReply(interaction, {
      components: [TicketUI.buildError("Permission Denied", "You don't have permission to reopen this ticket.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  await safeReply(interaction, {
    components: [TicketUI.buildConfirmation(
      `${emoji.unlock} Reopen Ticket`,
      "Are you sure you want to reopen this ticket? This will restore full access and allow continued support.",
      `confirm_reopen_${ticket.ticketId}`,
      `cancel_reopen_${ticket.ticketId}`,
      "Confirm Reopen",
      "Success"
    )],
    flags: TicketUI.getEphemeralFlags()
  });
}

async function handleConfirmReopen(interaction, client) {
  await interaction.deferUpdate();
  const ticketId = interaction.customId.replace("confirm_reopen_", "");

  const ticket = await client.db.getTicket(ticketId);

  if (!ticket) {
    return interaction.editReply({
      components: [TicketUI.buildError("Ticket Not Found", "The ticket could not be located.")],
      flags: TicketUI.getFlags()
    });
  }

  if (ticket.status === "open") {
    return interaction.editReply({
      components: [TicketUI.buildInfo("Already Open", "This ticket is already open.")],
      flags: TicketUI.getFlags()
    });
  }

  await client.db.reopenTicket(ticketId);

  await interaction.editReply({
    components: [TicketUI.buildSuccess("Ticket Reopened", "The ticket has been successfully reopened and is now active.")],
    flags: TicketUI.getFlags()
  });
}

async function handleCancelReopen(interaction, client) {
  await interaction.update({
    components: [TicketUI.buildInfo("Action Cancelled", "The reopen request has been cancelled.")],
    flags: TicketUI.getFlags()
  });
}

async function handleTicketDelete(interaction, client) {
  const ticket = await getTicketFromChannel(interaction, client);
  if (!ticket) return;

  const canDelete = await checkPermissions(interaction, client, ticket, "delete");

  if (!canDelete) {
    return safeReply(interaction, {
      components: [TicketUI.buildError("Permission Denied", "You don't have permission to delete this ticket.")],
      flags: TicketUI.getEphemeralFlags()
    });
  }

  await safeReply(interaction, {
    components: [TicketUI.buildConfirmation(
      `${emoji.logs} Delete Ticket`,
      "This will **permanently delete** the ticket channel and all its contents.\n\n**This action cannot be undone!**\n\nAre you absolutely sure?",
      `confirm_delete_${ticket.ticketId}`,
      `cancel_delete_${ticket.ticketId}`,
      "Confirm Delete"
    )],
    flags: TicketUI.getEphemeralFlags()
  });
}

async function handleConfirmDelete(interaction, client) {
  await interaction.deferUpdate();
  const ticketId = interaction.customId.replace("confirm_delete_", "");
  const ticket = await client.db.getTicket(ticketId);

  if (!ticket) {
    return interaction.editReply({
      components: [TicketUI.buildError("Ticket Not Found", "The ticket could not be located.")],
      flags: TicketUI.getFlags()
    });
  }

  await client.db.deleteTicket(ticketId);

  await interaction.editReply({
    components: [TicketUI.buildSuccess("Ticket Deleted", "The ticket channel will be deleted momentarily.")],
    flags: TicketUI.getFlags()
  });
}

async function handleCancelDelete(interaction, client) {
  await interaction.update({
    components: [TicketUI.buildInfo("Action Cancelled", "The delete request has been cancelled.")],
    flags: TicketUI.getFlags()
  });
}

async function handleHelpSelect(interaction, client) {
  const selectedCategory = interaction.values?.[0];
  if (!selectedCategory) return;
  if (interaction.replied || interaction.deferred) return;
  const currentPrefix = (await client.db.getPrefix(interaction.guild.id)) || ".";
  const botAvatarURL = client.user.displayAvatarURL({ size: 256 });
  const container = buildHelpPanel(selectedCategory, botAvatarURL, currentPrefix);
  await interaction.update({
    components: [container],
    flags: TicketUI.getFlags(),
  }).catch(() => {});
}

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
