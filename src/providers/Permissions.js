
import { PermissionFlagsBits } from "discord.js";

const permissionNames = new Map();

for (const [name, value] of Object.entries(PermissionFlagsBits)) {
  permissionNames.set(
    value,
    name.split(/(?=[A-Z])/).join(" ").replace(/^./, s => s.toUpperCase())
  );
}

export function canUseCommand(member, command, staffRoleIds) {
  if (command.staffOnly) {
    if (!member.roles.cache.some(r => staffRoleIds.includes(r.id))) return false;
  }

  if (command.userPermissions?.length) {
    for (const perm of command.userPermissions) {
      if (!member.permissions.has(perm)) return false;
    }
  }

  return true;
}

export function getMissingBotPermissions(channel, permissions) {
  const botPerms = channel.guild.members.me.permissionsIn(channel);
  const missing = [];
  for (const perm of permissions) {
    if (!botPerms.has(perm)) {
      missing.push(permissionNames.get(perm) || "Unknown Permission");
    }
  }
  return missing;
}

export function getUserPermissionsList(userPermissions) {
  if (!userPermissions?.length) return null;
  return userPermissions
    .map(p => permissionNames.get(p) || "Unknown Permission")
    .join(", ");
}

export async function validateCommand(ctx, command) {
  const { interaction, message, client } = ctx;
  const user = interaction?.user || message?.author;
  const channel = interaction?.channel || message?.channel;
  const guild = interaction?.guild || message?.guild;

  const member =
    interaction?.member ||
    guild.members.cache.get(user.id) ||
    (await guild.members.fetch(user.id));

  const staffRoleIds = await client.db.getStaffRoles(guild.id);

  if (!canUseCommand(member, command, staffRoleIds)) {
    const perms = getUserPermissionsList(command.userPermissions);
    return {
      valid: false,
      error: {
        title: "Insufficient Permissions",
        description: perms ? `Required: \`${perms}\`` : "Permission denied",
      },
    };
  }

  if (command.permissions?.length) {
    const missing = getMissingBotPermissions(channel, command.permissions);
    if (missing.length) {
      return {
        valid: false,
        error: {
          title: "Missing Bot Permissions",
          description: `Required: \`${missing.join(", ")}\``,
        },
      };
    }
  }

  if (command.ticketOnly) {
    const isTicket = await client.db.isTicketChannel(channel.id);
    if (!isTicket) {
      return {
        valid: false,
        error: {
          title: "Ticket Only",
          description: "Command usable only in ticket channels",
        },
      };
    }
  }

  return { valid: true };
}

// crumbs in source

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
