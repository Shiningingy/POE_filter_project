from __future__ import annotations
from typing import Dict, Callable, Optional, List
from bs4 import BeautifulSoup
import pandas as pd

ParserFn = Callable[[BeautifulSoup], pd.DataFrame]
REGISTRY: Dict[str, ParserFn] = {}

def register(name: str):
    def deco(fn: ParserFn):
        REGISTRY[name] = fn
        return fn
    return deco

def available_parsers() -> List[str]:
    return sorted(REGISTRY.keys())

def auto_detect_parser(soup: BeautifulSoup) -> Optional[str]: #need to modify
    # Equipment-style indicators
    if soup.select_one("span.uniqueName, span.uniqueTypeLine, a.whiteitem"):
        return "equipment"
    # Currency-style indicators (adjust once you see your currency HTML)
    if soup.select_one(".currency, .currency-item, .currency-row, li.currency, div.currency-card, table.currency"):
        return "currency"
    return None

@register("equipment")
def parse_equipment(soup: BeautifulSoup) -> pd.DataFrame:
    rows = []

    # Uniques
    for name_el in soup.select("span.uniqueName"):
        card = name_el.find_parent(["div","section","article"])
        base_el = card.select_one("span.uniqueTypeLine") if card else None
        if not base_el:
            base_el = name_el.find_next("span", class_="uniqueTypeLine")
        if card:
            a_unique = card.select_one("a.uniqueitem")

        rows.append({
            "rarity": "Unique",
            "unique_name": name_el.get_text(strip=True),
            "base_type": base_el.get_text(strip=True) if base_el else None,
        })

    # Normal base types
    for a in soup.select("a.whiteitem"):
        base_text = a.get_text(strip=True)
        rows.append({
            "rarity": "Normal",
            "base_type": base_text,
        })

    df = pd.DataFrame(rows, columns=["rarity","unique_name","base_type"])
    return df.drop_duplicates().reset_index(drop=True)

@register("currency")
def parse_currency(soup: BeautifulSoup) -> pd.DataFrame:
    """
    Generic currency parser. Tweak selectors to match your actual currency DOM.
    """
    rows = []

    # Pattern A: card/list
    for node in soup.select(".currency, .currency-item, .currency-row, li.currency, div.currency-card"):
        name_el = node.select_one(".currencyName, .name, a, span.title")
        href_el = node.select_one("a")
        if not name_el:
            continue
        name = name_el.get_text(strip=True)
        href = href_el["href"] if (href_el and href_el.has_attr("href")) else None
        rows.append({
            "page_type": "currency",
            "rarity": "Currency",
            "name": name,
            "base_type": name,
            "href": href,
        })

    # Pattern B: table-based fallback
    if not rows:
        table = soup.select_one("table.currency, table.data-table, table.itemTable")
        if table:
            tr_rows = table.select("tr")[1:]
            for tr in tr_rows:
                tds = [td.get_text(strip=True) for td in tr.select("td")]
                if not tds:
                    continue
                name = tds[0]
                a = tr.select_one("a")
                href = a.get("href") if a and a.has_attr("href") else None
                rows.append({
                    "page_type": "currency",
                    "rarity": "Currency",
                    "name": name,
                    "base_type": name,
                    "href": href,
                })

    df = pd.DataFrame(rows, columns=["rarity","unique_name","base_type"])
    return df.drop_duplicates().reset_index(drop=True)
