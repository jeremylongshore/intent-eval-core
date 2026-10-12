"""Strict structural trajectory contracts; Class-2 proposal 014 is unratified.

Patterns are ECMAScript source, not Python regex. Syntax policy remains pending.
Serialize with ``model_dump(mode="json", by_alias=True, exclude_unset=True)``
to preserve omitted fields. No evidence is read or evaluated here.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    AfterValidator,
    BeforeValidator,
    ConfigDict,
    Field,
    WithJsonSchema,
    field_validator,
    model_validator,
)
from typing_extensions import Self


def _json_integer(value: object) -> object:
    # JSON Schema integers include 1.0, but never booleans or numeric strings.
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def _nonempty(value: str) -> str:
    # Preserve JSON-decoded lone surrogates, accepted by AJV/Zod/J-Rig.
    # Pydantic's Rust StringConstraints rejects them before checking length.
    if not value:
        raise ValueError("String must not be empty")
    return value


_Nonempty = Annotated[
    str, AfterValidator(_nonempty), WithJsonSchema({"type": "string", "minLength": 1})
]
_Count = Annotated[
    int, Field(ge=1, le=9007199254740991), BeforeValidator(_json_integer)
]


class _StrictTrajectoryModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null(cls, value: object) -> object:
        if isinstance(value, dict) and any(item is None for item in value.values()):
            raise ValueError("Trajectory fields may be omitted but cannot be null")
        return value


class TrajectoryToolMatcher(_StrictTrajectoryModel):
    tool: _Nonempty
    input_contains: _Nonempty | None = None


class ToolCalledTarget(TrajectoryToolMatcher):
    min_count: _Count | None = None


class OrderBeforeTarget(_StrictTrajectoryModel):
    first: TrajectoryToolMatcher
    then: TrajectoryToolMatcher


class _FileSelector(_StrictTrajectoryModel):
    path: _Nonempty | None = None
    pattern: _Nonempty | None = None

    @model_validator(mode="after")
    def _exactly_one_selector(self) -> Self:
        if (self.path is None) == (self.pattern is None):
            raise ValueError("Exactly one of path or pattern is required")
        return self


class FileExistsTarget(_FileSelector):
    produced: bool | None = None


class FileMatchesShaInTarget(_FileSelector):
    in_: _Nonempty = Field(alias="in")

    @field_validator("in_")
    @classmethod
    def _relative_sha_record(cls, value: str) -> str:
        if value.startswith("/") or ".." in value.split("/"):
            raise ValueError("in must not start with / or contain a slash-delimited .. segment")
        return value


class _Assertion(_StrictTrajectoryModel):
    negate: bool | None = None


class ToolCalledAssertion(_Assertion):
    class_: Literal["tool-called"] = Field(alias="class")
    target: ToolCalledTarget


class ToolNotCalledAssertion(_Assertion):
    class_: Literal["tool-not-called"] = Field(alias="class")
    target: TrajectoryToolMatcher


class OrderBeforeAssertion(_Assertion):
    class_: Literal["order-before"] = Field(alias="class")
    target: OrderBeforeTarget


class FileExistsAssertion(_Assertion):
    class_: Literal["file-exists"] = Field(alias="class")
    target: FileExistsTarget


class FileMatchesShaInAssertion(_Assertion):
    class_: Literal["file-matches-sha-in"] = Field(alias="class")
    target: FileMatchesShaInTarget


TrajectoryAssertion = Annotated[
    ToolCalledAssertion
    | ToolNotCalledAssertion
    | OrderBeforeAssertion
    | FileExistsAssertion
    | FileMatchesShaInAssertion,
    Field(discriminator="class_"),
]
