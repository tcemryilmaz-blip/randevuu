"""Ödeme geçidi arayüzü.

randevuu parayı kendi hesabında tutmaz: tahsilat lisanslı bir ödeme kuruluşunun
pazar yeri (alt üye işyeri) altyapısıyla yapılır. Sözleşme imzalanana kadar
FakeGateway kullanılır; gerçek para hareketi OLMAZ.
"""

from __future__ import annotations

import secrets
from typing import Protocol


class Gateway(Protocol):
    def charge(self, amount: int, reference: str) -> str: ...
    def refund(self, amount: int, reference: str) -> str: ...


class FakeGateway:
    """Geliştirme geçidi: her işlemi başarılı sayar ve sahte bir referans döner."""

    def charge(self, amount: int, reference: str) -> str:
        return f"fake-charge-{secrets.token_hex(6)}"

    def refund(self, amount: int, reference: str) -> str:
        return f"fake-refund-{secrets.token_hex(6)}"


gateway: Gateway = FakeGateway()
