import codecs
import re
from xml.sax.saxutils import escape

from defusedxml import ElementTree

SUPPORTED_ROOTS = {"score-partwise", "score-timewise"}


class MusicXMLError(ValueError):
    pass


def local_name(tag):
    return tag.rsplit("}", 1)[-1]


def decode_xml(data):
    if data.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
        encoding = "utf-16"
    elif data.startswith(codecs.BOM_UTF8):
        encoding = "utf-8-sig"
    else:
        declaration = re.match(br"\s*<\?xml[^>]*encoding=[\"']([^\"']+)", data[:256], re.I)
        encoding = declaration.group(1).decode("ascii", "replace") if declaration else "utf-8"
    try:
        return data.decode(encoding)
    except (LookupError, UnicodeDecodeError) as exc:
        raise MusicXMLError("XML 문자 인코딩을 읽을 수 없습니다.") from exc


def parse_musicxml(xml_content):
    try:
        root = ElementTree.fromstring(xml_content)
    except (ElementTree.ParseError, ValueError) as exc:
        raise MusicXMLError(f"올바른 XML이 아닙니다: {exc}") from exc
    if local_name(root.tag) not in SUPPORTED_ROOTS:
        raise MusicXMLError("MusicXML(score-partwise 또는 score-timewise) 파일만 사용할 수 있습니다.")
    return root


def metadata(xml_content):
    root = parse_musicxml(xml_content)
    title = composer = ""
    for element in root.iter():
        name = local_name(element.tag)
        if name == "work-title" and element.text and not title:
            title = element.text.strip()
        elif name == "creator" and element.text and not composer:
            creator_type = next((v for k, v in element.attrib.items() if local_name(k) == "type"), "")
            if creator_type == "composer":
                composer = element.text.strip()
    return title, composer


def update_work_title(xml_content, title):
    """Update work-title while preserving the user's formatting where possible."""
    parse_musicxml(xml_content)
    safe_title = escape(title)
    pattern = re.compile(r"(<(?:[\w.-]+:)?work-title\b[^>]*>).*?(</(?:[\w.-]+:)?work-title\s*>)", re.I | re.S)
    if pattern.search(xml_content):
        return pattern.sub(lambda match: f"{match.group(1)}{safe_title}{match.group(2)}", xml_content, count=1)
    work = re.search(r"(<(?:[\w.-]+:)?work\b[^>]*>)", xml_content, re.I)
    if work:
        insertion = f"\n    <work-title>{safe_title}</work-title>"
        return xml_content[:work.end()] + insertion + xml_content[work.end():]
    root_open = re.search(r"<(?:[\w.-]+:)?score-(?:partwise|timewise)\b[^>]*>", xml_content, re.I)
    if not root_open:
        raise MusicXMLError("MusicXML 루트 요소를 찾을 수 없습니다.")
    insertion = f"\n  <work>\n    <work-title>{safe_title}</work-title>\n  </work>"
    return xml_content[:root_open.end()] + insertion + xml_content[root_open.end():]
