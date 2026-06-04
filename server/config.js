const path = require("path");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const DIST_DIR = path.join(__dirname, "..", "dist");
const DB_FILE = path.join(__dirname, "..", "data.json");
const uploadsDir = path.join(__dirname, "..", "uploads");

module.exports = {
  PORT,
  PUBLIC_DIR,
  DIST_DIR,
  DB_FILE,
  uploadsDir
};
