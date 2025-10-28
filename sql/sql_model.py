# models.py
from __future__ import annotations
import os
from dataclasses import dataclass
from typing import Optional
from sqlalchemy import (
    create_engine, ForeignKey, String, Enum, UniqueConstraint
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, Session
from sqlalchemy.dialects.mysql import INTEGER, BIGINT
from dotenv import load_dotenv

load_dotenv()
ENGINE = create_engine(os.environ["DATABASE_URL"], pool_pre_ping=True)

class Base(DeclarativeBase): pass

class ItemClass(Base):
    __tablename__ = "item_classes"
    id: Mapped[int] = mapped_column(INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)

    base_types: Mapped[list["BaseType"]] = relationship(back_populates="item_class")

class BaseType(Base):
    __tablename__ = "base_types"
    id: Mapped[int] = mapped_column(INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    item_class_id: Mapped[int] = mapped_column(ForeignKey("item_classes.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    href: Mapped[Optional[str]] = mapped_column(String(255))

    item_class: Mapped["ItemClass"] = relationship(back_populates="base_types")
    items: Mapped[list["Item"]] = relationship(back_populates="base_type")

    __table_args__ = (UniqueConstraint("item_class_id", "name", name="uniq_base"),)

class Item(Base):
    __tablename__ = "items"
    id: Mapped[int] = mapped_column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    base_type_id: Mapped[int] = mapped_column(ForeignKey("base_types.id"), nullable=False)
    rarity: Mapped[str] = mapped_column(
        Enum("Normal","Magic","Rare","Unique","Gem","Currency","Other", name="rarity_enum"),
        nullable=False
    )
    unique_name: Mapped[Optional[str]] = mapped_column(String(255))
    source: Mapped[Optional[str]] = mapped_column(String(255))
    page_type: Mapped[Optional[str]] = mapped_column(String(64))

    base_type: Mapped["BaseType"] = relationship(back_populates="items")
    stats: Mapped[list["ItemStat"]] = relationship(back_populates="item", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("base_type_id", "rarity", "unique_name", name="uniq_item"),)

class ItemStat(Base):
    __tablename__ = "item_stats"
    id: Mapped[int] = mapped_column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), nullable=False)
    stat_key: Mapped[str] = mapped_column(String(64), nullable=False)
    stat_value: Mapped[str] = mapped_column(String(255), nullable=False)

    item: Mapped["Item"] = relationship(back_populates="stats")

def init_db():
    Base.metadata.create_all(ENGINE)

def get_session() -> Session:
    return Session(ENGINE)
