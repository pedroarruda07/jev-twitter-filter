from pathlib import Path

from pydantic import TypeAdapter

from .schemas import Category


def load_categories(path: Path | None = None) -> dict[str, Category]:
    path = path or Path(__file__).with_name("categories.json")
    categories = TypeAdapter(list[Category]).validate_json(path.read_text(encoding="utf-8"))
    result = {category.id: category for category in categories}
    if not 2 <= len(result) <= 20 or len(result) != len(categories) or "other" not in result:
        raise ValueError("Configure 2–20 unique categories, including 'other'.")
    return result
