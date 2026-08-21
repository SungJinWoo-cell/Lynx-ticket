# 🎫 Titan X Ticket Bot System

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=for-the-badge&logo=JavaScript&logoColor=black" alt="JavaScript"/>
  <img src="https://img.shields.io/badge/discord.js-v14-5865F2.svg?style=for-the-badge&logo=discorddotjs&logoColor=white" alt="discord.js"/>
  <img src="https://img.shields.io/badge/Node.js-v18+-339933.svg?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/MongoDB-Supported-13aa52.svg?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB"/>
</p>

---

## 🌟 Overview

**Titan X Ticket System** is an enterprise-grade, highly customizable, production-ready Discord ticket bot built with `discord.js` v14 and MongoDB. Developed by **Titan X Development**, it offers automated support workflows, interactive control panels, pre-ticket setup questionnaires, HTML transcript generation, dynamic custom emojis, and live analytics.

---

## ✨ Key Features

### 🎨 Modern Components v2 UI & Dynamic Emojis
- **Dynamic Emoji Resolution:** Automatically detects and loads custom emojis from any server the bot joins.
- **Components v2 Layouts:** Clean, aesthetic Discord containers, sections, and select menus.
- **Dual Interface:** Full support for both **Prefix Commands** (`.help`, `.claim`, etc.) and **Slash Commands** (`/help`, `/claim`, etc.).

### 📋 Interactive Ticket Panels & Setup Questions
- **Flexible Display Modes:** Support for both Dropdown Select Menus and Interactive Buttons.
- **Pre-Ticket Questionnaires:** Collect user details with custom modal setup forms before ticket creation.
- **Auto-Reset UI:** Select menus automatically reset state so users can seamlessly open multiple tickets.

### 🛠️ Advanced Ticket Management
- **Claim & Unclaim:** Dedicated `.claim` / `.unclaim` commands for staff assignment.
- **User Permission Control:** Easily `.add @user` or `.remove @user` from active tickets.
- **HTML Transcripts:** Generate complete, downloadable HTML transcripts of ticket channels.
- **Rating System:** Star rating modal & feedback collection when tickets are closed.
- **Inactivity Auto-Close:** Automated background worker closes tickets after 24 hours of inactivity.
- **Smart Direct Messages:** Sends DM notifications to users on ticket creation & closure with direct clickable server links.

### 📊 System Analytics & Security
- **Server & Global Stats:** Detailed statistics for your server and live network-wide metrics from MongoDB.
- **Blacklist System:** Ban abusive users from opening support tickets.
- **Dynamic Guild Prefixes:** Per-server custom prefix configuration (`.prefix !`).

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18.0.0 or higher
- **MongoDB** database instance (Local MongoDB or MongoDB Atlas)
- **Discord Bot Token** (obtainable via [Discord Developer Portal](https://discord.com/developers/applications))

---

### 📥 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Deekshithreddydev/TICKET-BOT-TITAN-X-DEVVELOPMENT-.git
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment (`.env`):**
   Copy `.env.example` to `.env` or create a `.env` file in the root directory:
   ```env
   TOKEN=your_discord_bot_token_here
   CLIENT_ID=your_discord_client_id_here
   MONGO_URI=your_mongodb_connection_string_here
   PREFIX=.
   ```

4. **Start the Bot:**
   ```bash
   npm start
   ```

---

## ⚙️ Environment Variables

| Variable | Description | Required | Default |
| :--- | :--- | :--- | :--- |
| `TOKEN` | Discord Bot Token from Developer Portal | **Yes** | — |
| `CLIENT_ID` | Application Client ID | **Yes** | — |
| `MONGO_URI` | MongoDB Connection Connection String | **Yes** | — |
| `PREFIX` | Default prefix for non-slash commands | No | `.` |

---

## 🎮 Command Reference

| Command | Usage | Description | Permission |
| :--- | :--- | :--- | :--- |
| `help` | `.help` / `/help` | Interactive command guide & help panel | Everyone |
| `panel` | `.panel` / `/panel` | Interactive panel builder & deployer | Manage Channels |
| `settings` | `.settings` / `/settings` | Server ticket settings & staff roles | Manage Channels |
| `claim` | `.claim` / `/claim` | Staff claim a ticket | Staff / Support |
| `unclaim` | `.unclaim` / `/unclaim` | Unclaim a previously claimed ticket | Staff / Support |
| `close` | `.close [reason]` | Close an active ticket | Staff / Ticket Owner |
| `reopen` | `.reopen` | Reopen a closed ticket | Staff |
| `delete` | `.delete` | Delete ticket channel permanently | Staff |
| `add` | `.add <@user>` | Grant user access to ticket | Staff / Support |
| `remove` | `.remove <@user>` | Revoke user access from ticket | Staff / Support |
| `transcript` | `.transcript` | Generate HTML transcript of ticket | Staff / Support |
| `prefix` | `.prefix [new]` | View or change server prefix | Manage Guild |
| `stats` | `.stats` / `/stats` | View live server & global DB statistics | Staff |
| `blacklist` | `.blacklist <add/remove/list>` | Manage blacklisted users | Manage Guild |

---

## 🤝 Support & Links

- **Official Support Server:** [Join Support Server](https://discord.gg/TEpxUwQwaC)
- **Developed by:** Titan X Development

---

© 2025 **Titan X Development**. Licensed under the MIT License.
