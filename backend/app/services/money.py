from decimal import Decimal, ROUND_HALF_EVEN


def dollars_to_cents(value) -> int:
    if value is None or value == "":
        return 0
    d = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)
    return int(d * 100)


def cents_to_dollars(cents: int | None) -> float:
    if cents is None:
        return 0.0
    return round(cents / 100.0, 2)
