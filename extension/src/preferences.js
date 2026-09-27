export const VISIBILITY_PREFIX = "categoryVisible:";

export function visibilityKey(category) {
  return `${VISIBILITY_PREFIX}${category}`;
}

export function hiddenCategories(settings) {
  return new Set(Object.entries(settings)
    .filter(([key, value]) => key.startsWith(VISIBILITY_PREFIX) && value === false)
    .map(([key]) => key.slice(VISIBILITY_PREFIX.length)));
}
