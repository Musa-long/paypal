const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// POSTGRESQL
// ========================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false
});

// ========================================
// MIDDLEWARE
// ========================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve index.html and admin.html
app.use(express.static(path.join(__dirname)));

// ========================================
// CREATE TABLE
// ========================================

async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS live_text (
        id INTEGER PRIMARY KEY,
        message TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create the single record if it doesn't exist
    await pool.query(`
      INSERT INTO live_text (id, message)
      VALUES (1, '')
      ON CONFLICT (id) DO NOTHING
    `);

    console.log("Database initialized successfully.");

  } catch (error) {
    console.error("Database initialization error:");
    console.error(error);
  }
}

// ========================================
// AUTOMATICALLY SAVE TEXT
// ========================================

app.post("/api/live-text", async (req, res) => {
  try {
    const { message } = req.body;

    if (typeof message !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid text."
      });
    }

    await pool.query(
      `
      UPDATE live_text
      SET message = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
      `,
      [message]
    );

    res.json({
      success: true
    });

  } catch (error) {
    console.error("Live text save error:");
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not save text."
    });
  }
});

// ========================================
// GET CURRENT TEXT
// ========================================

app.get("/api/live-text", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT message, updated_at
      FROM live_text
      WHERE id = 1
    `);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: "",
        updated_at: null
      });
    }

    res.json({
      success: true,
      message: result.rows[0].message,
      updated_at: result.rows[0].updated_at
    });

  } catch (error) {
    console.error("Get live text error:");
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not load text."
    });
  }
});

// ========================================
// ADMIN LOGIN
// ========================================

app.post("/api/admin-login", (req, res) => {
  const { password } = req.body;

  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(500).json({
      success: false,
      message: "ADMIN_PASSWORD is not configured."
    });
  }

  if (password === adminPassword) {
    return res.json({
      success: true
    });
  }

  return res.status(401).json({
    success: false,
    message: "Incorrect password."
  });
});

// ========================================
// CLEAR TEXT
// ========================================

app.post("/api/clear-text", async (req, res) => {
  try {
    await pool.query(`
      UPDATE live_text
      SET message = '',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `);

    res.json({
      success: true
    });

  } catch (error) {
    console.error("Clear text error:");

    res.status(500).json({
      success: false
    });
  }
});

// ========================================
// HEALTH CHECK
// ========================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running."
  });
});

// ========================================
// START SERVER
// ========================================

async function startServer() {

  await initializeDatabase();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

// ========================================
// DATABASE ERROR HANDLER
// ========================================

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error:");
  console.error(error);
});
