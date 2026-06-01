const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const Busboy = require("busboy");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DIST_DIR = path.join(__dirname, "dist");
const DB_FILE = path.join(__dirname, "data.json");
const uploadsDir = path.join(__dirname, "uploads");

// Ensure uploads folder exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const clientsByUser = new Map();

// Local Database State
let db = {
  users: {},
  sessions: {},
  conversations: {}
};

// Load database from file
function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf8");
      db = JSON.parse(content);
      db.users = db.users || {};
      db.sessions = db.sessions || {};
      db.conversations = db.conversations || {};
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

// Load DB on startup
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
    chatWallpaper: user.chatWallpaper || ""
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

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendEvent(username, payload) {
  const clients = clientsByUser.get(username);
  if (!clients) {
    return;
  }

  const event = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    client.write(event);
  }
}

function broadcastPresence(username, status, lastActive) {
  const payload = { event: "presence", username, status, lastActive };
  const event = `data: ${JSON.stringify(payload)}\n\n`;
  for (const clients of clientsByUser.values()) {
    for (const client of clients) {
      client.write(event);
    }
  }
}

async function addClient(username, response) {
  if (!clientsByUser.has(username)) {
    clientsByUser.set(username, new Set());
  }
  const clients = clientsByUser.get(username);
  const wasOffline = clients.size === 0;
  clients.add(response);
  
  if (wasOffline) {
    const lastActive = new Date().toISOString();
    try {
      if (db.users[username]) {
        db.users[username].status = "online";
        db.users[username].lastActive = lastActive;
        await saveDb();
      }
      broadcastPresence(username, "online", lastActive);
    } catch (err) {
      console.error(`Failed to update status to online for ${username}:`, err.message);
    }
  }
}

async function removeClient(username, response) {
  const clients = clientsByUser.get(username);
  if (!clients) {
    return;
  }
  clients.delete(response);
  if (clients.size === 0) {
    clientsByUser.delete(username);
    const lastActive = new Date().toISOString();
    try {
      if (db.users[username]) {
        db.users[username].status = "offline";
        db.users[username].lastActive = lastActive;
        await saveDb();
      }
      broadcastPresence(username, "offline", lastActive);
    } catch (err) {
      console.error(`Failed to update status to offline for ${username}:`, err.message);
    }
  }
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    request.setEncoding("utf8");
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 50_000_000) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

function fetchText(targetUrl, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error("Too many redirects"));
      return;
    }

    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (error) {
      reject(new Error("Invalid URL"));
      return;
    }

    const transport = parsed.protocol === "https:" ? https : http;
    const request = transport.get(
      targetUrl,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 ChatAppResolver",
          Accept: "text/html,application/xhtml+xml"
        }
      },
      (response) => {
        const statusCode = response.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(statusCode) && response.headers.location) {
          const nextUrl = new URL(response.headers.location, targetUrl).toString();
          response.resume();
          fetchText(nextUrl, redirects + 1).then(resolve).catch(reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`Failed to fetch URL (${statusCode})`));
          return;
        }

        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
          if (body.length > 2_000_000) {
            request.destroy(new Error("Response too large"));
          }
        });
        response.on("end", () => resolve(body));
      }
    );

    request.on("error", reject);
  });
}

function extractGifCandidate(html, pageUrl) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      try {
        return new URL(match[1], pageUrl).toString();
      } catch (error) {
        return match[1];
      }
    }
  }

  return "";
}

async function resolveGifUrl(url) {
  const directUrl = sanitizeGifUrl(url);
  if (!directUrl) {
    return "";
  }

  if (/\.(gif|webp|png|jpg|jpeg)(\?|$)/i.test(directUrl)) {
    return directUrl;
  }

  try {
    const html = await fetchText(directUrl);
    return sanitizeGifUrl(extractGifCandidate(html, directUrl));
  } catch (error) {
    return directUrl;
  }
}

async function resolveEmbed(targetUrl) {
  try {
    const html = await fetchText(targetUrl);
    
    const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
                       html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    const descMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i) ||
                      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const description = descMatch ? descMatch[1].trim() : "";

    const imageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
                       html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    let image = imageMatch ? imageMatch[1].trim() : "";
    if (image) {
      try {
        image = new URL(image, targetUrl).toString();
      } catch (e) {
        // ignore
      }
    }

    const parsedUrl = new URL(targetUrl);
    const siteName = parsedUrl.hostname.replace("www.", "");

    return {
      url: targetUrl,
      title,
      description,
      image,
      siteName
    };
  } catch (err) {
    console.error("Failed to resolve embed:", err.message);
    return null;
  }
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogg": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".pdf": "application/pdf",
    ".txt": "text/plain; charset=utf-8"
  };

  return types[extension] || "application/octet-stream";
}

function serveFile(requestPath, response) {
  if (process.env.API_ONLY === "true") {
    sendJson(response, 404, { error: "Static app is served by Vite in dev mode." });
    return;
  }

  const staticRoot = fs.existsSync(path.join(DIST_DIR, "index.html")) ? DIST_DIR : PUBLIC_DIR;
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  let filePath = path.normalize(path.join(staticRoot, normalizedPath));

  if (!filePath.startsWith(staticRoot)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      filePath = path.join(staticRoot, "index.html");
      fs.readFile(filePath, (fallbackError, fallbackContent) => {
        if (fallbackError) {
          sendJson(response, 404, { error: "Not found" });
          return;
        }

        const headers = { "Content-Type": getContentType(filePath) };
        if (filePath.endsWith("index.html")) {
          headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
        }
        response.writeHead(200, headers);
        response.end(fallbackContent);
      });
      return;
    }

    const headers = { "Content-Type": getContentType(filePath) };
    if (filePath.endsWith("index.html")) {
      headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
    }
    response.writeHead(200, headers);
    response.end(content);
  });
}

function serveUpload(requestPath, response) {
  const fileName = path.basename(requestPath);
  const filePath = path.join(uploadsDir, fileName);

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(response, 404, { error: "File not found" });
      return;
    }

    response.writeHead(200, {
      "Content-Type": getContentType(filePath),
      "Cache-Control": "public, max-age=31536000"
    });
    response.end(content);
  });
}

function handleUpload(request, response) {
  return new Promise((resolve, reject) => {
    let busboy;
    try {
      busboy = Busboy({ headers: request.headers });
    } catch (err) {
      sendJson(response, 400, { error: "Failed to parse multipart request headers." });
      resolve();
      return;
    }

    let fileUploaded = false;

    busboy.on("file", (name, fileStream, info) => {
      const { filename, mimeType } = info;
      fileUploaded = true;

      const fileId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${filename.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const filePath = path.join(uploadsDir, fileId);
      const writeStream = fs.createWriteStream(filePath);

      let fileSize = 0;
      fileStream.on("data", (chunk) => {
        fileSize += chunk.length;
      });

      fileStream.pipe(writeStream);

      writeStream.on("finish", () => {
        let type = "document";
        if (mimeType.startsWith("image/")) {
          type = "image";
        } else if (mimeType.startsWith("video/")) {
          type = "video";
        }

        const publicUrl = `/uploads/${fileId}`;
        sendJson(response, 200, { 
          url: publicUrl,
          type: type,
          name: filename,
          size: fileSize
        });
        resolve();
      });

      writeStream.on("error", (err) => {
        sendJson(response, 500, { error: "Failed to upload file to local storage: " + err.message });
        resolve();
      });
    });

    busboy.on("error", (err) => {
      sendJson(response, 400, { error: "Error parsing upload: " + err.message });
      resolve();
    });

    busboy.on("finish", () => {
      if (!fileUploaded) {
        sendJson(response, 400, { error: "No file was uploaded." });
        resolve();
      }
    });

    request.pipe(busboy);
  });
}

async function runCleanupJob() {
  console.log("Starting database and media cleanup job...");
  try {
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let anyModified = false;

    for (const id of Object.keys(db.conversations)) {
      const conversation = db.conversations[id];
      let conversationModified = false;
      const initialMessageCount = conversation.messages ? conversation.messages.length : 0;
      
      if (!conversation.messages || conversation.messages.length === 0) {
        continue;
      }

      // Filter messages to delete any message older than 7 days
      let messages = conversation.messages.filter(msg => {
        const msgDate = new Date(msg.createdAt);
        return msgDate >= sevenDaysAgo;
      });

      if (messages.length !== initialMessageCount) {
        conversationModified = true;
      }

      // Process messages between 48 hours and 7 days old to remove media files
      messages = await Promise.all(messages.map(async (msg) => {
        const msgDate = new Date(msg.createdAt);
        
        if (msgDate < fortyEightHoursAgo && msg.mediaUrl) {
          console.log(`Expiring media for message ${msg.id}`);
          
          try {
            if (msg.mediaUrl.startsWith("/uploads/")) {
              const filename = path.basename(msg.mediaUrl);
              const filePath = path.join(uploadsDir, filename);
              if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
                console.log(`Deleted media file from local storage: ${filename}`);
              }
            }
          } catch (storageErr) {
            console.error(`Failed to delete media file from local storage for message ${msg.id}:`, storageErr.message);
          }

          msg.mediaUrl = "";
          msg.mediaType = "";
          msg.mediaSize = 0;
          if (!msg.text) {
            msg.text = "[Media deleted after 48h]";
          }
          conversationModified = true;
        }
        
        return msg;
      }));

      if (conversationModified) {
        db.conversations[id].messages = messages;
        anyModified = true;
        console.log(`Updated conversation ${id}: removed expired messages/media.`);
      }
    }

    if (anyModified) {
      await saveDb();
    }
  } catch (err) {
    console.error("Error running cleanup job:", err);
  }
}

async function handleApi(request, response, requestUrl) {
  if (request.method === "POST" && requestUrl.pathname === "/api/upload-media") {
    const token = requestUrl.searchParams.get("token");
    const user = await authenticate(token);
    if (!user) {
      sendJson(response, 401, { error: "Please sign in again." });
      return;
    }
    await handleUpload(request, response);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/resolve-gif") {
    const gifUrl = await resolveGifUrl(requestUrl.searchParams.get("url"));
    if (!gifUrl) {
      sendJson(response, 400, { error: "Could not resolve GIF URL." });
      return;
    }
    sendJson(response, 200, { gifUrl });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/resolve-embed") {
    const urlParam = requestUrl.searchParams.get("url");
    if (!urlParam) {
      sendJson(response, 400, { error: "URL parameter required." });
      return;
    }

    const urlLower = urlParam.toLowerCase().split('?')[0];

    // 1. Direct Image check
    if (/\.(gif|png|jpg|jpeg|webp)(\?|$)/i.test(urlLower)) {
      sendJson(response, 200, { type: "image", url: urlParam });
      return;
    }

    // 2. Direct Video check
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(urlLower)) {
      sendJson(response, 200, { type: "video", url: urlParam });
      return;
    }

    // 3. Giphy/GIF URL check
    const resolvedGif = await resolveGifUrl(urlParam);
    if (resolvedGif && resolvedGif !== urlParam) {
      sendJson(response, 200, { type: "gif", url: resolvedGif });
      return;
    }

    // 4. Website page resolution
    const embed = await resolveEmbed(urlParam);
    if (!embed) {
      const parsedUrl = new URL(urlParam);
      sendJson(response, 200, {
        type: "embed",
        url: urlParam,
        title: parsedUrl.hostname,
        description: "",
        image: "",
        siteName: parsedUrl.hostname.replace("www.", "")
      });
      return;
    }

    sendJson(response, 200, { type: "embed", ...embed });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/register") {
    const body = await parseBody(request);
    const username = sanitizeUsername(body.username);
    const displayName = sanitizeName(body.displayName) || username;
    const password = String(body.password || "");
    const avatar = sanitizeAvatar(body.avatar);

    if (username.length < 3 || password.length < 4) {
      sendJson(response, 400, { error: "Username needs 3+ characters and password needs 4+ characters." });
      return;
    }

    if (db.users[username]) {
      sendJson(response, 409, { error: "That username is already taken." });
      return;
    }

    const salt = randomToken();
    const newUser = {
      username,
      displayName,
      avatar,
      salt,
      passwordHash: hashPassword(password, salt),
      createdAt: new Date().toISOString(),
      blockedUsers: [],
      mutedUsers: [],
      appTheme: "dark"
    };
    const token = randomToken();
    const newSession = { username, createdAt: new Date().toISOString() };

    db.users[username] = newUser;
    db.sessions[token] = newSession;
    await saveDb();

    sendJson(response, 200, { token, user: publicUser(newUser) });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/login") {
    const body = await parseBody(request);
    const username = sanitizeUsername(body.username);
    const password = String(body.password || "");
    
    const user = db.users[username];
    if (!user) {
      sendJson(response, 401, { error: "Invalid username or password." });
      return;
    }

    if (user.passwordHash !== hashPassword(password, user.salt)) {
      sendJson(response, 401, { error: "Invalid username or password." });
      return;
    }

    const token = randomToken();
    const newSession = { username, createdAt: new Date().toISOString() };
    db.sessions[token] = newSession;
    await saveDb();

    sendJson(response, 200, { token, user: publicUser(user) });
    return;
  }

  const postBody = request.method === "GET" ? {} : await parseBody(request);
  const token = request.method === "GET" ? requestUrl.searchParams.get("token") : postBody.token;
  const user = await authenticate(token);

  if (!user) {
    sendJson(response, 401, { error: "Please sign in again." });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/me") {
    sendJson(response, 200, { user: publicUser(user) });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/users") {
    const conversations = Object.values(db.conversations).filter(c =>
      c.participants.includes(user.username)
    );

    const allUsersMap = db.users;

    const summaries = conversations.map(conversation => {
      const peerUsername = getPeer(conversation, user.username);
      const peer = allUsersMap[peerUsername];
      const lastMessage = conversation.messages && conversation.messages.length
        ? conversation.messages[conversation.messages.length - 1]
        : null;

      return {
        user: peer ? publicUser(peer) : { username: peerUsername, displayName: peerUsername, avatar: "" },
        lastMessage,
        unread: 0
      };
    }).filter(summary => summary.user.username);

    const known = new Set(summaries.map(s => s.user.username));
    const otherUsers = Object.values(allUsersMap)
      .filter(entry => entry.username !== user.username && !known.has(entry.username))
      .map(entry => ({ user: publicUser(entry), lastMessage: null, unread: 0 }));

    sendJson(response, 200, { chats: [...summaries, ...otherUsers] });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/conversation") {
    const peerUsername = sanitizeUsername(requestUrl.searchParams.get("with"));
    if (!peerUsername || peerUsername === user.username) {
      sendJson(response, 404, { error: "User not found." });
      return;
    }

    const peer = db.users[peerUsername];
    if (!peer) {
      sendJson(response, 404, { error: "User not found." });
      return;
    }

    const conversation = await ensureConversation(user.username, peerUsername);
    sendJson(response, 200, { conversation, peer: publicUser(peer) });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/stream") {
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });
    response.write("\n");
    addClient(user.username, response);
    request.on("close", () => removeClient(user.username, response));
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/profile") {
    const displayName = postBody.displayName !== undefined ? (sanitizeName(postBody.displayName) || user.username) : user.displayName;
    const avatar = postBody.avatar !== undefined ? sanitizeAvatar(postBody.avatar) : (user.avatar || "");
    const bio = String(postBody.bio !== undefined ? postBody.bio : (user.bio || "")).slice(0, 200);
    const pronouns = String(postBody.pronouns !== undefined ? postBody.pronouns : (user.pronouns || "")).slice(0, 30);
    const bannerColor = String(postBody.bannerColor !== undefined ? postBody.bannerColor : (user.bannerColor || "")).slice(0, 100);
    const bannerImage = String(postBody.bannerImage !== undefined ? postBody.bannerImage : (user.bannerImage || ""));
    const customStatus = String(postBody.customStatus !== undefined ? postBody.customStatus : (user.customStatus || "")).slice(0, 100);
    const website = String(postBody.website !== undefined ? postBody.website : (user.website || "")).slice(0, 150);
    const theme = String(postBody.theme !== undefined ? postBody.theme : (user.theme || "indigo")).slice(0, 30);
    const appTheme = String(postBody.appTheme !== undefined ? postBody.appTheme : (user.appTheme || "dark")).slice(0, 30);
    const privacySettings = postBody.privacySettings !== undefined ? postBody.privacySettings : (user.privacySettings || { showPronouns: true, showBio: true, showWebsite: true });
    const badges = Array.isArray(postBody.badges) ? postBody.badges : (user.badges || []);
    const chatWallpaper = String(postBody.chatWallpaper !== undefined ? postBody.chatWallpaper : (user.chatWallpaper || ""));

    if (db.users[user.username]) {
      db.users[user.username].displayName = displayName;
      db.users[user.username].avatar = avatar;
      db.users[user.username].bio = bio;
      db.users[user.username].pronouns = pronouns;
      db.users[user.username].bannerColor = bannerColor;
      db.users[user.username].bannerImage = bannerImage;
      db.users[user.username].customStatus = customStatus;
      db.users[user.username].website = website;
      db.users[user.username].theme = theme;
      db.users[user.username].appTheme = appTheme;
      db.users[user.username].privacySettings = privacySettings;
      db.users[user.username].badges = badges;
      db.users[user.username].chatWallpaper = chatWallpaper;
      await saveDb();
    }

    user.displayName = displayName;
    user.avatar = avatar;
    user.bio = bio;
    user.pronouns = pronouns;
    user.bannerColor = bannerColor;
    user.bannerImage = bannerImage;
    user.customStatus = customStatus;
    user.website = website;
    user.theme = theme;
    user.appTheme = appTheme;
    user.privacySettings = privacySettings;
    user.badges = badges;
    user.chatWallpaper = chatWallpaper;

    sendJson(response, 200, { user: publicUser(user) });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/block") {
    const peerUsername = sanitizeUsername(postBody.username);
    if (!peerUsername || peerUsername === user.username) {
      sendJson(response, 400, { error: "Invalid username." });
      return;
    }
    
    const peer = db.users[peerUsername];
    if (!peer) {
      sendJson(response, 400, { error: "Invalid username." });
      return;
    }

    user.blockedUsers = user.blockedUsers || [];
    const index = user.blockedUsers.indexOf(peerUsername);
    if (index >= 0) {
      user.blockedUsers.splice(index, 1);
    } else {
      user.blockedUsers.push(peerUsername);
    }
    
    if (db.users[user.username]) {
      db.users[user.username].blockedUsers = user.blockedUsers;
      await saveDb();
    }

    sendJson(response, 200, { ok: true, blocked: user.blockedUsers });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/mute") {
    const peerUsername = sanitizeUsername(postBody.username);
    if (!peerUsername || peerUsername === user.username) {
      sendJson(response, 400, { error: "Invalid username." });
      return;
    }
    
    const peer = db.users[peerUsername];
    if (!peer) {
      sendJson(response, 400, { error: "Invalid username." });
      return;
    }

    user.mutedUsers = user.mutedUsers || [];
    const index = user.mutedUsers.indexOf(peerUsername);
    if (index >= 0) {
      user.mutedUsers.splice(index, 1);
    } else {
      user.mutedUsers.push(peerUsername);
    }

    if (db.users[user.username]) {
      db.users[user.username].mutedUsers = user.mutedUsers;
      await saveDb();
    }

    sendJson(response, 200, { ok: true, muted: user.mutedUsers });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/delete-account") {
    const username = user.username;
    
    // Delete user from db
    delete db.users[username];
    
    // Remove all session tokens of this user
    for (const token of Object.keys(db.sessions)) {
      if (db.sessions[token].username === username) {
        delete db.sessions[token];
      }
    }
    
    // Remove all conversations involving this user
    for (const id of Object.keys(db.conversations)) {
      if (db.conversations[id].participants.includes(username)) {
        delete db.conversations[id];
      }
    }
    
    await saveDb();
    
    // Close any active SSE connections for this user
    const clients = clientsByUser.get(username);
    if (clients) {
      for (const client of clients) {
        try {
          client.end();
        } catch (e) {
          // ignore
        }
      }
      clientsByUser.delete(username);
    }
    
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/message") {
    const peerUsername = sanitizeUsername(postBody.to);
    const text = sanitizeMessage(postBody.text);
    const gifUrl = sanitizeGifUrl(postBody.gifUrl);
    const mediaUrl = String(postBody.mediaUrl || "").trim();
    const mediaType = String(postBody.mediaType || "").trim();
    const mediaSize = Number(postBody.mediaSize || 0);
    const replyTo = sanitizeId(postBody.replyTo);

    if (!peerUsername || peerUsername === user.username || (!text && !gifUrl && !mediaUrl)) {
      sendJson(response, 400, { error: "Choose a user and write a message, GIF, or upload media." });
      return;
    }

    const peer = db.users[peerUsername];
    if (!peer) {
      sendJson(response, 400, { error: "Choose a user and write a message, GIF, or upload media." });
      return;
    }

    if (peer.blockedUsers && peer.blockedUsers.includes(user.username)) {
      sendJson(response, 403, { error: "This user has blocked you. Messages cannot be sent." });
      return;
    }
    if (user.blockedUsers && user.blockedUsers.includes(peerUsername)) {
      sendJson(response, 400, { error: "You have blocked this user. Unblock them to send a message." });
      return;
    }

    const conversation = await ensureConversation(user.username, peerUsername);
    const repliedMessage = replyTo
      ? conversation.messages.find((message) => message.id === replyTo) || null
      : null;
    const embeds = Array.isArray(postBody.embeds)
      ? postBody.embeds.map((e) => {
          if (!e) return null;
          return {
            type: String(e.type || "embed"),
            url: String(e.url || "").slice(0, 1000),
            title: String(e.title || "").slice(0, 200),
            description: String(e.description || "").slice(0, 1000),
            image: String(e.image || "").slice(0, 1000),
            siteName: String(e.siteName || "").slice(0, 100)
          };
        }).filter(Boolean)
      : (postBody.embed ? [{
          type: "embed",
          url: String(postBody.embed.url || "").slice(0, 1000),
          title: String(postBody.embed.title || "").slice(0, 200),
          description: String(postBody.embed.description || "").slice(0, 1000),
          image: String(postBody.embed.image || "").slice(0, 1000),
          siteName: String(postBody.embed.siteName || "").slice(0, 100)
        }] : []);

    const message = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "chat",
      author: user.username,
      authorName: user.displayName,
      authorAvatar: user.avatar || "",
      text,
      gifUrl,
      mediaUrl,
      mediaType,
      mediaSize,
      replyTo: repliedMessage
        ? {
            id: repliedMessage.id,
            author: repliedMessage.author,
            authorName: repliedMessage.authorName,
            text: repliedMessage.text,
            gifUrl: repliedMessage.gifUrl || "",
            mediaUrl: repliedMessage.mediaUrl || "",
            mediaType: repliedMessage.mediaType || "",
            mediaSize: repliedMessage.mediaSize || 0
          }
        : null,
      embed: embeds[0] || null,
      embeds,
      reactions: {},
      createdAt: new Date().toISOString()
    };

    conversation.messages.push(message);
    conversation.messages = conversation.messages.slice(-300);
    
    db.conversations[conversation.id].messages = conversation.messages;
    await saveDb();

    sendEvent(user.username, {
      event: "message",
      conversationId: conversation.id,
      message,
      peer: publicUser(peer)
    });
    sendEvent(peerUsername, {
      event: "message",
      conversationId: conversation.id,
      message,
      peer: publicUser(user)
    });

    // If the message has text but no embeds, resolve URLs asynchronously in the background
    if (text && embeds.length === 0) {
      const URL_REGEX = /https?:\/\/[^\s]+/gi;
      const matches = text.match(URL_REGEX) || [];
      const uniqueUrls = Array.from(new Set(matches));

      if (uniqueUrls.length > 0) {
        setTimeout(async () => {
          try {
            const resolvedList = [];
            for (const url of uniqueUrls) {
              const urlLower = url.toLowerCase().split('?')[0];
              let resolvedItem = null;

              if (/\.(gif|png|jpg|jpeg|webp)(\?|$)/i.test(urlLower)) {
                resolvedItem = { type: "image", url };
              } else if (/\.(mp4|webm|ogg)(\?|$)/i.test(urlLower)) {
                resolvedItem = { type: "video", url };
              } else {
                const resolvedGif = await resolveGifUrl(url);
                if (resolvedGif && resolvedGif !== url) {
                  resolvedItem = { type: "gif", url: resolvedGif };
                } else {
                  const embedData = await resolveEmbed(url);
                  if (embedData) {
                    resolvedItem = { type: "embed", ...embedData };
                  } else {
                    const parsedUrl = new URL(url);
                    resolvedItem = {
                      type: "embed",
                      url,
                      title: parsedUrl.hostname,
                      description: "",
                      image: "",
                      siteName: parsedUrl.hostname.replace("www.", "")
                    };
                  }
                }
              }

              if (resolvedItem) {
                resolvedItem.requestedUrl = url;
                resolvedList.push(resolvedItem);
              }
            }

            if (resolvedList.length > 0) {
              const conversationId = conversation.id;
              const currentConv = db.conversations[conversationId];
              if (currentConv) {
                const msgIndex = currentConv.messages.findIndex((m) => m.id === message.id);
                if (msgIndex >= 0) {
                  currentConv.messages[msgIndex].embeds = resolvedList;
                  currentConv.messages[msgIndex].embed = resolvedList[0] || null;
                  await saveDb();

                  sendEvent(user.username, {
                    event: "message",
                    conversationId: conversationId,
                    message: currentConv.messages[msgIndex],
                    peer: publicUser(peer)
                  });
                  sendEvent(peerUsername, {
                    event: "message",
                    conversationId: conversationId,
                    message: currentConv.messages[msgIndex],
                    peer: publicUser(user)
                  });
                }
              }
            }
          } catch (err) {
            console.error("Background embed resolution error:", err.message);
          }
        }, 100);
      }
    }

    sendJson(response, 200, { ok: true, message });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/react") {
    const peerUsername = sanitizeUsername(postBody.with);
    const messageId = sanitizeId(postBody.messageId);
    const reaction = sanitizeReaction(postBody.reaction);

    if (!peerUsername || !messageId || !reaction) {
      sendJson(response, 400, { error: "Chat, message, and reaction are required." });
      return;
    }

    const peer = db.users[peerUsername];
    if (!peer) {
      sendJson(response, 400, { error: "Chat, message, and reaction are required." });
      return;
    }

    const conversation = await ensureConversation(user.username, peerUsername);
    const message = conversation.messages.find((entry) => entry.id === messageId);
    if (!message) {
      sendJson(response, 404, { error: "Message not found." });
      return;
    }

    message.reactions = message.reactions || {};
    message.reactions[reaction] = Array.isArray(message.reactions[reaction])
      ? message.reactions[reaction]
      : [];

    const existingIndex = message.reactions[reaction].indexOf(user.username);
    if (existingIndex >= 0) {
      message.reactions[reaction].splice(existingIndex, 1);
    } else {
      message.reactions[reaction].push(user.username);
    }

    if (message.reactions[reaction].length === 0) {
      delete message.reactions[reaction];
    }

    db.conversations[conversation.id].messages = conversation.messages;
    await saveDb();

    const payloadForClients = { event: "reaction", conversationId: conversation.id, message };
    sendEvent(user.username, payloadForClients);
    sendEvent(peerUsername, payloadForClients);
    sendJson(response, 200, { ok: true, message });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/delete-message") {
    const peerUsername = sanitizeUsername(postBody.with);
    const messageId = sanitizeId(postBody.messageId);

    if (!peerUsername || !messageId) {
      sendJson(response, 400, { error: "Chat peer and message ID are required." });
      return;
    }

    const peer = db.users[peerUsername];
    if (!peer) {
      sendJson(response, 400, { error: "Chat peer not found." });
      return;
    }

    const conversation = await ensureConversation(user.username, peerUsername);
    const messageIndex = conversation.messages.findIndex((entry) => entry.id === messageId);
    if (messageIndex === -1) {
      sendJson(response, 404, { error: "Message not found." });
      return;
    }

    const message = conversation.messages[messageIndex];
    if (message.author !== user.username) {
      sendJson(response, 403, { error: "You can only delete your own messages." });
      return;
    }

    conversation.messages.splice(messageIndex, 1);

    db.conversations[conversation.id].messages = conversation.messages;
    await saveDb();

    const payloadForClients = { event: "delete-message", conversationId: conversation.id, messageId };
    sendEvent(user.username, payloadForClients);
    sendEvent(peerUsername, payloadForClients);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/pin") {
    const peerUsername = sanitizeUsername(postBody.with);
    const messageId = sanitizeId(postBody.messageId);

    if (!peerUsername || !messageId) {
      sendJson(response, 400, { error: "Chat peer and message ID are required." });
      return;
    }

    const peer = db.users[peerUsername];
    if (!peer) {
      sendJson(response, 400, { error: "Chat peer not found." });
      return;
    }

    const conversation = await ensureConversation(user.username, peerUsername);
    const message = conversation.messages.find((entry) => entry.id === messageId);
    if (!message) {
      sendJson(response, 404, { error: "Message not found." });
      return;
    }

    message.pinned = !message.pinned;

    db.conversations[conversation.id].messages = conversation.messages;
    await saveDb();

    const payloadForClients = { event: "pin-toggle", conversationId: conversation.id, message };
    sendEvent(user.username, payloadForClients);
    sendEvent(peerUsername, payloadForClients);
    sendJson(response, 200, { ok: true, message });
    return;
  }

  sendJson(response, 404, { error: "API route not found." });
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    
    // Serve local uploads statically
    if (requestUrl.pathname.startsWith("/uploads/")) {
      serveUpload(requestUrl.pathname, response);
      return;
    }

    if (requestUrl.pathname.startsWith("/api/")) {
      await handleApi(request, response, requestUrl);
      return;
    }

    serveFile(requestUrl.pathname, response);
  } catch (error) {
    sendJson(response, 400, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Chat app running at http://localhost:${PORT}`);
  
  // Run database and media cleanup job at startup
  runCleanupJob();
  
  // Schedule the cleanup job to run every hour
  setInterval(runCleanupJob, 60 * 60 * 1000);
});
