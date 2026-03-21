require("dotenv").config();
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const mongoose = require("mongoose");
const Product = require("./models/product");

function loadStoreDataFromBrowserFile() {
  const dataFilePath = path.join(__dirname, "data.js");
  const raw = fs.readFileSync(dataFilePath, "utf8");

  // Turn browser-style "window.STORE_DATA = {...}" into executable script
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(raw, sandbox);

  if (!sandbox.window || !sandbox.window.STORE_DATA) {
    throw new Error("Could not load STORE_DATA from data.js");
  }

  return sandbox.window.STORE_DATA;
}

function defaultSizes() {
  return { S: 10, M: 10, L: 10, XL: 10 };
}

function mapNbaProduct(item) {
  return {
    name: item.name || "Unnamed Product",
    team: item.team || "N/A",
    category: "NBA",
    type: item.pos || "Jersey",
    price: Number(item.price || 0),
    sizes: defaultSizes(),
    image: item.img || item.image || "",
    description: item.desc || `${item.name || "NBA item"} jersey`,
  };
}

function mapHockeyProduct(item) {
  return {
    name: item.name || "Unnamed Product",
    team: item.team || "N/A",
    category: "Hockey",
    type: item.type || "Jersey",
    price: Number(item.price || 0),
    sizes: defaultSizes(),
    image: item.image || item.img || "",
    description: item.desc || item.description || `${item.name || "Hockey item"}`,
  };
}

function mapSoccerProduct(item) {
  return {
    name: item.name || "Unnamed Product",
    team: item.team || "N/A",
    category: "Soccer",
    type: item.pos || "Jersey",
    price: Number(item.price || 0),
    sizes: defaultSizes(),
    image: item.img || item.image || "",
    description: item.desc || `${item.name || "Soccer item"} jersey`,
  };
}

async function seedProducts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");

    const storeData = loadStoreDataFromBrowserFile();

    const nbaProducts = (storeData.nba || []).map(mapNbaProduct);
    const hockeyProducts = (storeData.hockey || []).map(mapHockeyProduct);
    const soccerProducts = (storeData.soccer || []).map(mapSoccerProduct);

    const allProducts = [...nbaProducts, ...hockeyProducts, ...soccerProducts];

    if (!allProducts.length) {
      throw new Error("No products found in data.js");
    }

    await Product.deleteMany({});
    console.log("Old products removed");

    await Product.insertMany(allProducts);
    console.log(`Inserted ${allProducts.length} products successfully`);

    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  } catch (error) {
    console.error("Seed error:", error);
    try {
      await mongoose.connection.close();
    } catch {}
  }
}

seedProducts();