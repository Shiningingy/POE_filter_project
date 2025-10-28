# load_items.py
from __future__ import annotations
import pandas as pd
from sqlalchemy import select
from sql_model import get_session, ItemClass, BaseType, Item

CSV_PATH = "../data/out/items.csv"

def get_or_create_class(sess, name: str) -> ItemClass:
    ic = sess.scalar(select(ItemClass).where(ItemClass.name == name))
    if ic: return ic
    ic = ItemClass(name=name)
    sess.add(ic); sess.flush()
    return ic

def get_or_create_base(sess, item_class: ItemClass, name: str) -> BaseType:
    bt = sess.scalar(select(BaseType).where(
        BaseType.item_class_id == item_class.id, BaseType.name == name))
    if bt:
        return bt
    bt = BaseType(item_class_id=item_class.id, name=name)
    sess.add(bt); sess.flush()
    return bt

def get_or_create_item(sess, base_type: BaseType, rarity: str, unique_name: str|None) -> Item:
    it = sess.scalar(select(Item).where(
        Item.base_type_id == base_type.id,
        Item.rarity == rarity,
        Item.unique_name == unique_name
    ))
    if it:
        return it
    it = Item(base_type_id=base_type.id, rarity=rarity, unique_name=unique_name)
    sess.add(it); sess.flush()
    return it

def main():
    df = pd.read_csv(CSV_PATH)
    required = {"rarity","unique_name","base_type","item_class"}
    missing = required - set(df.columns)
    if missing:
        raise SystemExit(f"CSV missing columns: {missing}")

    with get_session() as sess:
        for row in df.itertuples(index=False):
            item_class = get_or_create_class(sess, row.item_class)
            base = get_or_create_base(sess, item_class, row.base_type)
            unique_name = row.unique_name if row.rarity == "Unique" else None
            _ = get_or_create_item(sess, base, row.rarity or "Other", unique_name)
        sess.commit()
    print("Import complete ✅")

if __name__ == "__main__":
    main()
