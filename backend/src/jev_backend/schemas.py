from pydantic import BaseModel, ConfigDict, Field


class PostRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    post_id: str = Field(pattern=r"^\d{1,30}$")
    text: str = Field(min_length=1, max_length=20000)


class Category(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    id: str = Field(pattern=r"^[a-z][a-z0-9_]{0,39}$")
    label: str = Field(min_length=1, max_length=40)
    description: str = Field(min_length=1, max_length=1000)


class Classification(BaseModel):
    post_id: str
    category: str
    label: str
    confidence: float = Field(ge=0, le=1)


class ChoiceAnswer(BaseModel):
    choice: str
    confidence: float = Field(ge=0, le=1)
