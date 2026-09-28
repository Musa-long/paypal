const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 3000;

// ================================
// DATABASE CONNECTION
// ================================

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not configured.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false
});

// ================================
// MIDDLEWARE
// ================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve HTML files from the project folder
app.use(express.static(path.join(__dirname)));

// ================================
// DATABASE INITIALIZATION
// ================================

async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Database table is ready.");
  } catch (error) {
    console.error("Database initialization failed:");
    console.error(error);
  }
}

// ================================
// CUSTOMER SUBMISSION
// ================================

app.post("/api/submit", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please enter a message."
      });
    }

    const cleanMessage = message.trim();

    const result = await pool.query(
      `
      INSERT INTO submissions (message)
      VALUES ($1)
      RETURNING id, message, created_at
      `,
      [cleanMessage]
    );

    return res.json({
      success: true,
      message: "Your message has been submitted successfully.",
      submission: result.rows[0]
    });

  } catch (error) {
    console.error("Submission error:");
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Unable to save your message."
    });
  }
});

// ================================
// ADMIN LOGIN
// ================================

app.post("/api/admin-login", (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required."
      });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      console.error("ERROR: ADMIN_PASSWORD is not configured.");

      return res.status(500).json({
        success: false,
        message: "Admin login is not configured."
      });
    }

    if (password === adminPassword) {
      return res.json({
        success: true,
        message: "Login successful."
      });
    }

    return res.status(401).json({
      success: false,
      message: "Incorrect password."
    });

  } catch (error) {
    console.error("Admin login error:");
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Login failed."
    });
  }
});

// ================================
// GET ALL SUBMISSIONS
// ================================

app.get("/api/submissions", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, message, created_at
      FROM submissions
      ORDER BY created_at DESC
    `);

    return res.json({
      success: true,
      submissions: result.rows
    });

  } catch (error) {
    console.error("Loading submissions error:");
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Unable to load submissions."
    });
  }
});

// ================================
// DELETE SUBMISSION
// ================================

app.delete("/api/submissions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID."
      });
    }

    const result = await pool.query(
      `
      DELETE FROM submissions
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Submission not found."
      });
    }

    return res.json({
      success: true,
      message: "Submission deleted successfully."
    });

  } catch (error) {
    console.error("Delete submission error:");
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete submission."
    });
  }
});

// ================================
// HEALTH CHECK
// ================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running."
  });
});

// ================================
// START SERVER
// ================================

async function startServer() {
  await initializeDatabase();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

// ================================
// HANDLE DATABASE ERRORS
// ================================

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error:");
  console.error(error);
});
