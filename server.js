const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("./models/User");

const app = express();

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend files
app.use(express.static(path.join(__dirname)));

// Gmail transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* =========================
   TEST ROUTE
========================= */
app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "API works",
    mongoReadyState: mongoose.connection.readyState
  });
});

/* =========================
   REGISTER ROUTE
========================= */
app.post("/api/register", async (req, res) => {
  try {
    console.log("REGISTER HIT:", req.body);
    console.log("Mongo readyState:", mongoose.connection.readyState);

    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        success: false,
        message: "Database is not connected."
      });
    }

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required."
      });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    const existingUser = await User.findOne({
      $or: [
        { username: cleanUsername },
        { email: cleanEmail }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username or email already exists."
      });
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    const newUser = new User({
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword
    });

    await newUser.save();

    return res.json({
      success: true,
      message: "Account created successfully."
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error during registration."
    });
  }
});

/* =========================
   LOGIN ROUTE
========================= */
app.post("/api/login", async (req, res) => {
  try {
    console.log("LOGIN HIT:", req.body);
    console.log("Mongo readyState:", mongoose.connection.readyState);

    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        success: false,
        message: "Database is not connected."
      });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required."
      });
    }

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    const user = await User.findOne({ username: cleanUsername });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    const passwordMatch = await bcrypt.compare(cleanPassword, user.password);

    if (!passwordMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    return res.json({
      success: true,
      message: "Login successful.",
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error during login."
    });
  }
});

/* =========================
   CHECKOUT ROUTE
========================= */
app.post("/api/checkout", async (req, res) => {
  try {
    console.log("Checkout request received:", req.body);

    const { name, email, address, cart, total } = req.body;

    if (!name || !email || !address || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required checkout data."
      });
    }

    const orderNumber = `VSV-${Date.now()}`;

    const itemsHtml = cart.map((item) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">${item.name}</td>
        <td style="padding:8px;border:1px solid #ddd;">${item.quantity || 1}</td>
        <td style="padding:8px;border:1px solid #ddd;">$${Number(item.price || 0).toFixed(2)}</td>
      </tr>
    `).join("");

    const customerMail = {
      from: `"Vintage Sports Vault" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Your Vintage Sports Vault Order Confirmation - ${orderNumber}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:700px;margin:auto;">
          <h2>Thanks for your order, ${name}!</h2>
          <p>Your order has been received and is being processed.</p>
          <p><strong>Order Number:</strong> ${orderNumber}</p>
          <p><strong>Shipping Address:</strong><br>${address}</p>

          <h3>Order Summary</h3>
          <table style="border-collapse:collapse;width:100%;">
            <thead>
              <tr>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Item</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Qty</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <p style="margin-top:16px;"><strong>Total:</strong> $${Number(total || 0).toFixed(2)}</p>
          <p>We appreciate your purchase from Vintage Sports Vault.</p>
        </div>
      `
    };

    const adminMail = {
      from: `"Vintage Sports Vault" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `New Order ${orderNumber} from ${name}`,
      html: `
        <h2>New Order Received</h2>
        <p><strong>Order Number:</strong> ${orderNumber}</p>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Address:</strong> ${address}</p>
        <p><strong>Total:</strong> $${Number(total || 0).toFixed(2)}</p>
        <hr>
        <ul>
          ${cart.map((item) => `<li>${item.name} x ${item.quantity || 1}</li>`).join("")}
        </ul>
      `
    };

    const customerResult = await transporter.sendMail(customerMail);
    const adminResult = await transporter.sendMail(adminMail);

    console.log("Customer mail sent:", customerResult.response);
    console.log("Admin mail sent:", adminResult.response);

    return res.json({
      success: true,
      message: "Order placed and confirmation email sent.",
      orderNumber
    });
  } catch (error) {
    console.error("Checkout email error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send confirmation email."
    });
  }
});

// Catch-all route
app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});