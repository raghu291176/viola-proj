"""Optical Music Recognition: PDF / image of sheet music → MusicXML.

Real model: **oemer** (MIT — commercial-safe; chosen over homr/Audiveris which are
AGPL). oemer's U-Net + sequence decoder outputs MusicXML directly, so the result
drops straight into Verovio for rendering and into the matching engine as a
reference score (ARCHITECTURE.md §4.3–4.4). Runs on CPU.
"""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path


def image_to_musicxml(image_path: str | Path) -> str:
    """Run oemer on a single sheet-music image and return the MusicXML."""
    with tempfile.TemporaryDirectory() as d:
        out_dir = Path(d)
        # oemer writes <stem>.musicxml into the output dir.
        subprocess.run(
            ["oemer", str(image_path), "-o", str(out_dir)],
            check=True, capture_output=True, text=True,
        )
        results = list(out_dir.glob("*.musicxml")) + list(out_dir.glob("*.xml"))
        if not results:
            raise RuntimeError("oemer produced no MusicXML")
        return results[0].read_text(encoding="utf-8")


def pdf_to_musicxml(pdf_path: str | Path) -> str:
    """Rasterize a PDF and OMR its pages, concatenated into one MusicXML score."""
    from pdf2image import convert_from_path
    from music21 import converter, stream

    pages = convert_from_path(str(pdf_path), dpi=300)
    if not pages:
        raise RuntimeError("empty PDF")

    with tempfile.TemporaryDirectory() as d:
        parts = []
        for i, page in enumerate(pages):
            img = Path(d) / f"page{i}.png"
            page.save(str(img))
            parts.append(image_to_musicxml(img))

    if len(parts) == 1:
        return parts[0]
    # Merge multi-page scores into one stream via music21.
    merged = stream.Score()
    for xml in parts:
        for el in converter.parse(xml, format="musicxml").recurse().getElementsByClass("Part"):
            merged.append(el)
    from music21.musicxml.m21ToXml import GeneralObjectExporter
    return GeneralObjectExporter(merged).parse().decode("utf-8")


def to_musicxml(path: str | Path) -> str:
    p = Path(path)
    return pdf_to_musicxml(p) if p.suffix.lower() == ".pdf" else image_to_musicxml(p)
