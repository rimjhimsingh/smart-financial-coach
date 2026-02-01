"""
Ingestion Service
-----------------
This module is responsible for loading transaction data into the in memory STORE and exposing
basic dataset utilities used by API routes.

What it provides:
- seed_demo_data: Loads a fixed set of demo CSVs from the repository data directory, normalizes
  each file into a common schema, registers accounts in STORE, merges all transactions, removes
  duplicates, and stores the result in STORE.transactions.
- get_stats: Returns a lightweight summary of the currently loaded dataset, including which
  accounts are present, row count, and min/max transaction dates.
- list_transactions: Returns a recent transactions list, optionally filtered by account_id and
  limited to a requested number of rows, for UI display and debugging.

Helper:
- _repo_root: Resolves the repository root directory based on this file location so demo data
  can be loaded using stable relative paths.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd

from ..utils.normalize import normalize_transactions
from .store import STORE


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def seed_demo_data() -> dict:
    root = _repo_root()
    data_dir = root / "data"

    files = [
        ("amex", data_dir / "american_express.csv"),
        ("sofi", data_dir / "sofi.csv"),
        ("chase", data_dir / "chase_bank.csv"),
    ]

    dfs: list[pd.DataFrame] = []
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

    if not dfs:
        STORE.transactions = pd.DataFrame()
        return get_stats()

    merged = pd.concat(dfs, ignore_index=True)

    if "transaction_id" in merged.columns:
        merged = merged.drop_duplicates(subset=["transaction_id"], keep="last")
    else:
        merged = merged.drop_duplicates(keep="last")

    if "posted_date" in merged.columns:
        try:
            merged["posted_date"] = pd.to_datetime(merged["posted_date"])
        except Exception:
            pass

    STORE.transactions = merged
    return get_stats()


def get_stats() -> dict:
    df = STORE.transactions
    if df is None or df.empty:
        return {"accounts_loaded": [], "total_rows": 0}

    return {
        "accounts_loaded": list(STORE.accounts.keys()),
        "total_rows": int(df.shape[0]),
        "date_min": str(df["posted_date"].min()) if "posted_date" in df.columns else None,
        "date_max": str(df["posted_date"].max()) if "posted_date" in df.columns else None,
    }


def list_transactions(account_id: Optional[str] = None, limit: int = 25) -> List[Dict]:
    df = STORE.transactions
    if df is None or df.empty:
        return []

    dff = df
    if account_id:
        dff = dff[dff["account_id"] == account_id]

    if "posted_date" in dff.columns:
        dff = dff.sort_values("posted_date", ascending=False)

    return dff.head(limit).to_dict(orient="records")
