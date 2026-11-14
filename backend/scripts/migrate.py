"""Sıradaki SQL göçlerini uygular: python -m scripts.migrate"""

from pathlib import Path

import psycopg

from app.db import DATABASE_URL

MIGRATIONS = Path(__file__).resolve().parent.parent / "migrations"


def migrate(url: str = DATABASE_URL) -> list[str]:
    applied = []
    with psycopg.connect(url) as conn:
        conn.execute("create table if not exists schema_migrations (name text primary key, applied_at timestamptz default now())")
        done = {r[0] for r in conn.execute("select name from schema_migrations")}
        for path in sorted(MIGRATIONS.glob("*.sql")):
            if path.name in done:
                continue
            conn.execute(path.read_text(encoding="utf-8"))
            conn.execute("insert into schema_migrations (name) values (%s)", (path.name,))
            applied.append(path.name)
    return applied


if __name__ == "__main__":
    names = migrate()
    print("Uygulanan:", ", ".join(names) if names else "yok (güncel)")
