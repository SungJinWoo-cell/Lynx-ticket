
import mongoose from "mongoose";

const guildSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    prefix: {
      type: String,
      default: "b",
    },
    blacklistedUsers: [
      {
        userId: String,
        reason: String,
        blacklistedAt: { type: Date, default: Date.now },
        blacklistedBy: String,
      },
    ],
    staffRoles: [String],
  },
  { timestamps: true }
);

const categorySchema = new mongoose.Schema({
  categoryId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: String,
  emoji: String,
  supportRoles: [String],
  ticketChannelCategory: String,
  namingFormat: {
    type: String,
    default: "ticket-{username}-{number}",
  },
  settings: {
    pingUser: { type: Boolean, default: true },
    pingRole: { type: Boolean, default: false },
    userCanClose: { type: Boolean, default: true },
    maxTicketsPerUser: { type: Number, default: 1 },
    dmUserOnOpen: { type: Boolean, default: true },
    dmUserOnClose: { type: Boolean, default: true },
    welcomeMessage: String,
    aiEnabled: { type: Boolean, default: false },
    aiPrompt: {
      type: String,
      default: "You are Titan AI, an expert and polite customer support assistant for this Discord server. Provide clear, concise, and helpful answers to user questions.",
    },
    aiApiKey: { type: String, default: "" },
  },
  questions: [
    {
      label: { type: String, required: true },
      placeholder: String,
      style: { type: String, default: "short" },
      required: { type: Boolean, default: true },
    },
  ],
  isActive: {
    type: Boolean,
    default: true,
  },
});

const panelSchema = new mongoose.Schema(
  {
    panelId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    guildId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    channelId: String,
    displayType: {
      type: String,
      enum: ["select", "buttons"],
      default: "select",
    },
    panelMessage: {
      title: { type: String, default: "Ticket Panel" },
      description: { type: String, default: "Select a category below to create a ticket" }
    },
    messageId: String,
    categories: [categorySchema],
    selectMenuConfig: {
      placeholder: {
        type: String,
        default: "Select a ticket category",
      },
      minValues: { type: Number, default: 1 },
      maxValues: { type: Number, default: 1 },
    },
    logs: {
      createChannel: String,
      closeChannel: String,
      deleteChannel: String,
      userAddChannel: String,
      userRemoveChannel: String,
      ratingChannel: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    guildId: {
      type: String,
      required: true,
      index: true,
    },
    panelId: {
      type: String,
      required: true,
      index: true,
    },
    categoryId: {
      type: String,
      required: true,
    },
    channelId: String,
    userId: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
      index: true,
    },
    answers: [
      {
        question: String,
        answer: String,
      },
    ],
    addedUsers: [
      {
        userId: String,
        addedBy: String,
        addedAt: { type: Date, default: Date.now },
      },
    ],
    removedUsers: [
      {
        userId: String,
        removedBy: String,
        removedAt: { type: Date, default: Date.now },
      },
    ],
    controlMessageId: String,
    claimedBy: { type: String, default: null },
    claimedAt: { type: Date, default: null },
    lastActivity: { type: Date, default: Date.now },
    autoCloseAt: { type: Date, default: null },
    closedBy: String,
    closedAt: Date,
    closeReason: String,
    rating: {
      stars: { type: Number, min: 1, max: 5 },
      feedback: String,
      ratedAt: Date,
    },
  },
  { timestamps: true }
);

panelSchema.index({ guildId: 1, isActive: 1 });
ticketSchema.index({ guildId: 1, status: 1 });
ticketSchema.index({ userId: 1, status: 1 });
ticketSchema.index({ panelId: 1, categoryId: 1 });

export const Guild = mongoose.model("Guild", guildSchema);
export const Panel = mongoose.model("Panel", panelSchema);
export const Ticket = mongoose.model("Ticket", ticketSchema);

/**
 * Copyright (c) 2025 Titan X Development
 * Code by Titan X Development
 * MIT License
 */
