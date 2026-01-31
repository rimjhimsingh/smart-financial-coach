import pandas as pd

REQUIRED_COLS = {
    "transaction_id",
    "posted_date",
    "merchant",
    "amount",
    "currency",
    "category",
}

CANONICAL_COLS = [
    "transaction_id",
    "posted_date",
    "merchant",
    "amount",
    "currency",
    "category",
    "account_id",
    "direction",
]

def normalize_merchant(s: str) -> str:
    if s is None:
        return ""
    s = str(s).strip()
    return " ".join(s.split())

def normalize_transactions(df: pd.DataFrame, account_id: str) -> pd.DataFrame:
    missing = REQUIRED_COLS - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    out = df.copy()

    out["posted_date"] = pd.to_datetime(out["posted_date"], errors="coerce").dt.date
    if out["posted_date"].isna().any():
        raise ValueError("Invalid posted_date values found")

    out["amount"] = pd.to_numeric(out["amount"], errors="coerce")
    if out["amount"].isna().any():
        raise ValueError("Invalid amount values found")

    out["merchant"] = out["merchant"].apply(normalize_merchant)
    out["currency"] = out["currency"].fillna("USD").astype(str)
    out["category"] = out["category"].fillna("Uncategorized").astype(str)

    out["account_id"] = account_id
    out["direction"] = out["amount"].apply(lambda x: "expense" if x < 0 else "income")

    return out[CANONICAL_COLS]
