import { extractPost, POST_SELECTOR, postKey } from "./posts.js";
import { renderTag, TAG_SELECTOR } from "./tags.js";

export class PostController {
  constructor(root, queue) {
    this.root = root;
    this.queue = queue;
    this.enabled = true;
    this.states = new WeakMap();
    this.dirty = new Set();
    this.timer = null;
    this.observer = new MutationObserver((records) => this.onMutations(records));
  }

  start() {
    this.observer.observe(this.root, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ["href", "data-testid"],
    });
    this.scan();
  }

  scan() {
    this.root.querySelectorAll(POST_SELECTOR).forEach((article) => this.process(article));
  }

  onMutations(records) {
    for (const record of records) {
      const element = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      if (element?.closest(TAG_SELECTOR)) continue;
      const article = element?.closest(POST_SELECTOR);
      if (article) this.dirty.add(article);
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        const el = /** @type {Element} */ (node);
        if (el.matches(POST_SELECTOR)) this.dirty.add(el);
        el.querySelectorAll(POST_SELECTOR).forEach((post) => this.dirty.add(post));
      }
    }
    if (this.timer === null && this.dirty.size) {
      this.timer = setTimeout(() => {
        this.timer = null;
        const articles = [...this.dirty];
        this.dirty.clear();
        articles.forEach((article) => this.process(article));
      }, 80);
    }
  }

  process(article) {
    if (!this.enabled || !article.isConnected) return;
    const post = extractPost(article);
    if (!post) return;
    const key = postKey(post);
    let state = this.states.get(article);
    if (!state || state.key !== key) {
      article.querySelectorAll(TAG_SELECTOR).forEach((tag) => tag.remove());
      state = { key, status: post.text ? "pending" : "empty", result: null, error: "" };
      this.states.set(article, state);
      if (post.text) {
        this.queue.get(key, { post_id: post.post_id, text: post.text }).then((result) => {
          state.status = "ready";
          state.result = result;
        }, (error) => {
          state.status = "error";
          state.error = error.message;
        }).finally(() => {
          if (this.states.get(article) === state && article.isConnected) this.process(article);
        });
      }
    }
    if (state.status === "ready") {
      renderTag(post.anchor, {
        label: state.result.label,
        title: `Jev: ${state.result.label} · ${Math.round(state.result.confidence * 100)}% confidence`,
      });
    } else if (state.status === "error") {
      renderTag(post.anchor, {
        label: "Retry", title: state.error, state: "error",
        retry: () => { this.states.delete(article); this.process(article); },
      });
    } else {
      renderTag(post.anchor, state.status === "empty"
        ? { label: "No text", title: "Jev classifies text only; this post has no readable text.", state: "empty" }
        : { label: "Tagging…", title: "Classifying this post with Jev", state: "pending" });
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.queue.cancelQueued();
      this.states = new WeakMap();
      this.root.querySelectorAll(TAG_SELECTOR).forEach((tag) => tag.remove());
    } else this.scan();
  }

  stop() {
    this.observer.disconnect();
    clearTimeout(this.timer);
    this.dirty.clear();
  }
}
