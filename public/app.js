"use strict";

const statusNames = { active: "Активно", sold: "Продано", archived: "В архиве" };
const categoryIcons = { Дом: "🏠", Книги: "📚", Спорт: "🚲", Электроника: "⌨️" };

const adsList = document.getElementById("listings-list");
const filtersForm = document.getElementById("filters-form");
const categoryFilter = document.getElementById("category-filter");
const datalist = document.getElementById("category-list");
const message = document.getElementById("message");
const emptyState = document.getElementById("empty-state");
const dialog = document.getElementById("listing-dialog");
const adForm = document.getElementById("listing-form");
const dialogTitle = document.getElementById("dialog-title");

async function api(url, options) {
  const response = await fetch(url, options);
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error || "Не удалось выполнить запрос.");
  return body;
}

function formatPrice(price) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: Number.isInteger(price) ? 0 : 2,
  }).format(price);
}

function createButton(label, action, danger = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `card-action${danger ? " card-action--danger" : ""}`;
  button.dataset.action = action;
  button.textContent = label;
  return button;
}

function createAdCard(ad) {
  const card = document.createElement("article");
  card.className = "listing-card";
  card.dataset.id = ad.id;

  if (ad.status === "sold") {
    const ribbon = document.createElement("span");
    ribbon.className = "sold-ribbon";
    ribbon.textContent = "Продано";
    card.append(ribbon);
  }

  const visual = document.createElement("div");
  visual.className = "listing-card__visual";
  const icon = document.createElement("span");
  icon.className = "listing-card__icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = categoryIcons[ad.category] || "📦";
  const status = document.createElement("span");
  status.className = `status status--${ad.status}`;
  status.textContent = statusNames[ad.status];
  visual.append(icon, status);

  const body = document.createElement("div");
  body.className = "listing-card__body";
  const meta = document.createElement("div");
  meta.className = "listing-card__meta";
  const category = document.createElement("span");
  category.textContent = ad.category;
  const price = document.createElement("strong");
  price.className = "listing-card__price";
  price.textContent = formatPrice(ad.price);
  meta.append(category, price);

  const heading = document.createElement("h3");
  heading.textContent = ad.title;
  const description = document.createElement("p");
  description.className = "listing-card__description";
  description.textContent = ad.description;

  const controls = document.createElement("div");
  controls.className = "card-actions";
  controls.append(createButton("Изменить", "edit"), createButton("Удалить", "delete", true));

  body.append(meta, heading, description, controls);
  card.append(visual, body);
  return card;
}

function filtersToQuery() {
  const data = new FormData(filtersForm);
  const params = new URLSearchParams();
  for (const [key, value] of data) {
    if (String(value).trim()) params.set(key, String(value).trim());
  }
  return params.toString();
}

async function loadAds() {
  message.textContent = "Загрузка объявлений…";
  try {
    const query = filtersToQuery();
    const ads = await api(`/api/ads${query ? `?${query}` : ""}`);
    adsList.replaceChildren(...ads.map(createAdCard));
    document.getElementById("total-count").textContent = String(ads.length);
    document.getElementById("active-count").textContent = String(
      ads.filter((ad) => ad.status === "active").length,
    );
    emptyState.hidden = ads.length !== 0;
    message.textContent = "";
  } catch (error) {
    message.textContent = error.message;
  }
}

async function loadCategories(selected = "") {
  try {
    const categories = await api("/api/categories");
    categoryFilter.replaceChildren(new Option("Все категории", ""));
    datalist.replaceChildren();
    for (const category of categories) {
      categoryFilter.add(new Option(category, category));
      datalist.append(new Option(category));
    }
    categoryFilter.value = selected;
  } catch (error) {
    message.textContent = error.message;
  }
}

function openCreateDialog() {
  adForm.reset();
  document.getElementById("listing-id").value = "";
  document.getElementById("listing-status").value = "active";
  dialogTitle.textContent = "Новое объявление";
  dialog.showModal();
  document.getElementById("listing-title").focus();
}

async function openEditDialog(id) {
  try {
    const ad = await api(`/api/ads/${id}`);
    document.getElementById("listing-id").value = ad.id;
    document.getElementById("listing-title").value = ad.title;
    document.getElementById("listing-description").value = ad.description;
    document.getElementById("listing-price").value = ad.price;
    document.getElementById("listing-category").value = ad.category;
    document.getElementById("listing-status").value = ad.status;
    dialogTitle.textContent = "Редактировать объявление";
    dialog.showModal();
  } catch (error) {
    message.textContent = error.message;
  }
}

adForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = document.getElementById("listing-id").value;
  const payload = {
    title: document.getElementById("listing-title").value,
    description: document.getElementById("listing-description").value,
    price: Number(document.getElementById("listing-price").value),
    category: document.getElementById("listing-category").value,
    status: document.getElementById("listing-status").value,
  };

  try {
    await api(id ? `/api/ads/${id}` : "/api/ads", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    dialog.close();
    message.textContent = id ? "Объявление обновлено." : "Объявление опубликовано.";
    await loadCategories(categoryFilter.value);
    await loadAds();
  } catch (error) {
    message.textContent = error.message;
  }
});

adsList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  const id = button?.closest(".listing-card")?.dataset.id;
  if (!button || !id) return;

  if (button.dataset.action === "edit") {
    await openEditDialog(id);
    return;
  }

  if (!window.confirm("Удалить это объявление без возможности восстановления?")) return;
  try {
    await api(`/api/ads/${id}`, { method: "DELETE" });
    message.textContent = "Объявление удалено.";
    await loadCategories(categoryFilter.value);
    await loadAds();
  } catch (error) {
    message.textContent = error.message;
  }
});

filtersForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadAds();
});

document.getElementById("reset-filters").addEventListener("click", () => {
  filtersForm.reset();
  loadAds();
});
document.getElementById("open-listing-form").addEventListener("click", openCreateDialog);
document.getElementById("close-dialog").addEventListener("click", () => dialog.close());
document.getElementById("cancel-dialog").addEventListener("click", () => dialog.close());

Promise.all([loadCategories(), loadAds()]);
