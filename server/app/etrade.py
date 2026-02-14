"""E*Trade service layer for OAuth and account/position data."""

import json
import os
import secrets
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import dateutil.parser
import pyetrade
from requests.exceptions import JSONDecodeError as RequestsJSONDecodeError

# In-memory session store keyed by session token
_sessions: dict[str, dict[str, Any]] = {}

AUTH_FILE = Path.home() / ".itrade" / "auth.json"


def _get_keys() -> tuple[str, str]:
    key = os.environ.get("ETRADE_API_KEY", "")
    secret = os.environ.get("ETRADE_API_SECRET", "")
    if not key or not secret:
        raise ValueError("ETRADE_API_KEY and ETRADE_API_SECRET environment variables are required")
    return key, secret


def _save_auth(consumer_key: str, consumer_secret: str, oauth_token: str, oauth_token_secret: str) -> None:
    """Persist OAuth tokens to ~/.itrade/auth.json."""
    AUTH_FILE.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "consumer_key": consumer_key,
        "consumer_secret": consumer_secret,
        "oauth_token": oauth_token,
        "oauth_token_secret": oauth_token_secret,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    AUTH_FILE.write_text(json.dumps(data, indent=2))


def _load_auth() -> dict[str, str] | None:
    """Load cached auth tokens if they exist and haven't expired.

    E*Trade access tokens expire at midnight US Eastern time.
    We use a conservative check: tokens older than 12 hours are considered expired.
    """
    if not AUTH_FILE.exists():
        return None
    try:
        data = json.loads(AUTH_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return None

    created = data.get("created_at")
    if not created:
        return None

    created_dt = datetime.fromisoformat(created)
    age_hours = (datetime.now(timezone.utc) - created_dt).total_seconds() / 3600
    if age_hours > 12:
        AUTH_FILE.unlink(missing_ok=True)
        return None

    required = ["consumer_key", "consumer_secret", "oauth_token", "oauth_token_secret"]
    if not all(data.get(k) for k in required):
        return None

    return data


def _clear_auth() -> None:
    """Remove cached auth file."""
    AUTH_FILE.unlink(missing_ok=True)


def restore_session() -> str | None:
    """Try to restore a session from cached auth. Returns session_id or None."""
    data = _load_auth()
    if not data:
        return None

    session_id = secrets.token_hex(16)
    _sessions[session_id] = {
        "consumer_key": data["consumer_key"],
        "consumer_secret": data["consumer_secret"],
        "oauth_token": data["oauth_token"],
        "oauth_token_secret": data["oauth_token_secret"],
    }
    return session_id


def request_token() -> dict[str, str]:
    """Start OAuth flow: get request token and authorize URL."""
    key, secret = _get_keys()
    oauth = pyetrade.ETradeOAuth(key, secret)
    authorize_url = oauth.get_request_token()

    session_id = secrets.token_hex(16)
    _sessions[session_id] = {
        "oauth": oauth,
        "consumer_key": key,
        "consumer_secret": secret,
    }

    return {"sessionId": session_id, "authorizeUrl": authorize_url}


def access_token(session_id: str, verifier_code: str) -> None:
    """Exchange verifier code for access token."""
    session = _sessions.get(session_id)
    if not session:
        raise KeyError("Invalid or expired session")

    oauth: pyetrade.ETradeOAuth = session["oauth"]
    tokens = oauth.get_access_token(verifier_code)

    session["oauth_token"] = tokens["oauth_token"]
    session["oauth_token_secret"] = tokens["oauth_token_secret"]

    # Cache to disk so we don't need to re-auth next time
    _save_auth(
        session["consumer_key"],
        session["consumer_secret"],
        tokens["oauth_token"],
        tokens["oauth_token_secret"],
    )


def _get_accounts_client(session_id: str) -> pyetrade.ETradeAccounts:
    session = _sessions.get(session_id)
    if not session:
        raise KeyError("Invalid or expired session")
    if "oauth_token" not in session:
        raise KeyError("Session not authenticated")

    return pyetrade.ETradeAccounts(
        session["consumer_key"],
        session["consumer_secret"],
        session["oauth_token"],
        session["oauth_token_secret"],
        dev=False,
    )


def _get_base_symbol(product: dict) -> str:
    """Extract the underlying symbol. For options, parse root from OCC-style symbol."""
    symbol = product.get("symbol", "")
    if product.get("securityType") != "OPTN":
        return symbol
    # OCC option symbols start with the root ticker (alpha chars),
    # followed by date/strike info (digits, dashes, spaces)
    root = ""
    for ch in symbol:
        if ch.isalpha():
            root += ch
        else:
            break
    return root or symbol


def _calc_dte(product: dict) -> int | None:
    """Calculate days to expiration from Product's expiry fields."""
    year = product.get("expiryYear")
    month = product.get("expiryMonth")
    day = product.get("expiryDay")
    if not all((year, month, day)):
        return None
    try:
        expiry = date(int(year), int(month), int(day))
        return (expiry - date.today()).days
    except (ValueError, TypeError):
        return None



def _ensure_list(val: Any) -> list:
    """E*Trade sometimes returns a dict instead of a list for single items."""
    if val is None:
        return []
    if isinstance(val, dict):
        return [val]
    return list(val)


def list_accounts(session_id: str) -> list[dict[str, Any]]:
    """List all accounts for the authenticated user."""
    client = _get_accounts_client(session_id)
    resp = client.list_accounts(resp_format="json")

    accounts_resp = resp.get("AccountListResponse", {})
    accounts_data = accounts_resp.get("Accounts", {})
    raw = accounts_data.get("Account", [])

    return _ensure_list(raw)


def get_positions(session_id: str, account_id_key: str) -> list[dict[str, Any]]:
    """Get positions for a specific account."""
    client = _get_accounts_client(session_id)
    resp = client.get_account_portfolio(
        account_id_key,
        resp_format="json",
        view="COMPLETE",
        totals_required=True,
    )

    if not resp:
        return []

    portfolio_resp = resp.get("PortfolioResponse", {})
    account_portfolios = _ensure_list(portfolio_resp.get("AccountPortfolio", []))
    if not account_portfolios:
        return []

    positions = []
    for portfolio in account_portfolios:
        raw_positions = _ensure_list(portfolio.get("Position", []))
        for pos in raw_positions:
            product = pos.get("Product", {})
            quick = pos.get("Quick", {})
            complete = pos.get("Complete", {})
            perf = pos.get("Performance", {})

            quantity = pos.get("quantity", 0)
            price_paid = pos.get("pricePaid", 0)
            market_value = pos.get("marketValue", 0)
            total_cost = pos.get("totalCost", quantity * price_paid)
            day_gain = quick.get("change", 0)
            day_gain_pct = quick.get("changePct", 0)
            total_gain = pos.get("totalGain", market_value - total_cost)
            total_gain_pct = pos.get("totalGainPct", 0)

            positions.append(
                {
                    "symbol": product.get("symbol", ""),
                    "baseSymbol": _get_base_symbol(product),
                    "description": pos.get("symbolDescription", product.get("securityType", "")),
                    "type": product.get("securityType", ""),
                    "strikePrice": product.get("strikePrice"),
                    "callPut": product.get("callPut"),
                    "quantity": quantity,
                    "pricePaid": price_paid,
                    "marketValue": market_value,
                    "totalCost": total_cost,
                    "dayGain": day_gain,
                    "dayGainPct": day_gain_pct,
                    "totalGain": total_gain,
                    "totalGainPct": total_gain_pct,
                    "lastPrice": quick.get("lastTrade", 0),
                    "daysGain": pos.get("daysGain", 0),
                    "pctOfPortfolio": pos.get("pctOfPortfolio", 0),
                    "costPerShare": complete.get("costPerShare", price_paid),
                    # Options Greeks (from COMPLETE view, None for non-options)
                    "dte": _calc_dte(product),
                    "delta": complete.get("delta"),
                    "gamma": complete.get("gamma"),
                    "theta": complete.get("theta"),
                    "vega": complete.get("vega"),
                    "rho": complete.get("rho"),
                    "iv": complete.get("ivPct"),
                    "intrinsicValue": complete.get("intrinsicValue"),
                    "premium": complete.get("premium"),
                    "openInterest": complete.get("openInterest"),
                    "dateAcquired": pos.get("dateAcquired"),
                    "expiryYear": product.get("expiryYear"),
                    "expiryMonth": product.get("expiryMonth"),
                    "expiryDay": product.get("expiryDay"),
                }
            )

    return positions


def _get_order_client(session_id: str) -> pyetrade.ETradeOrder:
    session = _sessions.get(session_id)
    if not session:
        raise KeyError("Invalid or expired session")
    if "oauth_token" not in session:
        raise KeyError("Session not authenticated")

    return pyetrade.ETradeOrder(
        session["consumer_key"],
        session["consumer_secret"],
        session["oauth_token"],
        session["oauth_token_secret"],
        dev=False,
    )


def get_open_orders(session_id: str, account_id_key: str) -> list[dict[str, Any]]:
    """Get open orders for a specific account, returning grouped legs per order."""
    client = _get_order_client(session_id)
    resp = client.list_orders(account_id_key, status="OPEN", resp_format="json")

    if not resp:
        return []

    orders_resp = resp.get("OrdersResponse", {})
    raw_orders = _ensure_list(orders_resp.get("Order", []))

    results: list[dict[str, Any]] = []
    for order in raw_orders:
        order_id = order.get("orderId")
        order_type = order.get("orderType", "")
        for detail in _ensure_list(order.get("OrderDetail", [])):
            limit_price = detail.get("limitPrice")
            if limit_price is None:
                continue
            legs: list[dict[str, Any]] = []
            for instrument in _ensure_list(detail.get("Instrument", [])):
                product = instrument.get("Product", {})
                symbol = product.get("symbol", "")
                if not symbol:
                    continue
                legs.append({
                    "symbol": symbol,
                    "baseSymbol": _get_base_symbol(product),
                    "symbolDescription": instrument.get("symbolDescription", ""),
                    "orderedQuantity": instrument.get("orderedQuantity", 0),
                    "filledQuantity": instrument.get("filledQuantity", 0),
                    "orderAction": instrument.get("orderAction", ""),
                    "strikePrice": product.get("strikePrice"),
                    "callPut": product.get("callPut"),
                    "expiryYear": product.get("expiryYear"),
                    "expiryMonth": product.get("expiryMonth"),
                    "expiryDay": product.get("expiryDay"),
                    "bid": instrument.get("bid"),
                    "ask": instrument.get("ask"),
                    "lastprice": instrument.get("lastprice"),
                    "estimatedCommission": instrument.get("estimatedCommission"),
                })
            if legs:
                results.append({
                    "orderId": order_id,
                    "orderType": order_type,
                    "limitPrice": limit_price,
                    "stopPrice": detail.get("stopPrice"),
                    "priceType": detail.get("priceType", ""),
                    "orderTerm": detail.get("orderTerm", ""),
                    "marketSession": detail.get("marketSession", ""),
                    "placedTime": detail.get("placedTime"),
                    "netPrice": detail.get("netPrice"),
                    "netBid": detail.get("netBid"),
                    "netAsk": detail.get("netAsk"),
                    "status": detail.get("status", ""),
                    "allOrNone": detail.get("allOrNone", False),
                    "baseSymbol": legs[0]["baseSymbol"],
                    "legs": legs,
                })

    return results


def get_account_balance(session_id: str, account_id_key: str) -> dict[str, Any]:
    """Get balance data for a specific account."""
    client = _get_accounts_client(session_id)
    resp = client.get_account_balance(
        account_id_key,
        real_time=True,
        resp_format="json",
    )

    if not resp:
        return {}

    return resp.get("BalanceResponse", {})


def place_exit_order(
    session_id: str,
    account_id_key: str,
    symbol: str,
    security_type: str,
    order_action: str,
    quantity: int,
    limit_price: float,
    expiry_date: str | None = None,
    call_put: str | None = None,
    strike_price: float | None = None,
) -> dict[str, Any]:
    """Place a limit GTC exit order (equity or option)."""
    client = _get_order_client(session_id)
    client_order_id = secrets.token_hex(10)

    kwargs: dict[str, Any] = {
        "accountIdKey": account_id_key,
        "symbol": symbol,
        "orderAction": order_action,
        "clientOrderId": client_order_id,
        "priceType": "LIMIT",
        "limitPrice": limit_price,
        "quantity": quantity,
        "orderTerm": "GOOD_UNTIL_CANCEL",
        "marketSession": "REGULAR",
        "resp_format": "json",
    }

    if security_type == "OPTN":
        kwargs["expiryDate"] = expiry_date
        kwargs["callPut"] = call_put
        kwargs["strikePrice"] = strike_price
        resp = client.place_option_order(**kwargs)
    else:
        resp = client.place_equity_order(**kwargs)

    return resp


def place_spread_exit_order(
    session_id: str,
    account_id_key: str,
    legs: list[dict[str, Any]],
    limit_price: float,
    price_type: str,
) -> dict[str, Any]:
    """Place a multi-leg spread exit order (NET_DEBIT or NET_CREDIT)."""
    client = _get_order_client(session_id)
    client_order_id = secrets.token_hex(10)

    instruments = []
    for leg in legs:
        expiry = dateutil.parser.parse(leg["expiryDate"])
        product = {
            "securityType": "OPTN",
            "symbol": leg["symbol"],
            "callPut": leg["callPut"],
            "expiryDay": expiry.day,
            "expiryMonth": expiry.month,
            "expiryYear": expiry.year,
            "strikePrice": leg["strikePrice"],
        }
        instruments.append({
            "Product": product,
            "orderAction": leg["orderAction"],
            "quantityType": "QUANTITY",
            "quantity": leg["quantity"],
        })

    order = {
        "allOrNone": False,
        "priceType": price_type,
        "limitPrice": limit_price,
        "orderTerm": "GOOD_UNTIL_CANCEL",
        "marketSession": "REGULAR",
        "Instrument": instruments,
    }

    # Preview first
    preview_payload = {
        "PreviewOrderRequest": {
            "orderType": "SPREADS",
            "clientOrderId": client_order_id,
            "Order": order,
        }
    }
    api_url = f"{client.base_url}/{account_id_key}/orders/preview"
    preview = client.perform_request(client.session.post, api_url, preview_payload, "xml")

    preview_id = preview["PreviewOrderResponse"]["PreviewIds"]["previewId"]

    # Place with previewId
    place_payload = {
        "PlaceOrderRequest": {
            "orderType": "SPREADS",
            "clientOrderId": client_order_id,
            "Order": order,
            "PreviewIds": {"previewId": preview_id},
        }
    }
    api_url = f"{client.base_url}/{account_id_key}/orders/place"
    return client.perform_request(client.session.post, api_url, place_payload, "xml")


def cancel_order(session_id: str, account_id_key: str, order_id: int) -> dict[str, Any]:
    """Cancel an existing order."""
    client = _get_order_client(session_id)
    try:
        resp = client.cancel_order(account_id_key, order_id, resp_format="json")
    except RequestsJSONDecodeError:
        # E*Trade returns an empty body on successful cancel
        return {"status": "cancelled", "orderId": order_id}
    return resp
