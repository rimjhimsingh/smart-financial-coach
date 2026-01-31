from pathlib import Path
import pandas as pd
from typing import Optional, List, Dict


from .store import STORE
from ..utils.normalize import normalize_transactions


def _repo_root() -> Path:
    # smart_financial_coach/backend/src/services/ingestion_service.py
    # parents[3] => smart_financial_coach
    return Path(__file__).resolve().parents[3]

def seed_demo_data() -> dict:
    root = _repo_root()
    data_dir = root / "data"

    files = [
        ("amex", data_dir / "american_express.csv"),
        ("sofi", data_dir / "sofi.csv"),
        ("chase", data_dir / "chase_bank.csv"),
    ]

    dfs = []
    for account_id, path in files:
        if not path.exists():
            raise ValueError(f"Missing CSV file: {path}")

        df_raw = pd.read_csv(path)
        df_norm = normalize_transactions(df_raw, account_id)

        STORE.accounts[account_id] = {
            "account_id": account_id,
            "name": account_id,
            "account_type": "unknown",
        }
        dfs.append(df_norm)

    merged = pd.concat(dfs, ignore_index=True)
    merged = merged.drop_duplicates(subset=["transaction_id"], keep="last")

    STORE.transactions = merged

    return get_stats()

def get_stats() -> dict:
    if STORE.transactions.empty:
        return {"accounts_loaded": [], "total_rows": 0}

    return {
        "accounts_loaded": list(STORE.accounts.keys()),
        "total_rows": int(STORE.transactions.shape[0]),
        "date_min": str(STORE.transactions["posted_date"].min()),
        "date_max": str(STORE.transactions["posted_date"].max()),
    }

def list_transactions(account_id: Optional[str] = None, limit: int = 25) -> List[Dict]:
    if STORE.transactions.empty:
        return []

    df = STORE.transactions.copy()
    if account_id:
        df = df[df["account_id"] == account_id]

    df = df.sort_values("posted_date", ascending=False)
    return df.head(limit).to_dict(orient="records")
