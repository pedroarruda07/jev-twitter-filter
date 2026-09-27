import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { hiddenCategories, visibilityKey } from "../src/preferences.js";

const html = await readFile(new URL("../public/popup.html", import.meta.url), "utf8");
const categories = JSON.parse(await readFile(new URL("../../backend/src/jev_backend/categories.json", import.meta.url), "utf8"));
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("popup persists filters, receives external changes, and works offline after reopening", async (t) => {
  const originalFetch = globalThis.fetch;
  const saved = {};
  let listeners = [];
  globalThis.chrome = {
    runtime: { getURL: (path) => `chrome-extension://test/${path}` },
    storage: {
      local: {
        get: async () => ({ ...saved }),
        set: async (values) => {
          Object.assign(saved, values);
          const changes = Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue }]));
          for (const listener of listeners) listener(changes, "local");
        },
      },
      onChanged: { addListener: (listener) => listeners.push(listener) },
    },
  };
  globalThis.fetch = async () => new Response(JSON.stringify(categories));
  let dom = new JSDOM(html);
  t.after(() => { dom.window.close(); globalThis.fetch = originalFetch; delete globalThis.chrome; });
  globalThis.document = dom.window.document;
  await import("../src/popup.js?online");
  assert.equal(document.querySelectorAll(".category-option").length, 9);
  const input = [...document.querySelectorAll(".category-option")]
    .find((label) => label.textContent === "AI-generated").querySelector("input");
  assert.equal(input.checked, true);
  input.checked = false;
  input.dispatchEvent(new dom.window.Event("change"));
  await tick();
  assert.deepEqual([...hiddenCategories(saved)], ["ai_generated"]);
  await chrome.storage.local.set({ [visibilityKey("tv")]: false });
  const tvInput = [...document.querySelectorAll(".category-option")]
    .find((label) => label.textContent === "TV").querySelector("input");
  assert.equal(tvInput.checked, false);
  dom.window.close();
  listeners = [];
  dom = new JSDOM(html);
  globalThis.document = dom.window.document;
  globalThis.fetch = async () => { throw new Error("offline"); };
  await import("../src/popup.js?offline");
  assert.equal(document.querySelectorAll(".category-option").length, 9);
  assert.equal(document.querySelectorAll(".category-option input:not(:checked)").length, 2);
  assert.match(document.querySelector("#status").textContent, /offline/);
});
