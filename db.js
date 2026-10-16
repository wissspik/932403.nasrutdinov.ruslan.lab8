"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const STATUSES = new Set(["active", "sold", "archived"]);

function createDatabase(filename = path.join(__dirname, "data", "ads.db")) {
  if (filename !== ":memory:") fs.mkdirSync(path.dirname(filename), { recursive: true });

  const database = new DatabaseSync(filename);
  database.exec(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));

  const { count } = database.prepare("SELECT COUNT(*) AS count FROM ads").get();
  if (count === 0) {
    const insert = database.prepare(
      "INSERT INTO ads (title, description, price, category, status) VALUES (?, ?, ?, ?, ?)",
    );
    database.exec("BEGIN");
    try {
      insert.run("Настольная лампа", "Тёплый свет, три режима яркости, отличное состояние.", 1800, "Дом", "active");
      insert.run("Учебник по JavaScript", "Современное издание, есть аккуратные заметки карандашом.", 900, "Книги", "active");
      insert.run("Городской велосипед", "Алюминиевая рама, 7 скоростей, после обслуживания.", 14500, "Спорт", "sold");
      insert.run("Механическая клавиатура", "Компактная клавиатура, тихие переключатели, USB-C.", 4200, "Электроника", "active");
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  return database;
}

function validateAd(input) {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const category = typeof input.category === "string" ? input.category.trim() : "";
  const status = typeof input.status === "string" ? input.status.trim() : "";
  const price = Number(input.price);

  if (!title) return { error: "Заголовок обязателен." };
  if (!description) return { error: "Описание обязательно." };
  if (!category) return { error: "Категория обязательна." };
  if (!Number.isFinite(price) || price < 0) {
    return { error: "Цена должна быть неотрицательным числом." };
  }
  if (!STATUSES.has(status)) {
    return { error: "Статус должен быть active, sold или archived." };
  }

  return { value: { title, description, price, category, status } };
}

module.exports = { createDatabase, validateAd, STATUSES };
