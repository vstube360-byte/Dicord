const http = require("http");
const fs = require("fs");
const { URL } = require("url");
const { PORT, uploadsDir } = require("./server/config");
const { runCleanupJob } = require("./server/cleanup");
const { handleApi } = require("./server/routes");
const { serveUpload, serveFile, sendJson } = require("./server/utils");

// Ensure uploads folder exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
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
