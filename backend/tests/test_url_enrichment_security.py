import socket

from app.services import url_enrichment


def test_ssrf_filter_blocks_non_public_literal_targets():
    for url in (
        "http://127.0.0.1/admin",
        "http://10.0.0.1/",
        "http://169.254.169.254/latest/meta-data/",
        "http://[::1]/",
        "http://localhost/",
        "file:///etc/passwd",
        "http://example.com:6379/",
    ):
        assert not url_enrichment.is_safe_public_url(url)


def test_ssrf_filter_rejects_hostnames_with_any_private_dns_answer(monkeypatch):
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *_args, **_kwargs: [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443)),
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 443)),
        ],
    )
    assert not url_enrichment.is_safe_public_url("https://example.com/")


def test_ssrf_filter_allows_public_http_targets(monkeypatch):
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *_args, **_kwargs: [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443)),
        ],
    )
    assert url_enrichment.is_safe_public_url("https://example.com/path")
