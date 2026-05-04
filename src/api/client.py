"""
Low-level HTTP wrappers for Simla REST v5 and GraphQL APIs.
All callers should use SimlaClient — never import httpx directly from UI code.
"""
import os
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()


class SimlaClient:
    """Thread-safe synchronous client for Simla REST v5 and GraphQL."""

    def __init__(
        self,
        store: str | None = None,
        api_key: str | None = None,
        graphql_token: str | None = None,
    ):
        self.store = store or os.environ["SIMLA_STORE"]
        self.api_key = api_key or os.environ["SIMLA_API_KEY"]
        self.graphql_token = graphql_token or os.getenv("SIMLA_GRAPHQL_TOKEN")

        self._base_rest = f"https://{self.store}.simla.com/api/v5"
        self._base_graphql = f"https://{self.store}.simla.com/app/api"

        self._http = httpx.Client(timeout=30)

    # ------------------------------------------------------------------
    # REST v5
    # ------------------------------------------------------------------

    def get(self, path: str, params: dict | None = None) -> dict:
        """GET /api/v5/<path> with automatic apiKey injection."""
        merged = {"apiKey": self.api_key, **(params or {})}
        response = self._http.get(f"{self._base_rest}/{path.lstrip('/')}", params=merged)
        response.raise_for_status()
        return response.json()

    # ------------------------------------------------------------------
    # GraphQL
    # ------------------------------------------------------------------

    def graphql(self, query: str, variables: dict | None = None) -> dict:
        """Execute a GraphQL query. Requires SIMLA_GRAPHQL_TOKEN."""
        if not self.graphql_token:
            raise RuntimeError("SIMLA_GRAPHQL_TOKEN is not set")
        response = self._http.post(
            self._base_graphql,
            json={"query": query, "variables": variables or {}},
            headers={"Authorization": f"Bearer {self.graphql_token}"},
        )
        response.raise_for_status()
        payload: dict[str, Any] = response.json()
        if "errors" in payload:
            raise RuntimeError(f"GraphQL errors: {payload['errors']}")
        return payload["data"]

    # ------------------------------------------------------------------
    # Reference data (cached per instance)
    # ------------------------------------------------------------------

    def get_statuses(self) -> list[dict]:
        return self.get("statuses").get("statuses", [])

    def get_order_types(self) -> list[dict]:
        return self.get("order-types").get("orderTypes", [])

    def get_managers(self) -> list[dict]:
        """Return list of CRM users (managers)."""
        return self.get("users").get("users", [])

    def close(self) -> None:
        self._http.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
