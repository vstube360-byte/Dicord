const fs = require("fs");
const path = require("path");
const { uploadsDir } = require("./config");
const { db, saveDb } = require("./db");

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

    // Scan uploads folder and delete any files that are not referenced in the database
    try {
      if (fs.existsSync(uploadsDir)) {
        const files = await fs.promises.readdir(uploadsDir);
        const referencedFiles = new Set();

        // Collect all mediaUrls from all conversations
        for (const conv of Object.values(db.conversations)) {
          if (conv.messages) {
            for (const msg of conv.messages) {
              if (msg.mediaUrl && msg.mediaUrl.startsWith("/uploads/")) {
                referencedFiles.add(path.basename(msg.mediaUrl));
              }
            }
          }
          if (conv.avatar && conv.avatar.startsWith("/uploads/")) {
            referencedFiles.add(path.basename(conv.avatar));
          }
        }

        // Collect referenced files from users' avatar, bannerImage, wallpaper
        for (const user of Object.values(db.users)) {
          if (user.avatar && user.avatar.startsWith("/uploads/")) {
            referencedFiles.add(path.basename(user.avatar));
          }
          if (user.bannerImage && user.bannerImage.startsWith("/uploads/")) {
            referencedFiles.add(path.basename(user.bannerImage));
          }
          if (user.chatWallpaper && user.chatWallpaper.startsWith("/uploads/")) {
            referencedFiles.add(path.basename(user.chatWallpaper));
          }
        }

        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        for (const file of files) {
          if (referencedFiles.has(file)) {
            continue;
          }
          const filePath = path.join(uploadsDir, file);
          const stats = await fs.promises.stat(filePath);
          if (stats.mtime < twentyFourHoursAgo) {
            await fs.promises.unlink(filePath);
            console.log(`Deleted unreferenced media file: ${file}`);
          }
        }
      }
    } catch (uploadCleanupErr) {
      console.error("Failed to clean up unreferenced uploads:", uploadCleanupErr.message);
    }
  } catch (err) {
    console.error("Error running cleanup job:", err);
  }
}

module.exports = { runCleanupJob };
