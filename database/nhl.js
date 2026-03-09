const hockeyProducts = window.STORE_DATA?.hockey || [];

console.log("Hockey products loaded:", hockeyProducts);

// Example render check
if (!hockeyProducts.length) {
  console.warn("No hockey products found. Check that data.js is loading correctly.");
}