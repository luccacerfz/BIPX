#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


DEFAULT_CHUNK_SIZE = 1024 * 128
DEFAULT_USER_AGENT = "ZombieGameDownloader/1.0"
INVALID_FILENAME_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Baixa varios arquivos da internet para uma pasta."
    )
    parser.add_argument("urls", nargs="*", help="URLs para baixar.")
    parser.add_argument(
        "-u",
        "--url",
        action="append",
        default=[],
        help="URL para baixar. Pode repetir varias vezes.",
    )
    parser.add_argument(
        "-f",
        "--file",
        type=Path,
        help="Arquivo .txt com uma URL por linha. Linhas vazias e # sao ignoradas.",
    )
    parser.add_argument(
        "-o",
        "--out",
        type=Path,
        default=Path("downloads"),
        help="Pasta de destino. Padrao: downloads",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Sobrescreve arquivos existentes.",
    )
    parser.add_argument(
        "--retries",
        type=int,
        default=2,
        help="Tentativas extras por URL em caso de erro. Padrao: 2",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=30,
        help="Tempo limite por requisicao em segundos. Padrao: 30",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Mostra o que seria baixado sem gravar arquivos.",
    )
    return parser.parse_args()


def read_urls_file(path: Path) -> list[str]:
    urls: list[str] = []
    with path.open("r", encoding="utf-8") as url_file:
        for line_number, raw_line in enumerate(url_file, start=1):
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if not is_http_url(line):
                raise ValueError(f"{path}:{line_number} nao parece uma URL HTTP valida")
            urls.append(line)
    return urls


def is_http_url(value: str) -> bool:
    parsed = urllib.parse.urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def filename_from_content_disposition(header: str | None) -> str | None:
    if not header:
        return None

    encoded_match = re.search(r"filename\*\s*=\s*([^']*)''([^;]+)", header, re.I)
    if encoded_match:
        return urllib.parse.unquote(encoded_match.group(2))

    quoted_match = re.search(r'filename\s*=\s*"([^"]+)"', header, re.I)
    if quoted_match:
        return quoted_match.group(1)

    plain_match = re.search(r"filename\s*=\s*([^;]+)", header, re.I)
    if plain_match:
        return plain_match.group(1).strip()

    return None


def filename_from_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    filename = Path(urllib.parse.unquote(parsed.path)).name
    return filename or "downloaded-file"


def sanitize_filename(filename: str) -> str:
    cleaned = INVALID_FILENAME_CHARS.sub("_", filename).strip(" .")
    return cleaned or "downloaded-file"


def unique_destination(path: Path, overwrite: bool) -> Path:
    if overwrite or not path.exists():
        return path

    stem = path.stem
    suffix = path.suffix
    counter = 1
    while True:
        candidate = path.with_name(f"{stem}_{counter}{suffix}")
        if not candidate.exists():
            return candidate
        counter += 1


def resolve_destination(url: str, output_dir: Path, overwrite: bool, headers=None) -> Path:
    header_filename = None
    if headers is not None:
        header_filename = filename_from_content_disposition(headers.get("Content-Disposition"))

    filename = sanitize_filename(header_filename or filename_from_url(url))
    return unique_destination(output_dir / filename, overwrite)


def download_url(url: str, output_dir: Path, overwrite: bool, timeout: float) -> Path:
    request = urllib.request.Request(url, headers={"User-Agent": DEFAULT_USER_AGENT})

    with urllib.request.urlopen(request, timeout=timeout) as response:
        destination = resolve_destination(url, output_dir, overwrite, response.headers)
        temp_destination = destination.with_name(f"{destination.name}.part")

        with temp_destination.open("wb") as output_file:
            while True:
                chunk = response.read(DEFAULT_CHUNK_SIZE)
                if not chunk:
                    break
                output_file.write(chunk)

        temp_destination.replace(destination)
        return destination


def download_with_retries(
    url: str,
    output_dir: Path,
    overwrite: bool,
    retries: int,
    timeout: float,
) -> Path:
    attempts = max(0, retries) + 1
    last_error: Exception | None = None

    for attempt in range(1, attempts + 1):
        try:
            return download_url(url, output_dir, overwrite, timeout)
        except (OSError, urllib.error.URLError, urllib.error.HTTPError) as error:
            last_error = error
            if attempt < attempts:
                wait_seconds = min(2 ** (attempt - 1), 8)
                print(f"Falhou, tentando de novo em {wait_seconds}s: {url}")
                time.sleep(wait_seconds)

    raise RuntimeError(f"nao foi possivel baixar {url}: {last_error}") from last_error


def collect_urls(args: argparse.Namespace) -> list[str]:
    urls = [*args.urls, *args.url]
    if args.file:
        urls.extend(read_urls_file(args.file))

    invalid_urls = [url for url in urls if not is_http_url(url)]
    if invalid_urls:
        raise ValueError(f"URL invalida: {invalid_urls[0]}")

    return urls


def main() -> int:
    args = parse_args()

    try:
        urls = collect_urls(args)
    except (OSError, ValueError) as error:
        print(f"Erro: {error}", file=sys.stderr)
        return 2

    if not urls:
        print("Informe pelo menos uma URL ou use --file urls.txt.", file=sys.stderr)
        return 2

    if args.dry_run:
        for url in urls:
            destination = resolve_destination(url, args.out, args.overwrite)
            print(f"Baixaria {url} -> {destination}")
        return 0

    args.out.mkdir(parents=True, exist_ok=True)
    failures = 0

    for url in urls:
        print(f"Baixando {url}")
        try:
            destination = download_with_retries(
                url=url,
                output_dir=args.out,
                overwrite=args.overwrite,
                retries=args.retries,
                timeout=args.timeout,
            )
        except RuntimeError as error:
            failures += 1
            print(f"Erro: {error}", file=sys.stderr)
            continue

        print(f"Salvo em {destination}")

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
