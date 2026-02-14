"""E*Trade API endpoints."""

import logging

from flask import Blueprint, jsonify, request
from requests.exceptions import HTTPError

logger = logging.getLogger(__name__)

from app import etrade

etrade_bp = Blueprint("etrade", __name__)


@etrade_bp.route("/auth/status", methods=["GET"])
def auth_status():
    """Check for cached auth and restore session if available."""
    session_id = etrade.restore_session()
    if session_id:
        return jsonify({"authenticated": True, "sessionId": session_id})
    return jsonify({"authenticated": False})


@etrade_bp.route("/auth/logout", methods=["POST"])
def auth_logout():
    """Clear cached auth tokens."""
    etrade._clear_auth()
    return jsonify({"status": "ok"})


@etrade_bp.route("/auth/request-token", methods=["POST"])
def auth_request_token():
    """Start OAuth flow: returns session ID and authorize URL."""
    try:
        result = etrade.request_token()
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@etrade_bp.route("/auth/access-token", methods=["POST"])
def auth_access_token():
    """Exchange verifier code for access token."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    session_id = data.get("sessionId", "")
    verifier_code = data.get("verifierCode", "")

    if not session_id or not verifier_code:
        return jsonify({"error": "sessionId and verifierCode are required"}), 400

    try:
        etrade.access_token(session_id, verifier_code.strip())
        return jsonify({"status": "ok"})
    except KeyError as e:
        return jsonify({"error": str(e)}), 401


@etrade_bp.route("/accounts", methods=["GET"])
def accounts():
    """List all E*Trade accounts."""
    session_id = request.headers.get("X-Session-Id", "")
    if not session_id:
        return jsonify({"error": "X-Session-Id header required"}), 401

    try:
        account_list = etrade.list_accounts(session_id)
        return jsonify({"accounts": account_list})
    except (KeyError, HTTPError) as e:
        etrade._clear_auth()
        return jsonify({"error": str(e)}), 401


@etrade_bp.route("/accounts/<account_key>/positions", methods=["GET"])
def positions(account_key: str):
    """Get positions for a specific account."""
    session_id = request.headers.get("X-Session-Id", "")
    if not session_id:
        return jsonify({"error": "X-Session-Id header required"}), 401

    try:
        position_list = etrade.get_positions(session_id, account_key)
        return jsonify({"positions": position_list})
    except (KeyError, HTTPError) as e:
        etrade._clear_auth()
        return jsonify({"error": str(e)}), 401


@etrade_bp.route("/accounts/<account_key>/orders", methods=["GET"])
def orders(account_key: str):
    """Get open orders for a specific account."""
    session_id = request.headers.get("X-Session-Id", "")
    if not session_id:
        return jsonify({"error": "X-Session-Id header required"}), 401

    try:
        order_list = etrade.get_open_orders(session_id, account_key)
        return jsonify({"orders": order_list})
    except (KeyError, HTTPError) as e:
        etrade._clear_auth()
        return jsonify({"error": str(e)}), 401


@etrade_bp.route("/accounts/<account_key>/orders", methods=["POST"])
def place_order(account_key: str):
    """Place a limit GTC exit order."""
    session_id = request.headers.get("X-Session-Id", "")
    if not session_id:
        return jsonify({"error": "X-Session-Id header required"}), 401

    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    try:
        if "legs" in data:
            result = etrade.place_spread_exit_order(
                session_id,
                account_key,
                legs=data["legs"],
                limit_price=data["limitPrice"],
                price_type=data["priceType"],
            )
        else:
            result = etrade.place_exit_order(
                session_id,
                account_key,
                symbol=data["symbol"],
                security_type=data["securityType"],
                order_action=data["orderAction"],
                quantity=data["quantity"],
                limit_price=data["limitPrice"],
                expiry_date=data.get("expiryDate"),
                call_put=data.get("callPut"),
                strike_price=data.get("strikePrice"),
            )
        return jsonify(result)
    except (KeyError, HTTPError, Exception) as e:
        logger.exception("Failed to place order")
        return jsonify({"error": str(e)}), 400


@etrade_bp.route("/accounts/<account_key>/orders/<int:order_id>", methods=["DELETE"])
def cancel_order(account_key: str, order_id: int):
    """Cancel an existing order."""
    session_id = request.headers.get("X-Session-Id", "")
    if not session_id:
        return jsonify({"error": "X-Session-Id header required"}), 401

    try:
        result = etrade.cancel_order(session_id, account_key, order_id)
        return jsonify(result)
    except (KeyError, HTTPError) as e:
        return jsonify({"error": str(e)}), 400


@etrade_bp.route("/accounts/<account_key>/balance", methods=["GET"])
def balance(account_key: str):
    """Get balance for a specific account."""
    session_id = request.headers.get("X-Session-Id", "")
    if not session_id:
        return jsonify({"error": "X-Session-Id header required"}), 401

    try:
        balance_data = etrade.get_account_balance(session_id, account_key)
        return jsonify({"balance": balance_data})
    except (KeyError, HTTPError) as e:
        etrade._clear_auth()
        return jsonify({"error": str(e)}), 401
