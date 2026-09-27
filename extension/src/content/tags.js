import { categoryColor } from "../categories.js";

export const TAG_SELECTOR = ".jev-post-tag";

export function renderTag(anchor, { label, title, category = "other", filtered = false, state = "ready", retry = null }) {
  const previous = anchor.nextElementSibling;
  const tag = previous?.matches(TAG_SELECTOR) ? previous : document.createElement("button");
  const changed = tag.textContent !== label || tag.title !== title || tag.dataset.state !== state;
  tag.className = "jev-post-tag";
  tag.type = "button";
  tag.dataset.category = category;
  tag.dataset.filtered = String(filtered);
  tag.style.setProperty("--jev-category-color", categoryColor(category));
  if (changed) {
    tag.textContent = label;
    tag.title = title;
    tag.dataset.state = state;
    tag.setAttribute("aria-label", title);
  }
  tag.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    retry?.();
  };
  if (!tag.isConnected) anchor.after(tag);
  return tag;
}
