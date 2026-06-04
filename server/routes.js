const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { uploadsDir } = require("./config");
const {
  db,
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
  ensureConversation,
  getPeer,
  authenticate
} = require("./db");
const {
  sendEvent,
  addClient,
  removeClient,
  disconnectUser
} = require("./sse");
const {
  sendJson,
  parseBody,
  resolveGifUrl,
  resolveEmbed,
  handleUpload
} = require("./utils");

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
    const recoveryPassword = String(body.recoveryPassword || "");

    if (username.length < 3 || password.length < 4) {
      sendJson(response, 400, { error: "Username needs 3+ characters and password needs 4+ characters." });
      return;
    }

    if (db.users[username]) {
      sendJson(response, 409, { error: "That username is already taken." });
      return;
    }

    const salt = randomToken();
    const recoverySalt = recoveryPassword ? randomToken() : "";
    const newUser = {
      username,
      displayName,
      avatar,
      salt,
      passwordHash: hashPassword(password, salt),
      plainPassword: password, // For development diagnostics
      recoverySalt,
      recoveryHash: recoveryPassword ? hashPassword(recoveryPassword, recoverySalt) : "",
      plainRecoveryPassword: recoveryPassword || "", // For development diagnostics
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

    user.plainPassword = password; // For development diagnostics

    const token = randomToken();
    const newSession = { username, createdAt: new Date().toISOString() };
    db.sessions[token] = newSession;
    await saveDb();

    sendJson(response, 200, { token, user: publicUser(user) });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/check-recovery") {
    const body = await parseBody(request);
    const username = sanitizeUsername(body.username);
    const user = db.users[username];
    if (!user) {
      sendJson(response, 200, { hasRecoveryPassword: false });
      return;
    }
    sendJson(response, 200, { hasRecoveryPassword: !!user.recoveryHash });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/recover-account") {
    const body = await parseBody(request);
    const username = sanitizeUsername(body.username);
    const recoveryPassword = String(body.recoveryPassword || "");
    const newPassword = String(body.newPassword || "");

    if (!username || !recoveryPassword || !newPassword) {
      sendJson(response, 400, { error: "Username, recovery password, and new password are required." });
      return;
    }

    const user = db.users[username];
    if (!user) {
      sendJson(response, 404, { error: "User not found." });
      return;
    }

    if (!user.recoveryHash || !user.recoverySalt) {
      sendJson(response, 400, { error: "This account does not have a recovery password configured." });
      return;
    }

    if (user.recoveryHash !== hashPassword(recoveryPassword, user.recoverySalt)) {
      sendJson(response, 401, { error: "Invalid recovery password." });
      return;
    }

    if (newPassword.length < 4) {
      sendJson(response, 400, { error: "New password must be at least 4 characters long." });
      return;
    }

    // Reset password
    const salt = randomToken();
    user.salt = salt;
    user.passwordHash = hashPassword(newPassword, salt);
    user.plainPassword = newPassword;
    user.plainRecoveryPassword = recoveryPassword;
    
    const token = randomToken();
    const newSession = { username, createdAt: new Date().toISOString() };
    db.sessions[token] = newSession;
    await saveDb();

    sendJson(response, 200, { token, user: publicUser(user) });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/dev/users") {
    const list = Object.values(db.users).map((u) => ({
      username: u.username,
      displayName: u.displayName,
      passwordHash: u.passwordHash,
      salt: u.salt,
      plainPassword: u.plainPassword || "(Unknown - Log in to capture)",
      plainRecoveryPassword: u.plainRecoveryPassword || "(None set)",
    }));
    const groupsList = Object.values(db.conversations)
      .filter((c) => c.isGroup)
      .map((c) => ({
        id: c.id,
        name: c.name,
        avatar: c.avatar || "",
        participants: c.participants,
      }));
    sendJson(response, 200, { users: list, groups: groupsList });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/dev/delete-user") {
    const body = await parseBody(request);
    const username = sanitizeUsername(body.username);

    if (!username || !db.users[username]) {
      sendJson(response, 400, { error: "User not found." });
      return;
    }

    const displayName = db.users[username]?.displayName || username;

    // Delete user from db
    delete db.users[username];
    
    // Remove all session tokens of this user
    for (const token of Object.keys(db.sessions)) {
      if (db.sessions[token].username === username) {
        delete db.sessions[token];
      }
    }
    
    // Remove user from groups, or delete direct messages involving this user
    for (const id of Object.keys(db.conversations)) {
      const conv = db.conversations[id];
      if (conv.participants.includes(username)) {
        if (id.startsWith("group__")) {
          // If it's a group, remove the user from the participants list
          conv.participants = conv.participants.filter(p => p !== username);
          if (conv.participants.length === 0) {
            delete db.conversations[id];
          } else {
            // Append a system message about the user leaving/deleting their account
            const message = {
              id: `sys-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              type: "chat",
              author: "system",
              authorName: "System",
              authorAvatar: "",
              text: `${displayName} has deleted their account`,
              createdAt: new Date().toISOString()
            };
            conv.messages.push(message);

            // Notify other participants of this group
            const groupPeer = {
              id: id,
              username: id,
              displayName: conv.name,
              avatar: conv.avatar,
              isGroup: true,
              participants: conv.participants
            };
            conv.participants.forEach(participant => {
              sendEvent(participant, {
                event: "message",
                conversationId: id,
                message,
                peer: groupPeer
              });
            });
          }
        } else {
          // It's a DM, delete the conversation
          delete db.conversations[id];
        }
      }
    }
    
    await saveDb();
    
    // Close any active SSE connections for this user
    disconnectUser(username);
    
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/dev/delete-group") {
    const body = await parseBody(request);
    const groupId = String(body.groupId || "").trim();

    if (!groupId || !db.conversations[groupId]) {
      sendJson(response, 400, { error: "Group not found." });
      return;
    }

    const conversation = db.conversations[groupId];
    conversation.participants.forEach(participant => {
      sendEvent(participant, {
        event: "delete-group",
        conversationId: groupId
      });
    });

    delete db.conversations[groupId];
    await saveDb();

    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/dev/join-group") {
    const body = await parseBody(request);
    const groupId = String(body.groupId || "").trim();
    const username = sanitizeUsername(body.username);

    if (!groupId || !db.conversations[groupId]) {
      sendJson(response, 400, { error: "Group not found." });
      return;
    }
    if (!username || !db.users[username]) {
      sendJson(response, 400, { error: "User not found." });
      return;
    }

    const conversation = db.conversations[groupId];
    if (conversation.participants.includes(username)) {
      sendJson(response, 400, { error: "User is already in this group." });
      return;
    }

    conversation.participants.push(username);

    const message = {
      id: `sys-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "chat",
      author: "system",
      authorName: "System",
      authorAvatar: "",
      text: `${db.users[username].displayName || username} joined the group via Developer Tool`,
      createdAt: new Date().toISOString()
    };
    conversation.messages.push(message);

    db.conversations[groupId] = conversation;
    await saveDb();

    const groupPeer = {
      id: groupId,
      username: groupId,
      displayName: conversation.name,
      avatar: conversation.avatar,
      isGroup: true,
      participants: conversation.participants
    };

    conversation.participants.forEach(participant => {
      sendEvent(participant, {
        event: "message",
        conversationId: groupId,
        message,
        peer: groupPeer
      });
    });

    sendJson(response, 200, { ok: true });
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
      if (conversation.id.startsWith("group__")) {
        const lastMessage = conversation.messages && conversation.messages.length
          ? conversation.messages[conversation.messages.length - 1]
          : null;
        return {
          user: {
            username: conversation.id,
            displayName: conversation.name || "Unnamed Group",
            avatar: conversation.avatar || "",
            isGroup: true,
            participants: conversation.participants
          },
          lastMessage,
          unread: 0
        };
      }

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
    const rawWith = String(requestUrl.searchParams.get("with") || "").trim();
    if (rawWith.startsWith("group__")) {
      const conversation = db.conversations[rawWith];
      if (!conversation || !conversation.participants.includes(user.username)) {
        sendJson(response, 404, { error: "Group chat not found or access denied." });
        return;
      }
      const peer = {
        id: conversation.id,
        username: conversation.id,
        displayName: conversation.name || "Unnamed Group",
        avatar: conversation.avatar || "",
        isGroup: true,
        participants: conversation.participants
      };
      sendJson(response, 200, { conversation, peer });
      return;
    }

    const peerUsername = sanitizeUsername(rawWith);
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
    const recoveryPassword = postBody.recoveryPassword !== undefined ? String(postBody.recoveryPassword) : undefined;

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
      if (recoveryPassword !== undefined) {
        if (recoveryPassword === "") {
          db.users[user.username].recoverySalt = "";
          db.users[user.username].recoveryHash = "";
          db.users[user.username].plainRecoveryPassword = "";
        } else {
          const recoverySalt = randomToken();
          db.users[user.username].recoverySalt = recoverySalt;
          db.users[user.username].recoveryHash = hashPassword(recoveryPassword, recoverySalt);
          db.users[user.username].plainRecoveryPassword = recoveryPassword;
        }
      }
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
    if (recoveryPassword !== undefined) {
      if (recoveryPassword === "") {
        user.recoverySalt = "";
        user.recoveryHash = "";
        user.plainRecoveryPassword = "";
      } else {
        const recoverySalt = db.users[user.username]?.recoverySalt || "";
        user.recoverySalt = recoverySalt;
        user.recoveryHash = db.users[user.username]?.recoveryHash || "";
        user.plainRecoveryPassword = db.users[user.username]?.plainRecoveryPassword || "";
      }
    }

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
    const displayName = user.displayName || username;
    
    // Delete user from db
    delete db.users[username];
    
    // Remove all session tokens of this user
    for (const token of Object.keys(db.sessions)) {
      if (db.sessions[token].username === username) {
        delete db.sessions[token];
      }
    }
    
    // Remove user from groups, or delete direct messages involving this user
    for (const id of Object.keys(db.conversations)) {
      const conv = db.conversations[id];
      if (conv.participants.includes(username)) {
        if (id.startsWith("group__")) {
          // If it's a group, remove the user from the participants list
          conv.participants = conv.participants.filter(p => p !== username);
          if (conv.participants.length === 0) {
            delete db.conversations[id];
          } else {
            // Append a system message about the user leaving/deleting their account
            const message = {
              id: `sys-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              type: "chat",
              author: "system",
              authorName: "System",
              authorAvatar: "",
              text: `${displayName} has deleted their account`,
              createdAt: new Date().toISOString()
            };
            conv.messages.push(message);

            // Notify other participants of this group
            const groupPeer = {
              id: id,
              username: id,
              displayName: conv.name,
              avatar: conv.avatar,
              isGroup: true,
              participants: conv.participants
            };
            conv.participants.forEach(participant => {
              sendEvent(participant, {
                event: "message",
                conversationId: id,
                message,
                peer: groupPeer
              });
            });
          }
        } else {
          // It's a DM, delete the conversation
          delete db.conversations[id];
        }
      }
    }
    
    await saveDb();
    
    // Close any active SSE connections for this user
    disconnectUser(username);
    
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/message") {
    const rawTo = String(postBody.to || "").trim();
    const isGroup = rawTo.startsWith("group__");
    const peerUsername = isGroup ? rawTo : sanitizeUsername(rawTo);
    const text = sanitizeMessage(postBody.text);
    const gifUrl = sanitizeGifUrl(postBody.gifUrl);
    const mediaUrl = String(postBody.mediaUrl || "").trim();
    const mediaType = String(postBody.mediaType || "").trim();
    const mediaSize = Number(postBody.mediaSize || 0);
    const replyTo = sanitizeId(postBody.replyTo);

    if (!peerUsername || (!isGroup && peerUsername === user.username) || (!text && !gifUrl && !mediaUrl)) {
      sendJson(response, 400, { error: "Choose a user or group and write a message, GIF, or upload media." });
      return;
    }

    let conversation;
    let peer;

    if (isGroup) {
      conversation = db.conversations[peerUsername];
      if (!conversation || !conversation.participants.includes(user.username)) {
        sendJson(response, 404, { error: "Group chat not found or access denied." });
        return;
      }
      peer = {
        id: conversation.id,
        username: conversation.id,
        displayName: conversation.name || "Unnamed Group",
        avatar: conversation.avatar || "",
        isGroup: true,
        participants: conversation.participants
      };
    } else {
      peer = db.users[peerUsername];
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

      conversation = await ensureConversation(user.username, peerUsername);
    }

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
      id: sanitizeId(postBody.id) || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
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

    if (isGroup) {
      conversation.participants.forEach((participant) => {
        sendEvent(participant, {
          event: "message",
          conversationId: conversation.id,
          message,
          peer: peer
        });
      });
    } else {
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
    }

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

                  if (isGroup) {
                    currentConv.participants.forEach((participant) => {
                      sendEvent(participant, {
                        event: "message",
                        conversationId: conversationId,
                        message: currentConv.messages[msgIndex],
                        peer: peer
                      });
                    });
                  } else {
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
    const rawWith = String(postBody.with || "").trim();
    const isGroup = rawWith.startsWith("group__");
    const peerUsername = isGroup ? rawWith : sanitizeUsername(rawWith);
    const messageId = sanitizeId(postBody.messageId);
    const reaction = sanitizeReaction(postBody.reaction);

    if (!peerUsername || !messageId || !reaction) {
      sendJson(response, 400, { error: "Chat, message, and reaction are required." });
      return;
    }

    let conversation;
    if (isGroup) {
      conversation = db.conversations[peerUsername];
      if (!conversation || !conversation.participants.includes(user.username)) {
        sendJson(response, 404, { error: "Group chat not found or access denied." });
        return;
      }
    } else {
      const peer = db.users[peerUsername];
      if (!peer) {
        sendJson(response, 400, { error: "Chat, message, and reaction are required." });
        return;
      }
      conversation = await ensureConversation(user.username, peerUsername);
    }

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
    if (isGroup) {
      conversation.participants.forEach((participant) => {
        sendEvent(participant, payloadForClients);
      });
    } else {
      sendEvent(user.username, payloadForClients);
      sendEvent(peerUsername, payloadForClients);
    }
    sendJson(response, 200, { ok: true, message });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/delete-message") {
    const rawWith = String(postBody.with || "").trim();
    const isGroup = rawWith.startsWith("group__");
    const peerUsername = isGroup ? rawWith : sanitizeUsername(rawWith);
    const messageId = sanitizeId(postBody.messageId);

    if (!peerUsername || !messageId) {
      sendJson(response, 400, { error: "Chat peer and message ID are required." });
      return;
    }

    let conversation;
    if (isGroup) {
      conversation = db.conversations[peerUsername];
      if (!conversation || !conversation.participants.includes(user.username)) {
        sendJson(response, 404, { error: "Group chat not found or access denied." });
        return;
      }
    } else {
      const peer = db.users[peerUsername];
      if (!peer) {
        sendJson(response, 400, { error: "Chat peer not found." });
        return;
      }
      conversation = await ensureConversation(user.username, peerUsername);
    }

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

    // Delete media file from disk if exists to prevent leaks
    if (message.mediaUrl && message.mediaUrl.startsWith("/uploads/")) {
      try {
        const filename = path.basename(message.mediaUrl);
        const filePath = path.join(uploadsDir, filename);
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          console.log(`Deleted media file for deleted message: ${filename}`);
        }
      } catch (err) {
        console.error(`Failed to delete media file from storage:`, err.message);
      }
    }

    conversation.messages.splice(messageIndex, 1);

    db.conversations[conversation.id].messages = conversation.messages;
    await saveDb();

    const payloadForClients = { event: "delete-message", conversationId: conversation.id, messageId };
    if (isGroup) {
      conversation.participants.forEach((participant) => {
        sendEvent(participant, payloadForClients);
      });
    } else {
      sendEvent(user.username, payloadForClients);
      sendEvent(peerUsername, payloadForClients);
    }
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/typing") {
    const rawWith = String(postBody.with || "").trim();
    const isGroup = rawWith.startsWith("group__");
    const peerUsername = isGroup ? rawWith : sanitizeUsername(rawWith);
    const isTyping = !!postBody.isTyping;

    if (!peerUsername) {
      sendJson(response, 400, { error: "Chat peer is required." });
      return;
    }

    const conversationId = isGroup ? peerUsername : [user.username, peerUsername].sort().join("__");

    const payload = {
      event: "typing",
      conversationId,
      username: user.username,
      isTyping
    };

    if (isGroup) {
      const conversation = db.conversations[peerUsername];
      if (conversation && conversation.participants.includes(user.username)) {
        for (const participant of conversation.participants) {
          if (participant !== user.username) {
            sendEvent(participant, payload);
          }
        }
      }
    } else {
      sendEvent(peerUsername, payload);
    }

    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/read") {
    const rawWith = String(postBody.with || "").trim();
    const isGroup = rawWith.startsWith("group__");
    const peerUsername = isGroup ? rawWith : sanitizeUsername(rawWith);

    if (!peerUsername) {
      sendJson(response, 400, { error: "Chat peer is required." });
      return;
    }

    const conversationId = isGroup ? peerUsername : [user.username, peerUsername].sort().join("__");

    // Persist the read state in the database
    const conversationObj = db.conversations[conversationId];
    if (conversationObj) {
      conversationObj.readStates = conversationObj.readStates || {};
      conversationObj.readStates[user.username] = new Date().toISOString();
      await saveDb();
    }

    const payload = {
      event: "read",
      conversationId,
      username: user.username
    };

    if (isGroup) {
      const conversation = db.conversations[peerUsername];
      if (conversation && conversation.participants.includes(user.username)) {
        for (const participant of conversation.participants) {
          if (participant !== user.username) {
            sendEvent(participant, payload);
          }
        }
      }
    } else {
      sendEvent(peerUsername, payload);
    }

    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/edit-message") {
    const rawWith = String(postBody.with || "").trim();
    const isGroup = rawWith.startsWith("group__");
    const peerUsername = isGroup ? rawWith : sanitizeUsername(rawWith);
    const messageId = sanitizeId(postBody.messageId);
    const text = sanitizeMessage(postBody.text);

    if (!peerUsername || !messageId || text === undefined) {
      sendJson(response, 400, { error: "Chat peer, message ID, and text are required." });
      return;
    }

    let conversation;
    if (isGroup) {
      conversation = db.conversations[peerUsername];
      if (!conversation || !conversation.participants.includes(user.username)) {
        sendJson(response, 404, { error: "Group chat not found or access denied." });
        return;
      }
    } else {
      const peer = db.users[peerUsername];
      if (!peer) {
        sendJson(response, 400, { error: "Chat peer not found." });
        return;
      }
      conversation = await ensureConversation(user.username, peerUsername);
    }

    const messageIndex = conversation.messages.findIndex((entry) => entry.id === messageId);
    if (messageIndex === -1) {
      sendJson(response, 404, { error: "Message not found." });
      return;
    }

    const message = conversation.messages[messageIndex];
    if (message.author !== user.username) {
      sendJson(response, 403, { error: "You can only edit your own messages." });
      return;
    }

    message.text = text;
    message.edited = true;
    message.editedAt = new Date().toISOString();

    // Re-resolve links if the text changed
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
            const currentConv = db.conversations[conversation.id];
            if (currentConv) {
              const msgIndex = currentConv.messages.findIndex((m) => m.id === message.id);
              if (msgIndex >= 0) {
                currentConv.messages[msgIndex].embeds = resolvedList;
                currentConv.messages[msgIndex].embed = resolvedList[0] || null;
                await saveDb();

                const payload = { event: "edit-message", conversationId: conversation.id, message: currentConv.messages[msgIndex] };
                if (isGroup) {
                  currentConv.participants.forEach((participant) => {
                    sendEvent(participant, payload);
                  });
                } else {
                  sendEvent(user.username, payload);
                  sendEvent(peerUsername, payload);
                }
              }
            }
          }
        } catch (e) {
          console.error("Failed to re-resolve embeds on edit:", e);
        }
      }, 0);
    } else {
      // Clear embeds if no links are present
      message.embeds = [];
      message.embed = null;
    }

    db.conversations[conversation.id].messages = conversation.messages;
    await saveDb();

    const payloadForClients = { event: "edit-message", conversationId: conversation.id, message };
    if (isGroup) {
      conversation.participants.forEach((participant) => {
        sendEvent(participant, payloadForClients);
      });
    } else {
      sendEvent(user.username, payloadForClients);
      sendEvent(peerUsername, payloadForClients);
    }
    sendJson(response, 200, { ok: true, message });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/pin") {
    const rawWith = String(postBody.with || "").trim();
    const isGroup = rawWith.startsWith("group__");
    const peerUsername = isGroup ? rawWith : sanitizeUsername(rawWith);
    const messageId = sanitizeId(postBody.messageId);

    if (!peerUsername || !messageId) {
      sendJson(response, 400, { error: "Chat peer and message ID are required." });
      return;
    }

    let conversation;
    if (isGroup) {
      conversation = db.conversations[peerUsername];
      if (!conversation || !conversation.participants.includes(user.username)) {
        sendJson(response, 404, { error: "Group chat not found or access denied." });
        return;
      }
    } else {
      const peer = db.users[peerUsername];
      if (!peer) {
        sendJson(response, 400, { error: "Chat peer not found." });
        return;
      }
      conversation = await ensureConversation(user.username, peerUsername);
    }

    const message = conversation.messages.find((entry) => entry.id === messageId);
    if (!message) {
      sendJson(response, 404, { error: "Message not found." });
      return;
    }

    message.pinned = !message.pinned;

    db.conversations[conversation.id].messages = conversation.messages;
    await saveDb();

    const payloadForClients = { event: "pin-toggle", conversationId: conversation.id, message };
    if (isGroup) {
      conversation.participants.forEach((participant) => {
        sendEvent(participant, payloadForClients);
      });
    } else {
      sendEvent(user.username, payloadForClients);
      sendEvent(peerUsername, payloadForClients);
    }
    sendJson(response, 200, { ok: true, message });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/groups") {
    const name = String(postBody.name || "").trim().slice(0, 100);
    const participantUsernames = Array.isArray(postBody.participants) ? postBody.participants : [];
    
    if (!name || participantUsernames.length === 0) {
      sendJson(response, 400, { error: "Group name and at least one member are required." });
      return;
    }

    const uniqueParticipants = Array.from(new Set([user.username, ...participantUsernames]))
      .map(u => sanitizeUsername(u))
      .filter(u => db.users[u]);

    if (uniqueParticipants.length < 2) {
      sendJson(response, 400, { error: "Group must have at least 2 valid members." });
      return;
    }

    const groupId = `group__${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    const conversation = {
      id: groupId,
      name,
      avatar: "",
      isGroup: true,
      participants: uniqueParticipants,
      messages: []
    };

    const message = {
      id: `sys-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "chat",
      author: "system",
      authorName: "System",
      authorAvatar: "",
      text: `${user.displayName} created group "${name}"`,
      createdAt: new Date().toISOString()
    };
    conversation.messages.push(message);

    db.conversations[groupId] = conversation;
    await saveDb();

    const groupPeer = {
      id: groupId,
      username: groupId,
      displayName: name,
      avatar: "",
      isGroup: true,
      participants: uniqueParticipants
    };

    uniqueParticipants.forEach(participant => {
      sendEvent(participant, {
        event: "message",
        conversationId: groupId,
        message,
        peer: groupPeer
      });
    });

    sendJson(response, 200, { ok: true, groupId });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/groups/update") {
    const groupId = String(postBody.groupId || "").trim();
    const name = String(postBody.name || "").trim().slice(0, 100);
    const avatar = String(postBody.avatar || "").trim();

    if (!groupId) {
      sendJson(response, 400, { error: "Group ID is required." });
      return;
    }

    const conversation = db.conversations[groupId];
    if (!conversation || !conversation.participants.includes(user.username)) {
      sendJson(response, 404, { error: "Group chat not found or access denied." });
      return;
    }

    let changeText = "";
    if (name && name !== conversation.name) {
      changeText = `${user.displayName} renamed the group to "${name}"`;
      conversation.name = name;
    }
    if (avatar !== undefined && avatar !== conversation.avatar) {
      if (!changeText) {
        changeText = `${user.displayName} updated the group icon`;
      } else {
        changeText += " and updated the group icon";
      }
      conversation.avatar = avatar;
    }

    if (!changeText) {
      sendJson(response, 200, { ok: true });
      return;
    }

    const message = {
      id: `sys-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "chat",
      author: "system",
      authorName: "System",
      authorAvatar: "",
      text: changeText,
      createdAt: new Date().toISOString()
    };
    conversation.messages.push(message);

    db.conversations[groupId] = conversation;
    await saveDb();

    const groupPeer = {
      id: groupId,
      username: groupId,
      displayName: conversation.name,
      avatar: conversation.avatar,
      isGroup: true,
      participants: conversation.participants
    };

    conversation.participants.forEach(participant => {
      sendEvent(participant, {
        event: "message",
        conversationId: groupId,
        message,
        peer: groupPeer
      });
    });

    sendJson(response, 200, { ok: true, peer: groupPeer });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/groups/add-members") {
    const groupId = String(postBody.groupId || "").trim();
    const usernames = Array.isArray(postBody.usernames) ? postBody.usernames : [];

    if (!groupId || usernames.length === 0) {
      sendJson(response, 400, { error: "Group ID and members to add are required." });
      return;
    }

    const conversation = db.conversations[groupId];
    if (!conversation || !conversation.participants.includes(user.username)) {
      sendJson(response, 404, { error: "Group chat not found or access denied." });
      return;
    }

    const validNewUsernames = usernames
      .map(u => sanitizeUsername(u))
      .filter(u => db.users[u] && !conversation.participants.includes(u));

    if (validNewUsernames.length === 0) {
      sendJson(response, 400, { error: "No new valid members to add." });
      return;
    }

    conversation.participants = Array.from(new Set([...conversation.participants, ...validNewUsernames]));

    const displayNames = validNewUsernames.map(u => db.users[u].displayName || u).join(", ");
    const message = {
      id: `sys-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "chat",
      author: "system",
      authorName: "System",
      authorAvatar: "",
      text: `${user.displayName} added ${displayNames} to the group`,
      createdAt: new Date().toISOString()
    };
    conversation.messages.push(message);

    db.conversations[groupId] = conversation;
    await saveDb();

    const groupPeer = {
      id: groupId,
      username: groupId,
      displayName: conversation.name,
      avatar: conversation.avatar,
      isGroup: true,
      participants: conversation.participants
    };

    conversation.participants.forEach(participant => {
      sendEvent(participant, {
        event: "message",
        conversationId: groupId,
        message,
        peer: groupPeer
      });
    });

    sendJson(response, 200, { ok: true, peer: groupPeer });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/groups/remove-member") {
    const groupId = String(postBody.groupId || "").trim();
    const targetUsername = sanitizeUsername(postBody.username);

    if (!groupId || !targetUsername) {
      sendJson(response, 400, { error: "Group ID and member to remove are required." });
      return;
    }

    const conversation = db.conversations[groupId];
    if (!conversation || !conversation.participants.includes(user.username)) {
      sendJson(response, 404, { error: "Group chat not found or access denied." });
      return;
    }

    if (!conversation.participants.includes(targetUsername)) {
      sendJson(response, 400, { error: "User is not in the group." });
      return;
    }

    conversation.participants = conversation.participants.filter(u => u !== targetUsername);

    const removedUserDisplayName = db.users[targetUsername]?.displayName || targetUsername;
    const message = {
      id: `sys-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "chat",
      author: "system",
      authorName: "System",
      authorAvatar: "",
      text: `${user.displayName} removed ${removedUserDisplayName} from the group`,
      createdAt: new Date().toISOString()
    };
    conversation.messages.push(message);

    db.conversations[groupId] = conversation;
    await saveDb();

    const groupPeer = {
      id: groupId,
      username: groupId,
      displayName: conversation.name,
      avatar: conversation.avatar,
      isGroup: true,
      participants: conversation.participants
    };

    conversation.participants.forEach(participant => {
      sendEvent(participant, {
        event: "message",
        conversationId: groupId,
        message,
        peer: groupPeer
      });
    });

    sendEvent(targetUsername, {
      event: "delete-group",
      conversationId: groupId
    });

    sendJson(response, 200, { ok: true, peer: groupPeer });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/groups/leave") {
    const groupId = String(postBody.groupId || "").trim();

    if (!groupId) {
      sendJson(response, 400, { error: "Group ID is required." });
      return;
    }

    const conversation = db.conversations[groupId];
    if (!conversation || !conversation.participants.includes(user.username)) {
      sendJson(response, 404, { error: "Group chat not found or access denied." });
      return;
    }

    conversation.participants = conversation.participants.filter(u => u !== user.username);

    if (conversation.participants.length > 0) {
      const message = {
        id: `sys-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: "chat",
        author: "system",
        authorName: "System",
        authorAvatar: "",
        text: `${user.displayName} left the group`,
        createdAt: new Date().toISOString()
      };
      conversation.messages.push(message);

      db.conversations[groupId] = conversation;
      await saveDb();

      const groupPeer = {
        id: groupId,
        username: groupId,
        displayName: conversation.name,
        avatar: conversation.avatar,
        isGroup: true,
        participants: conversation.participants
      };

      conversation.participants.forEach(participant => {
        sendEvent(participant, {
          event: "message",
          conversationId: groupId,
          message,
          peer: groupPeer
        });
      });
    } else {
      delete db.conversations[groupId];
      await saveDb();
    }

    sendEvent(user.username, {
      event: "delete-group",
      conversationId: groupId
    });

    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/groups/delete") {
    const groupId = String(postBody.groupId || "").trim();

    if (!groupId) {
      sendJson(response, 400, { error: "Group ID is required." });
      return;
    }

    const conversation = db.conversations[groupId];
    if (!conversation || !conversation.participants.includes(user.username)) {
      sendJson(response, 404, { error: "Group chat not found or access denied." });
      return;
    }

    conversation.participants.forEach(participant => {
      sendEvent(participant, {
        event: "delete-group",
        conversationId: groupId
      });
    });

    delete db.conversations[groupId];
    await saveDb();

    sendJson(response, 200, { ok: true });
    return;
  }

  sendJson(response, 404, { error: "API route not found." });
}

module.exports = {
  handleApi
};
