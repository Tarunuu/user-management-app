/*
Task name: User endpoints

Requirements
  1.  We need to create CRUD endpoints
  2.  The entries (users) can just be saved in a noSQL database (Bonus for using Firebase Realtime Database)
  3.  Each user should have the following data entries: 
        id, name, zip code, latitude, longitude, timezone
  4.  When creating a user, allow input for name and zip code.  
      (Fetch the latitude, longitude, and timezone - Documentation: https://openweathermap.org/current) 
      (You will need to generate an API Key)
  5.  When updating a user, Re-fetch the latitude, longitude, and timezone (if zip code changes)
  6.  Connect to a ReactJS front-end
  * feel free to add add something creative you'd like

*/

require("dotenv").config(); // Add at top to use .env files
const express = require("express");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors");
const moment = require("moment-timezone"); // Add for timezone support

// 1. Initialize Firebase
const serviceAccount = require("./serviceAccountKey.json");

const fixedServiceAccount = {
  ...serviceAccount,
  private_key: serviceAccount.private_key.replace(/\\n/g, "\n"),
};

admin.initializeApp({
  credential: admin.credential.cert(fixedServiceAccount),
  databaseURL:
    process.env.FIREBASE_DB_URL ||
    "https://nodejs-user-management-87fec.firebaseio.com",
});

console.log("Firebase initialized successfully!");

const db = admin.database();
const usersRef = db.ref("users");

// 2. Express server
const app = express();

// Middleware setup
app.use(cors());
app.use(express.json());

// Route logging middleware (ADD THIS)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// 3. Weather API Helper
const OPENWEATHER_API_KEY =
  process.env.OPENWEATHER_API_KEY || "e5bf02c5fda5263677e7bae23631fed1";

// Helper: Get location data from zip code (Improved with timezone)
async function getLocationData(zipCode, country = "US") {
  try {
    // First get coordinates
    const geoResponse = await axios.get(
      `http://api.openweathermap.org/geo/1.0/zip?zip=${zipCode},${country}&appid=${OPENWEATHER_API_KEY}`
    );

    // Then get timezone from coordinates
    const timezoneResponse = await axios.get(
      `http://api.openweathermap.org/data/2.5/weather?lat=${geoResponse.data.lat}&lon=${geoResponse.data.lon}&appid=${OPENWEATHER_API_KEY}`
    );

    return {
      name: geoResponse.data.name,
      lat: geoResponse.data.lat,
      lon: geoResponse.data.lon,
      country: geoResponse.data.country,
      timezone: timezoneResponse.data.timezone, // Now properly getting timezone
    };
  } catch (error) {
    console.error("Weather API Error:", error.message);
    throw new Error("Failed to fetch location data");
  }
}

// CREATE User (Improved with timezone)
app.post("/users", async (req, res) => {
  try {
    const { name, zipCode, country = "US" } = req.body;

    if (!name || !zipCode) {
      return res.status(400).json({ error: "Name and zipCode are required" });
    }

    const location = await getLocationData(zipCode, country);
    const newUserRef = usersRef.push();

    const userData = {
      id: newUserRef.key,
      name,
      zipCode,
      country: location.country,
      lat: location.lat,
      lon: location.lon,
      timezone: location.timezone,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await newUserRef.set(userData);
    res.status(201).json(userData);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({
      error: error.message,
      details:
        "Failed to create user. Please check the zip code and try again.",
    });
  }
});

// UPDATE User (Improved with timezone update)
app.put("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, zipCode, country = "US" } = req.body;
    const userRef = usersRef.child(id);

    const snapshot = await userRef.once("value");
    if (!snapshot.exists()) {
      return res.status(404).json({ error: "User not found" });
    }

    const currentUser = snapshot.val();
    const updates = {
      name: name || currentUser.name,
      updatedAt: new Date().toISOString(),
    };

    // Only update location if zip changed
    if (zipCode && zipCode !== currentUser.zipCode) {
      const location = await getLocationData(zipCode, country);
      Object.assign(updates, {
        zipCode,
        lat: location.lat,
        lon: location.lon,
        timezone: location.timezone,
        country: location.country,
      });
    }

    await userRef.update(updates);
    res.json({
      message: "User updated successfully",
      updates,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      details: "Failed to update user. Please check your input.",
    });
  }
});

// READ All Users (No changes needed)
app.get("/users", async (req, res) => {
  try {
    const snapshot = await usersRef.once("value");
    res.json(snapshot.val() || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// READ Single User (No changes needed)
app.get("/users/:id", async (req, res) => {
  try {
    const snapshot = await usersRef.child(req.params.id).once("value");
    if (!snapshot.exists()) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(snapshot.val());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE User (No changes needed)
app.delete("/users/:id", async (req, res) => {
  try {
    const userRef = usersRef.child(req.params.id);
    const snapshot = await userRef.once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({ error: "User not found" });
    }

    await userRef.remove();
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Root endpoint
app.get("/", (req, res) => {
  res.send("Welcome to the User Management API!");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Global error handler:", err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`\nServer running on http://localhost:${PORT}`);
  console.log("Available endpoints:");
  console.log("POST /users - Create user");
  console.log("GET /users - List all users");
  console.log("GET /users/:id - Get single user");
  console.log("PUT /users/:id - Update user");
  console.log("DELETE /users/:id - Delete user\n");
});
