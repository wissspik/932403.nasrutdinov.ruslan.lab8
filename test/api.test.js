"use strict";

const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const { createDatabase } = require("../db");
const { createApp } = require("../server");

let database;
let server;
let baseUrl;

before(async () => {
  database = createDatabase(":memory:");
  await new Promise((resolve) => {
    server = createApp(database).listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  database.close();
});

test("CRUD объявления", async () => {
  const createdResponse = await fetch(`${baseUrl}/api/ads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Рюкзак",
      description: "Городской рюкзак в хорошем состоянии.",
      price: 2500,
      category: "Аксессуары",
      status: "active",
    }),
  });
  const created = await createdResponse.json();
  assert.equal(createdResponse.status, 201);
  assert.equal(created.price, 2500);

  const updatedResponse = await fetch(`${baseUrl}/api/ads/${created.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...created, price: 2200, status: "sold" }),
  });
  const updated = await updatedResponse.json();
  assert.equal(updated.status, "sold");
  assert.equal(updated.price, 2200);

  assert.equal((await fetch(`${baseUrl}/api/ads/${created.id}`, { method: "DELETE" })).status, 204);
  assert.equal((await fetch(`${baseUrl}/api/ads/${created.id}`)).status, 404);
});

test("фильтры категории, цены и поиска работают вместе", async () => {
  const response = await fetch(
    `${baseUrl}/api/ads?category=${encodeURIComponent("Электроника")}&minPrice=1000&maxPrice=5000&q=${encodeURIComponent("клавиатура")}`,
  );
  const ads = await response.json();
  assert.equal(response.status, 200);
  assert.ok(ads.length >= 1);
  assert.ok(ads.every((ad) => ad.category === "Электроника"));
});

test("отрицательная цена отклоняется", async () => {
  const response = await fetch(`${baseUrl}/api/ads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Ошибка",
      description: "Неверная цена",
      price: -1,
      category: "Другое",
      status: "active",
    }),
  });
  assert.equal(response.status, 400);
});

test("неизвестный статус фильтра отклоняется", async () => {
  assert.equal((await fetch(`${baseUrl}/api/ads?status=unknown`)).status, 400);
});
