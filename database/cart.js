function getCart() {
  return JSON.parse(localStorage.getItem("vsv_cart")) || [];
}

function saveCart(cart) {
  localStorage.setItem("vsv_cart", JSON.stringify(cart));
}

function addToCart(product) {
  if (!product || Number(product.stock || 0) <= 0) {
    showToast("This item is out of stock");
    return;
  }

  const cart = getCart();
  const existing = cart.find(item => item.id === product.id);

  if (existing) {
    if (existing.quantity >= Number(product.stock || 0)) {
      showToast(`Only ${product.stock} left in stock`);
      return;
    }
    existing.quantity += 1;
  } else {
    cart.push({
      ...product,
      quantity: 1
    });
  }

  saveCart(cart);
  updateCartCount();
  showToast(`${product.name} added to cart`);
}

function increaseQuantity(productId) {
  const cart = getCart();
  const item = cart.find(item => item.id === productId);

  if (!item) return;

  const maxStock = Number(item.stock || 0);

  if (maxStock <= 0) {
    showToast("This item is out of stock");
    return;
  }

  if (item.quantity >= maxStock) {
    showToast(`Only ${maxStock} left in stock`);
    return;
  }

  item.quantity += 1;
  saveCart(cart);
  updateCartCount();
  renderCartPage();
}

function decreaseQuantity(productId) {
  let cart = getCart();
  const item = cart.find(item => item.id === productId);

  if (!item) return;

  item.quantity -= 1;

  if (item.quantity <= 0) {
    cart = cart.filter(item => item.id !== productId);
  }

  saveCart(cart);
  updateCartCount();
  renderCartPage();
}

function removeFromCart(productId) {
  const cart = getCart().filter(item => item.id !== productId);
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

  cartContainer.innerHTML = cart.map(item => `
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
        <p class="stock-status ${Number(item.stock || 0) > 0 ? 'in-stock' : 'out-stock'}">
          ${Number(item.stock || 0) > 0 ? `In Stock (${item.stock} left)` : "Out of Stock"}
        </p>
        <div class="cart-page-price">$${Number(item.price || 0).toFixed(2)}</div>
      </div>

      <div class="cart-page-actions">
        <div class="qty-controls">
          <button type="button" class="qty-btn decrease-btn" data-id="${item.id}">−</button>
          <span>${item.quantity}</span>
          <button type="button" class="qty-btn increase-btn" data-id="${item.id}">+</button>
        </div>

        <div class="line-total">
          $${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}
        </div>

        <button type="button" class="remove-btn" data-id="${item.id}">
          Remove
        </button>
      </div>
    </div>
  `).join("");

  const total = getCartTotal().toFixed(2);
  if (subtotalEl) subtotalEl.textContent = `$${total}`;
  if (totalEl) totalEl.textContent = `$${total}`;
}

document.addEventListener("click", function (e) {
  const increaseBtn = e.target.closest(".increase-btn");
  if (increaseBtn) {
    increaseQuantity(increaseBtn.dataset.id);
    return;
  }

  const decreaseBtn = e.target.closest(".decrease-btn");
  if (decreaseBtn) {
    decreaseQuantity(decreaseBtn.dataset.id);
    return;
  }

  const removeBtn = e.target.closest(".remove-btn");
  if (removeBtn) {
    removeFromCart(removeBtn.dataset.id);
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