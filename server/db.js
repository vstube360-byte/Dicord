const fs = require("fs");
const crypto = require("crypto");
const { URL } = require("url");
const { DB_FILE } = require("./config");

// Keep the object reference constant to prevent reference disconnection when imported by other modules
const db = {
  users: {},
  sessions: {},
  conversations: {}
};

// Load database from file
function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf8");
      const data = JSON.parse(content);
      db.users = data.users || {};
      db.sessions = data.sessions || {};
      db.conversations = data.conversations || {};
      console.log("Local JSON database loaded successfully.");
    } else {
      saveDbSync();
      console.log("Created a new local data.json database.");
    }
  } catch (err) {
    console.error("Failed to load database file:", err.message);
  }
}

// Save database to file synchronously
function saveDbSync() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save database file synchronously:", err.message);
  }
}

// Queue / Promise-based atomic async save to prevent simultaneous write corruptions
let isSaving = false;
let saveScheduled = false;

async function saveDb() {
  if (isSaving) {
    saveScheduled = true;
    return;
  }
  isSaving = true;
  try {
    const tempFile = DB_FILE + ".tmp";
    await fs.promises.writeFile(tempFile, JSON.stringify(db, null, 2), "utf8");
    await fs.promises.rename(tempFile, DB_FILE);
  } catch (err) {
    console.error("Failed to save database asynchronously:", err.message);
  } finally {
    isSaving = false;
    if (saveScheduled) {
      saveScheduled = false;
      saveDb();
    }
  }
}

// Load DB immediately upon file initialization
loadDb();

function sanitizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

function sanitizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 32);
}

function sanitizeMessage(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .trim()
    .slice(0, 1000);
}

function sanitizeId(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .slice(0, 80);
}

function sanitizeReaction(value) {
  return String(value || "").trim().slice(0, 16);
}

function sanitizeAvatar(avatar) {
  const value = String(avatar || "").trim();
  if (!value) {
    return "";
  }

  const isValidFormat = value.startsWith("data:") || 
                        value.startsWith("http://") || 
                        value.startsWith("https://") || 
                        value.startsWith("/");
  return isValidFormat && value.length <= 50000000 ? value : "";
}

function sanitizeGifUrl(url) {
  const value = String(url || "").trim();
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }

    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    if (host.includes("giphy.com") && !host.includes("media.giphy.com") && !path.endsWith(".gif") && !path.includes("/media/")) {
      const parts = parsed.pathname.split("-").filter(Boolean);
      const id = parts[parts.length - 1];
      if (id) {
        return `https://media.giphy.com/media/${id}/giphy.gif`;
      }
    }

    return parsed.toString().slice(0, 500);
  } catch (error) {
    return "";
  }
}

function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashPassword(password, salt) {
  return crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

function publicUser(user) {
  return {
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar || "",
    createdAt: user.createdAt,
    blockedUsers: user.blockedUsers || [],
    mutedUsers: user.mutedUsers || [],
    status: user.status || "offline",
    lastActive: user.lastActive || user.createdAt,
    bio: user.bio || "",
    pronouns: user.pronouns || "",
    bannerColor: user.bannerColor || "",
    bannerImage: user.bannerImage || "",
    customStatus: user.customStatus || "",
    website: user.website || "",
    theme: user.theme || "indigo",
    appTheme: user.appTheme || "dark",
    privacySettings: user.privacySettings || { showPronouns: true, showBio: true, showWebsite: true },
    badges: user.badges || [],
    chatWallpaper: user.chatWallpaper || "",
    hasRecoveryPassword: !!user.recoveryHash
  };
}

function conversationId(first, second) {
  return [first, second].sort().join("__");
}

async function ensureConversation(first, second) {
  const id = conversationId(first, second);
  let conversation = db.conversations[id];
  
  if (!conversation) {
    conversation = {
      id,
      participants: [first, second].sort(),
      createdAt: new Date().toISOString(),
      messages: []
    };
    db.conversations[id] = conversation;
    await saveDb();
  }
  
  conversation.messages = (conversation.messages || []).map((message) => ({
    reactions: {},
    replyTo: null,
    ...message
  }));
  return conversation;
}

function getPeer(conversation, username) {
  return conversation.participants.find((entry) => entry !== username) || "";
}

async function authenticate(token) {
  if (!token) return null;
  const session = db.sessions[String(token)];
  if (!session) {
    return null;
  }
  const user = db.users[session.username];
  if (!user) {
    return null;
  }
  return user;
}

module.exports = {
  db,
  loadDb,
  saveDbSync,
  saveDb,
  sanitizeUsername,
  sanitizeName,
  sanitizeMessage,
  sanitizeId,
  sanitizeReaction,
  sanitizeAvatar,
  sanitizeGifUrl,
  randomToken,
  hashPassword,
  publicUser,
  conversationId,
  ensureConversation,
  getPeer,
  authenticate
};
