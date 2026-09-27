import test from "node:test";
import assert from "node:assert/strict";
import { ClassificationQueue } from "../src/content/classifier.js";
import { classifyPost } from "../src/background/api.js";

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("different posts overlap; duplicate requests share work; concurrency is bounded", async () => {
  const calls = [];
  const releases = [];
  const queue = new ClassificationQueue((post) => {
    calls.push(post);
    return new Promise((resolve) => releases.push(resolve));
  }, { concurrency: 2 });
  const first = queue.get("one", { post_id: "1" });
  const duplicate = queue.get("one", { post_id: "1" });
  const second = queue.get("two", { post_id: "2" });
  const third = queue.get("three", { post_id: "3" });
  assert.equal(first, duplicate);
  await tick();
  assert.equal(calls.length, 2);
  releases[1]("gaming");
  await tick();
  assert.equal(calls.length, 3);
  releases[0]("ai");
  releases[2]("politics");
  assert.deepEqual(await Promise.all([first, second, third]), ["ai", "gaming", "politics"]);
  assert.equal(await queue.get("one", {}), "ai");
  assert.equal(calls.length, 3);
});

test("failures are retryable and do not block the queue", async () => {
  let calls = 0;
  const queue = new ClassificationQueue(async () => {
    if (++calls === 1) throw new Error("offline");
    return "ai";
  }, { concurrency: 1 });
  await assert.rejects(queue.get("one", {}), /offline/);
  await tick();
  assert.equal(await queue.get("one", {}), "ai");
});

test("completed cache is bounded", async () => {
  let calls = 0;
  const queue = new ClassificationQueue(async () => ++calls, { cacheSize: 1 });
  await queue.get("one", {});
  await tick();
  await queue.get("two", {});
  await tick();
  assert.equal(await queue.get("one", {}), 3);
});

test("API sends one post and validates response identity", async () => {
  const post = { post_id: "123", text: "AI post" };
  const result = { post_id: "123", category: "ai", label: "AI", confidence: 0.8 };
  const fetcher = async (url, options) => {
    assert.equal(url, "http://127.0.0.1:8000/api/classify");
    assert.deepEqual(JSON.parse(options.body), post);
    return new Response(JSON.stringify(result));
  };
  assert.deepEqual(await classifyPost(post, fetcher), result);
  await assert.rejects(classifyPost(post, async () => new Response(JSON.stringify({ ...result, post_id: "999" }))), /Invalid/);
});
