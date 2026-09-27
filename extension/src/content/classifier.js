/** Per-page deduplication and bounded concurrency. Each job sends exactly one post. */
export class ClassificationQueue {
  constructor(classify, { concurrency = 6, cacheSize = 500 } = {}) {
    this.classify = classify;
    this.concurrency = concurrency;
    this.cacheSize = cacheSize;
    this.active = 0;
    this.queue = [];
    this.pending = new Map();
    this.cache = new Map();
  }

  get(key, post) {
    if (this.cache.has(key)) return Promise.resolve(this.cache.get(key));
    if (this.pending.has(key)) return this.pending.get(key);
    const promise = new Promise((resolve, reject) => {
      this.queue.push({ key, post, resolve, reject });
    });
    this.pending.set(key, promise);
    this.drain();
    return promise;
  }

  drain() {
    while (this.active < this.concurrency && this.queue.length) {
      const job = this.queue.shift();
      this.active += 1;
      Promise.resolve().then(() => this.classify(job.post)).then((result) => {
        this.cache.set(job.key, result);
        if (this.cache.size > this.cacheSize) this.cache.delete(this.cache.keys().next().value);
        job.resolve(result);
      }, job.reject).finally(() => {
        this.pending.delete(job.key);
        this.active -= 1;
        this.drain();
      });
    }
  }

  cancelQueued() {
    for (const job of this.queue.splice(0)) {
      this.pending.delete(job.key);
      job.reject(new Error("Classification is paused."));
    }
  }
}
