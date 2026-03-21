function getCart() {
  return JSON.parse(localStorage.getItem("vsv_cart")) || [];
}

function saveCart(cart) {
  localStorage.setItem("vsv_cart", JSON.stringify(cart));
}

function getItemSizeStock(item) {
  const size = item.size || "M";
  return Number(item?.sizes?.[size] ?? 0);
}

function addToCart(product) {
  const productId = product.id || product._id;
  const size = product.size || "M";
  const sizeStock = Number(product?.sizes?.[size] ?? 0);

  if (!product || !productId) {
    showToast("Invalid product");
    return;
  }

  if (sizeStock <= 0) {
    showToast(`${size} is out of stock`);
    return;
  }

  const cart = getCart();

  const existing = cart.find(
    item => (item.id === productId || item._id === productId) && item.size === size
  );

  if (existing) {
    if (existing.quantity >= sizeStock) {
      showToast(`Only ${sizeStock} left in stock for size ${size}`);
      return;
    }
    existing.quantity += 1;
  } else {
    cart.push({
      ...product,
      id: productId,
      size,
      quantity: 1
    });
  }

  saveCart(cart);
  updateCartCount();
  showToast(`${product.name} (${size}) added to cart`);
}

function increaseQuantity(productId, size) {
  const cart = getCart();
  const item = cart.find(item => item.id === productId && item.size === size);

  if (!item) return;

  const maxStock = getItemSizeStock(item);

  if (maxStock <= 0) {
    showToast(`${size} is out of stock`);
    return;
  }

  if (item.quantity >= maxStock) {
    showToast(`Only ${maxStock} left in stock for size ${size}`);
    return;
  }

  item.quantity += 1;
  saveCart(cart);
  updateCartCount();
  renderCartPage();
}

function decreaseQuantity(productId, size) {
  let cart = getCart();
  const item = cart.find(item => item.id === productId && item.size === size);

  if (!item) return;

  item.quantity -= 1;

  if (item.quantity <= 0) {
    cart = cart.filter(item => !(item.id === productId && item.size === size));
  }

  saveCart(cart);
  updateCartCount();
  renderCartPage();
}

function removeFromCart(productId, size) {
  const cart = getCart().filter(item => !(item.id === productId && item.size === size));
  saveCart(cart);
  updateCartCount();
  renderCartPage();
}

function clearCart() {
  localStorage.removeItem("vsv_cart");
  updateCartCount();
  renderCartPage();
}

function getCartTotal() {
  return getCart().reduce((sum, item) => {
    return sum + (Number(item.price || 0) * Number(item.quantity || 1));
  }, 0);
}

function updateCartCount() {
  const badge = document.getElementById("cart-count");
  if (!badge) return;

  const totalItems = getCart().reduce((sum, item) => {
    return sum + Number(item.quantity || 1);
  }, 0);

  badge.textContent = totalItems;
}

function showToast(message) {
  const toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) return;

  const toast = document.createElement("div");
  toast.className = "toast-message";
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 50);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}

function renderCartPage() {
  const cartContainer = document.getElementById("cart-items-container");
  const subtotalEl = document.getElementById("cart-subtotal");
  const totalEl = document.getElementById("cart-total");
  const emptyEl = document.getElementById("cart-empty");

  if (!cartContainer) return;

  const cart = getCart();

  if (cart.length === 0) {
    cartContainer.innerHTML = "";
    if (emptyEl) emptyEl.style.display = "block";
    if (subtotalEl) subtotalEl.textContent = "$0.00";
    if (totalEl) totalEl.textContent = "$0.00";
    return;
  }

  if (emptyEl) emptyEl.style.display = "none";

  cartContainer.innerHTML = cart.map(item => {
    const sizeStock = getItemSizeStock(item);
    const stockClass = sizeStock > 0 ? "in-stock" : "out-stock";
    const stockText = sizeStock > 0
      ? `${item.size || "M"} In Stock (${sizeStock} left)`
      : `${item.size || "M"} Out of Stock`;

    return `
      <div class="cart-page-item">
        <div class="cart-page-img-wrap">
          <img
            src="${item.image || item.img || 'https://via.placeholder.com/140x140?text=No+Image'}"
            alt="${item.name}"
            class="cart-page-img"
          >
        </div>

        <div class="cart-page-details">
          <h3>${item.name}</h3>
          <p>${item.team || ""}</p>
          <p>${item.type || item.pos || ""}${item.era ? " · " + item.era : ""}</p>
          <p>Size: ${item.size || "M"}</p>
          <p class="stock-status ${stockClass}">
            ${stockText}
          </p>
          <div class="cart-page-price">$${Number(item.price || 0).toFixed(2)}</div>
        </div>

        <div class="cart-page-actions">
          <div class="qty-controls">
            <button type="button" class="qty-btn decrease-btn" data-id="${item.id}" data-size="${item.size || "M"}">−</button>
            <span>${item.quantity}</span>
            <button type="button" class="qty-btn increase-btn" data-id="${item.id}" data-size="${item.size || "M"}">+</button>
          </div>

          <div class="line-total">
            $${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}
          </div>

          <button type="button" class="remove-btn" data-id="${item.id}" data-size="${item.size || "M"}">
            Remove
          </button>
        </div>
      </div>
    `;
  }).join("");

  const total = getCartTotal().toFixed(2);
  if (subtotalEl) subtotalEl.textContent = `$${total}`;
  if (totalEl) totalEl.textContent = `$${total}`;
}

document.addEventListener("click", function (e) {
  const increaseBtn = e.target.closest(".increase-btn");
  if (increaseBtn) {
    increaseQuantity(increaseBtn.dataset.id, increaseBtn.dataset.size);
    return;
  }

  const decreaseBtn = e.target.closest(".decrease-btn");
  if (decreaseBtn) {
    decreaseQuantity(decreaseBtn.dataset.id, decreaseBtn.dataset.size);
    return;
  }

  const removeBtn = e.target.closest(".remove-btn");
  if (removeBtn) {
    removeFromCart(removeBtn.dataset.id, removeBtn.dataset.size);
    return;
  }

  const clearBtn = e.target.closest("#clear-cart-btn");
  if (clearBtn) {
    clearCart();
    return;
  }

  const checkoutBtn = e.target.closest("#checkout-btn");
  if (checkoutBtn) {
    if (getCart().length === 0) {
      alert("Your cart is empty.");
      return;
    }
    window.location.href = "checkout.html";
  }
});

document.addEventListener("DOMContentLoaded", function () {
  updateCartCount();
  renderCartPage();
});