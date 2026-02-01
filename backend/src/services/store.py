"""
In Memory Data Store
--------------------
This module defines a simple in memory store used as the shared data layer for the backend.

Purpose:
- Holds the currently loaded set of accounts and normalized transactions for the running process.
- Acts as a single source of truth for services and routes, avoiding passing large DataFrames
  through multiple layers.

What it contains:
- InMemoryStore: A dataclass with two fields
  - accounts: A dictionary keyed by account_id containing basic account metadata.
  - transactions: A pandas DataFrame containing the normalized transaction dataset.
- STORE: A singleton instance of InMemoryStore imported by services to read and write state.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict

import pandas as pd


@dataclass
class InMemoryStore:
    accounts: Dict[str, dict] = field(default_factory=dict)
    transactions: pd.DataFrame = field(default_factory=pd.DataFrame)


STORE = InMemoryStore()
