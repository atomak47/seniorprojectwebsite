const nbaProducts = window.STORE_DATA?.nba || [];

console.log("NBA products loaded:", nbaProducts);

// Example render check
if (!nbaProducts.length) {
  console.warn("No NBA products found. Check that data.js is loading correctly.");
}