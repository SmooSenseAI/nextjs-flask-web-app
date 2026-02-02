"""API endpoints."""

from flask import Blueprint, jsonify, request

api_bp = Blueprint("api", __name__)


@api_bp.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


@api_bp.route("/echo", methods=["POST"])
def echo():
    """Echo back the request body."""
    data = request.get_json()
    return jsonify({"echo": data})
