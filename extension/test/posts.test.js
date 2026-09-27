import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { extractPost } from "../src/content/posts.js";
import { ClassificationQueue } from "../src/content/classifier.js";
import { PostController } from "../src/content/controller.js";
import { categoryColor } from "../src/categories.js";

function markup(id, text = "An AI model") {
  return `<article data-testid="tweet"><div><a role="link" href="/person/status/${id}"><time>2h</time></a></div><div data-testid="tweetText">${text}</div></article>`;
}

function setup(html) {
  const dom = new JSDOM(`<body>${html}</body>`, { url: "https://x.com/home" });
  globalThis.document = dom.window.document;
  globalThis.MutationObserver = dom.window.MutationObserver;
  return dom;
}

const wait = () => new Promise((resolve) => setTimeout(resolve, 120));

test("extracts only the outer post, excluding quoted text and date", () => {
  const dom = setup(markup("123", "Outer text"));
  const article = document.querySelector("article");
  article.insertAdjacentHTML("beforeend", `<div role="link"><a href="/quote/status/456"><time>1h</time></a><div data-testid="tweetText">Quoted text</div></div>`);
  const post = extractPost(article);
  assert.equal(post.post_id, "123");
  assert.equal(post.text, "Outer text");
  dom.window.close();
});

test("initial and dynamically inserted posts get one tag next to the date", async () => {
  const dom = setup(markup("1"));
  const calls = [];
  const queue = new ClassificationQueue(async (post) => {
    calls.push(post.post_id);
    return { label: "AI", confidence: 0.9 };
  });
  const controller = new PostController(document.body, queue);
  controller.start();
  await wait();
  const anchor = document.querySelector("a");
  assert.equal(anchor.nextElementSibling.textContent, "AI");
  document.querySelector("time").textContent = "3h";
  document.body.insertAdjacentHTML("beforeend", markup("2"));
  await wait();
  assert.deepEqual(calls, ["1", "2"]);
  assert.equal(document.querySelectorAll(".jev-post-tag").length, 2);
  anchor.nextElementSibling.remove();
  await wait();
  assert.equal(anchor.nextElementSibling.textContent, "AI");
  assert.equal(calls.length, 2);
  controller.stop();
  dom.window.close();
});

test("recycled article ignores a late result for its previous post", async () => {
  const dom = setup(markup("1"));
  const releases = new Map();
  const queue = new ClassificationQueue((post) => new Promise((resolve) => releases.set(post.post_id, resolve)));
  const controller = new PostController(document.body, queue);
  controller.start();
  await wait();
  document.querySelector("a").href = "/person/status/2";
  document.querySelector('[data-testid="tweetText"]').textContent = "A game";
  await wait();
  releases.get("2")({ label: "Gaming", confidence: 0.9 });
  await wait();
  releases.get("1")({ label: "AI", confidence: 0.9 });
  await wait();
  assert.equal(document.querySelector(".jev-post-tag").textContent, "Gaming");
  controller.stop();
  dom.window.close();
});

test("empty posts are skipped and late hydrated text is classified", async () => {
  const dom = setup(markup("1", ""));
  let calls = 0;
  const controller = new PostController(document.body, new ClassificationQueue(async () => {
    calls++;
    return { label: "AI", confidence: 0.9 };
  }));
  controller.start();
  assert.equal(document.querySelector(".jev-post-tag").textContent, "No text");
  assert.equal(calls, 0);
  document.querySelector('[data-testid="tweetText"]').textContent = "New text";
  await wait();
  assert.equal(calls, 1);
  assert.equal(document.querySelector(".jev-post-tag").textContent, "AI");
  controller.stop();
  dom.window.close();
});

test("pause removes tags and resume reuses cached results", async () => {
  const dom = setup(markup("1"));
  let calls = 0;
  const controller = new PostController(document.body, new ClassificationQueue(async () => {
    calls++;
    return { label: "AI", confidence: 0.9 };
  }));
  controller.start();
  await wait();
  controller.setEnabled(false);
  await wait();
  assert.equal(document.querySelector(".jev-post-tag"), null);
  controller.setEnabled(true);
  await wait();
  assert.equal(document.querySelector(".jev-post-tag").textContent, "AI");
  assert.equal(calls, 1);
  controller.stop();
  dom.window.close();
});

test("saved filters apply on completion, toggle immediately, and restore after pause", async () => {
  const dom = setup(markup("1"));
  let release;
  let calls = 0;
  const controller = new PostController(document.body, new ClassificationQueue(() => {
    calls++;
    return new Promise((resolve) => { release = resolve; });
  }));
  controller.hiddenCategories = new Set(["ai_generated"]);
  controller.start();
  const article = document.querySelector("article");
  assert.equal(article.hasAttribute("data-jev-filtered"), false);
  await wait();
  release({ category: "ai_generated", label: "AI-generated", confidence: 0.9 });
  await wait();
  assert.equal(article.hasAttribute("data-jev-filtered"), true);
  const tag = article.querySelector(".jev-post-tag");
  assert.equal(tag.textContent, "AI-generated");
  assert.equal(tag.dataset.filtered, "true");
  assert.equal(tag.style.getPropertyValue("--jev-category-color"), categoryColor("ai_generated"));
  controller.setHiddenCategories([]);
  assert.equal(article.hasAttribute("data-jev-filtered"), false);
  assert.equal(tag.dataset.filtered, "false");
  controller.setHiddenCategories(["ai_generated"]);
  assert.equal(article.hasAttribute("data-jev-filtered"), true);
  controller.setEnabled(false);
  assert.equal(article.hasAttribute("data-jev-filtered"), false);
  controller.setEnabled(true);
  await wait();
  assert.equal(article.hasAttribute("data-jev-filtered"), true);
  assert.equal(calls, 1);
  controller.stop();
  dom.window.close();
});

test("recycled filtered posts clear filtering while the next classification is pending", async () => {
  const dom = setup(markup("1"));
  const releases = new Map();
  const controller = new PostController(document.body, new ClassificationQueue((post) =>
    new Promise((resolve) => releases.set(post.post_id, resolve))));
  controller.hiddenCategories = new Set(["ai_generated"]);
  controller.start();
  await wait();
  releases.get("1")({ category: "ai_generated", label: "AI-generated", confidence: 1 });
  await wait();
  const article = document.querySelector("article");
  assert.equal(article.hasAttribute("data-jev-filtered"), true);
  document.querySelector("a").href = "/person/status/2";
  await wait();
  assert.equal(article.hasAttribute("data-jev-filtered"), false);
  releases.get("2")({ category: "tv", label: "TV", confidence: 1 });
  await wait();
  assert.equal(article.hasAttribute("data-jev-filtered"), false);
  assert.equal(article.querySelector(".jev-post-tag").dataset.category, "tv");
  controller.stop();
  dom.window.close();
});
