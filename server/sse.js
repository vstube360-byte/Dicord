const { db, saveDb } = require("./db");

const clientsByUser = new Map();

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

function disconnectUser(username) {
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
}

module.exports = {
  sendEvent,
  broadcastPresence,
  addClient,
  removeClient,
  disconnectUser
};
