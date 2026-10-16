"use strict";

const path = require("node:path");
const express = require("express");
const { createDatabase, validateAd, STATUSES } = require("./db");

function parsePrice(value, name) {
  if (value === undefined || value === "") return { value: undefined };
  const price = Number(value);
  return !Number.isFinite(price) || price < 0
    ? { error: `${name} должна быть неотрицательным числом.` }
    : { value: price };
}

function createApp(database = createDatabase(process.env.DATABASE_PATH)) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "48kb" }));

  app.get("/api/ads", (request, response) => {
    const { category, status, q } = request.query;
    if (status !== undefined && status !== "" && !STATUSES.has(status)) {
      return response.status(400).json({ error: "Неизвестный статус объявления." });
    }

    const minPrice = parsePrice(request.query.minPrice, "Минимальная цена");
    const maxPrice = parsePrice(request.query.maxPrice, "Максимальная цена");
    if (minPrice.error) return response.status(400).json({ error: minPrice.error });
    if (maxPrice.error) return response.status(400).json({ error: maxPrice.error });
    if (
      minPrice.value !== undefined &&
      maxPrice.value !== undefined &&
      minPrice.value > maxPrice.value
    ) {
      return response.status(400).json({ error: "Минимальная цена не может быть больше максимальной." });
    }

    const conditions = [];
    const params = [];

    if (category) {
      conditions.push("category = ?");
      params.push(category);
    }
    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }
    if (minPrice.value !== undefined) {
      conditions.push("price >= ?");
      params.push(minPrice.value);
    }
    if (maxPrice.value !== undefined) {
      conditions.push("price <= ?");
      params.push(maxPrice.value);
    }
    if (q && String(q).trim()) {
      conditions.push("LOWER(title) LIKE LOWER(?)");
      params.push(`%${String(q).trim()}%`);
    }

    const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
    const ads = database.prepare(`SELECT * FROM ads${where} ORDER BY id DESC`).all(...params);
    return response.json(ads);
  });

  app.get("/api/ads/:id", (request, response) => {
    const ad = database.prepare("SELECT * FROM ads WHERE id = ?").get(request.params.id);
    return ad ? response.json(ad) : response.status(404).json({ error: "Объявление не найдено." });
  });

  app.get("/api/categories", (request, response) => {
    const categories = database
      .prepare("SELECT DISTINCT category FROM ads ORDER BY category COLLATE NOCASE")
      .all()
      .map((row) => row.category);
    response.json(categories);
  });

  app.post("/api/ads", (request, response) => {
    const validated = validateAd(request.body);
    if (validated.error) return response.status(400).json({ error: validated.error });

    const ad = validated.value;
    const result = database
      .prepare(
        "INSERT INTO ads (title, description, price, category, status) VALUES (?, ?, ?, ?, ?)",
      )
      .run(ad.title, ad.description, ad.price, ad.category, ad.status);
    return response
      .status(201)
      .json(database.prepare("SELECT * FROM ads WHERE id = ?").get(result.lastInsertRowid));
  });

  app.put("/api/ads/:id", (request, response) => {
    const validated = validateAd(request.body);
    if (validated.error) return response.status(400).json({ error: validated.error });

    const ad = validated.value;
    const result = database
      .prepare(
        "UPDATE ads SET title = ?, description = ?, price = ?, category = ?, status = ? WHERE id = ?",
      )
      .run(ad.title, ad.description, ad.price, ad.category, ad.status, request.params.id);
    if (result.changes === 0) {
      return response.status(404).json({ error: "Объявление не найдено." });
    }

    return response.json(
      database.prepare("SELECT * FROM ads WHERE id = ?").get(request.params.id),
    );
  });

  app.delete("/api/ads/:id", (request, response) => {
    const result = database.prepare("DELETE FROM ads WHERE id = ?").run(request.params.id);
    return result.changes === 0
      ? response.status(404).json({ error: "Объявление не найдено." })
      : response.status(204).end();
  });

  app.use(express.static(path.join(__dirname, "public")));
  app.use((request, response) => response.status(404).json({ error: "Маршрут не найден." }));
  app.use((error, request, response, next) => {
    console.error(error);
    response.status(500).json({ error: "Внутренняя ошибка сервера." });
  });

  app.locals.database = database;
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => console.log(`Сервер запущен: http://localhost:${port}`));
}

module.exports = { createApp };
