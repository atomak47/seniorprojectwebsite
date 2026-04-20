const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Order = require("./models/Order");
const Product = require("./models/product");
const User = require("./models/User");
require("dotenv").config();

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend files
app.use(express.static(path.join(__dirname)));

/* =========================
   EMAIL TRANSPORTER
========================= */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.verify((error) => {
  if (error) {
    console.error("Mail transporter error:", error);
  } else {
    console.log("Mail transporter is ready");
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
   TEST EMAIL ROUTE
========================= */
app.get("/test-email", async (req, res) => {
  try {
    const result = await transporter.sendMail({
      from: `"Vintage Sports Vault" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: "Test Email",
      text: "This is a test email from Vintage Sports Vault."
    });

    console.log("Test email sent:", result.response);
    res.send("Test email sent successfully.");
  } catch (error) {
    console.error("Test email error:", error);
    if (error && error.response) console.error("Mail response:", error.response);
    if (error && error.code) console.error("Mail code:", error.code);
    res.status(500).send("Test email failed: " + error.message);
  }
});

/* =========================
   REGISTER ROUTE
========================= */
app.post("/api/register", async (req, res) => {
  try {
    console.log("REGISTER HIT:", req.body);

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
      $or: [{ username: cleanUsername }, { email: cleanEmail }]
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
      password: hashedPassword,
      role: "user"
    });

    await newUser.save();

    return res.status(201).json({
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

    console.log("FOUND USER FROM DB:", {
      username: user.username,
      email: user.email,
      role: user.role
    });

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
        email: user.email,
        role: user.role
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

    for (const item of cart) {
      const productId = item._id || item.id || item.productId;
      const size = item.size;
      const quantity = Number(item.quantity || 1);

      if (!productId || !size) {
        return res.status(400).json({
          success: false,
          message: `Missing product or size for ${item.name || "an item"}.`
        });
      }

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({
          success: false,
          message: `${item.name || "A product"} has an invalid product ID. Clear your cart and re-add the item.`
        });
      }

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `${item.name || "A product"} was not found.`
        });
      }

      const available = Number(product?.sizes?.[size] ?? 0);
      if (available < quantity) {
        return res.status(400).json({
          success: false,
          message: `${item.name} (${size}) does not have enough stock.`
        });
      }
    }

    const orderNumber = `VSV-${Date.now()}`;

    const order = new Order({
      orderNumber,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      address: address.trim(),
      items: cart.map((item) => ({
        productId: item._id || item.id || item.productId || "",
        name: item.name || "Unnamed Product",
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 1),
        size: item.size || "M"
      })),
      total: Number(total || 0),
      status: "Pending"
    });

    await order.save();

    for (const item of cart) {
      const productId = item._id || item.id || item.productId;
      const size = item.size;
      const quantity = Number(item.quantity || 1);

      if (!mongoose.Types.ObjectId.isValid(productId)) continue;

      const product = await Product.findById(productId);
      if (!product) continue;

      if (!product.sizes) {
        product.sizes = { S: 0, M: 0, L: 0, XL: 0 };
      }

      product.sizes[size] = Math.max(
        0,
        Number(product.sizes[size] || 0) - quantity
      );

      await product.save();
    }

    const itemsHtml = cart
      .map(
        (item) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">${item.name}</td>
        <td style="padding:8px;border:1px solid #ddd;">${item.quantity || 1}</td>
        <td style="padding:8px;border:1px solid #ddd;">${item.size || "M"}</td>
        <td style="padding:8px;border:1px solid #ddd;">$${Number(item.price || 0).toFixed(2)}</td>
      </tr>
    `
      )
      .join("");

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
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Size</th>
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
          ${cart.map((item) => `<li>${item.name} x ${item.quantity || 1} (${item.size || "M"})</li>`).join("")}
        </ul>
      `
    };

    console.log("About to send customer email to:", email);
    console.log("About to send admin email to:", process.env.EMAIL_USER);

    const customerResult = await transporter.sendMail(customerMail);
    const adminResult = await transporter.sendMail(adminMail);

    console.log("Customer mail sent:", customerResult.response);
    console.log("Admin mail sent:", adminResult.response);

    return res.json({
      success: true,
      message: "Order placed and saved successfully.",
      orderNumber
    });
  } catch (error) {
    console.error("Checkout error:", error);

    if (error && error.response) {
      console.error("Mail response:", error.response);
    }

    if (error && error.code) {
      console.error("Mail code:", error.code);
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process checkout."
    });
  }
});

/* =========================
   PRODUCTS ROUTES
========================= */

app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    return res.json({
      success: true,
      products
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch products."
    });
  }
});

app.get("/api/products/category/:category", async (req, res) => {
  try {
    const category = req.params.category.trim();

    const products = await Product.find({ category }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      products
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch category products."
    });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    const { name, team, category, type, price, sizes, image, description } = req.body;

    if (!name || !category || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "Name, category, and price are required."
      });
    }

    const product = new Product({
      name: name.trim(),
      team: (team || "N/A").trim(),
      category: category.trim(),
      type: (type || "N/A").trim(),
      price: Number(price),
      sizes: {
        S: Number(sizes?.S ?? 0),
        M: Number(sizes?.M ?? 0),
        L: Number(sizes?.L ?? 0),
        XL: Number(sizes?.XL ?? 0)
      },
      image: (image || "").trim(),
      description: (description || "").trim()
    });

    await product.save();

    return res.status(201).json({
      success: true,
      message: "Product created successfully.",
      product
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create product."
    });
  }
});

app.patch("/api/products/:id/restock", async (req, res) => {
  try {
    console.log("RESTOCK HIT:", req.params.id, req.body);

    const { size, quantity } = req.body;
    const validSizes = ["S", "M", "L", "XL"];

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID."
      });
    }

    if (!size || !validSizes.includes(size)) {
      return res.status(400).json({
        success: false,
        message: "Invalid size."
      });
    }

    const qty = Number(quantity);

    if (!qty || qty < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1."
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    if (!product.sizes) {
      product.sizes = { S: 0, M: 0, L: 0, XL: 0 };
    }

    product.sizes[size] = Number(product.sizes[size] || 0) + qty;

    await product.save();

    return res.json({
      success: true,
      message: `${qty} stock added to size ${size}.`,
      product
    });
  } catch (error) {
    console.error("Restock error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to restock product."
    });
  }
});

app.put("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, team, category, type, price, sizes, image, description } = req.body;

    const updateData = {};

    if (name !== undefined) updateData.name = name.trim();
    if (team !== undefined) updateData.team = team.trim();
    if (category !== undefined) updateData.category = category.trim();
    if (type !== undefined) updateData.type = type.trim();
    if (price !== undefined) updateData.price = Number(price);
    if (image !== undefined) updateData.image = image.trim();
    if (description !== undefined) updateData.description = description.trim();

    if (sizes) {
      updateData.sizes = {
        S: Number(sizes.S ?? 0),
        M: Number(sizes.M ?? 0),
        L: Number(sizes.L ?? 0),
        XL: Number(sizes.XL ?? 0)
      };
    }

    const updated = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    return res.json({
      success: true,
      message: "Product updated successfully.",
      product: updated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update product."
    });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Product.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    return res.json({
      success: true,
      message: "Product deleted successfully."
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete product."
    });
  }
});

/* =========================
   ORDERS ROUTES
========================= */

app.get("/api/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });

    return res.json({
      success: true,
      orders
    });
  } catch (error) {
    console.error("Get all orders error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch orders."
    });
  }
});

app.patch("/api/orders/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status."
      });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    return res.json({
      success: true,
      message: "Order status updated successfully.",
      order
    });
  } catch (error) {
    console.error("Update order status error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update order status."
    });
  }
});

app.get("/api/orders/user/:email", async (req, res) => {
  try {
    const email = req.params.email.trim().toLowerCase();

    const orders = await Order.find({ email }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      orders
    });
  } catch (error) {
    console.error("Order history error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch order history."
    });
  }
});

/* =========================
   API 404 HANDLER
========================= */
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

/* =========================
   FRONTEND FALLBACK
========================= */
// ONLY serve index.html for non-API routes
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }

  res.sendFile(path.join(__dirname, "index.html"));
});

/* =========================
   START SERVER AFTER DB CONNECTS
========================= */
const port = process.env.PORT || 3000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected");

    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });