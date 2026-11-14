"""Arama önerileri: kullanıcı yazarken hizmet alanı, hizmet ve işletme önerir.

Katalog (catalog.json) ve işletme sayısı küçük olduğu sürece eşleştirme bellekte yapılır.
İşletme sayısı binlerle ölçülmeye başladığında Postgres tam metin araması (ya da pg_trgm)
ile değiştirilmelidir; dışarıya açılan biçim aynı kalır.
"""

from __future__ import annotations

import json
from pathlib import Path

CATALOG = Path(__file__).resolve().parent.parent / "catalog.json"

_KATLA = str.maketrans("çğıöşüâîûÇĞİÖŞÜÂÎÛI", "cgiosuaiucgiosuaiui")
TUR_SIRASI = {"alan": 0, "hizmet": 1, "isletme": 2}


def katla(metin: str) -> str:
    """Türkçe karakterleri sadeleştirip küçük harfe çevirir: 'Dişçi' -> 'disci'."""
    return " ".join(metin.translate(_KATLA).lower().split())


def katalog() -> list[dict]:
    try:
        return json.loads(CATALOG.read_text(encoding="utf-8"))["alanlar"]
    except (FileNotFoundError, KeyError, json.JSONDecodeError):
        return []


def alan_adlari() -> dict[str, str]:
    return {a["id"]: a["ad"] for a in katalog()}


def puan(sorgu: str, metin: str) -> int:
    """0 = eşleşmez. Tam eşleşme > baştan eşleşme > bir kelimenin başı > tüm kelimeler > içinde geçer."""
    if not sorgu or not metin:
        return 0
    if metin == sorgu:
        return 100
    if metin.startswith(sorgu):
        return 80
    kelimeler = metin.split()
    if any(k.startswith(sorgu) for k in kelimeler):
        return 60
    parcalar = sorgu.split()
    if len(parcalar) > 1 and all(any(k.startswith(p) for k in kelimeler) for p in parcalar):
        return 50
    if sorgu in metin:
        return 30
    return 0


def oner(sorgu: str, hizmetler: list[dict], isletmeler: list[dict], limit: int = 8) -> list[dict]:
    """hizmetler: [{name, subcategory}], isletmeler: [{slug, name, title, subcategory, district}]."""
    q = katla(sorgu)
    if not q:
        return []
    adlar = alan_adlari()
    adaylar: list[tuple[int, int, str, dict]] = []

    for a in katalog():
        # Alanın kendi adı öne çıkar; eş anlamlı eşleşmesi, aynı adı taşıyan gerçek bir hizmetin gerisinde kalır.
        p = max([puan(q, katla(a["ad"])) + 5] + [puan(q, katla(e)) - 5 for e in a.get("esanlam", [])])
        if p > 5:
            adaylar.append((p, TUR_SIRASI["alan"], a["ad"], {"tur": "alan", "etiket": a["ad"], "alt": "", "alan": a["id"]}))

    gruplu: dict[tuple[str, str], dict] = {}
    for h in hizmetler:
        anahtar = (h["subcategory"], katla(h["name"]))
        if anahtar not in gruplu:
            gruplu[anahtar] = {"name": h["name"], "subcategory": h["subcategory"], "adet": 0}
        gruplu[anahtar]["adet"] += 1
    for (alan, ad_katli), h in gruplu.items():
        p = puan(q, ad_katli)
        if p:
            alan_adi = adlar.get(alan, alan)
            adaylar.append((p, TUR_SIRASI["hizmet"], h["name"], {
                "tur": "hizmet", "etiket": h["name"], "alt": f"{alan_adi} · {h['adet']} yer",
                "alan": alan, "hizmet": h["name"],
            }))

    for i in isletmeler:
        p = max(puan(q, katla(i["name"])), puan(q, katla(i["title"])) - 10)
        if p > 0:
            adaylar.append((p, TUR_SIRASI["isletme"], i["name"], {
                "tur": "isletme", "etiket": i["name"], "alt": f"{i['title']} · {i['district']}",
                "alan": i["subcategory"], "slug": i["slug"],
            }))

    adaylar.sort(key=lambda a: (-a[0], a[1], katla(a[2])))
    return [a[3] for a in adaylar[:limit]]
