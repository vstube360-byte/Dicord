const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const Busboy = require("busboy");
const { PUBLIC_DIR, DIST_DIR, uploadsDir } = require("./config");
const { sanitizeGifUrl } = require("./db");

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
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

module.exports = {
  sendJson,
  parseBody,
  fetchText,
  extractGifCandidate,
  resolveGifUrl,
  resolveEmbed,
  getContentType,
  serveFile,
  serveUpload,
  handleUpload
};
