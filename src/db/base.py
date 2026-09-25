"""SQLAlchemy 2.0 Declarative Base Class."""

from sqlalchemy.orm import DeclarativeBase, MappedAsDataclass


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass
