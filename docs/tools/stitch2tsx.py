#!/usr/bin/env python3
"""
stitch2tsx.py — Convert stitch_screens/**/code.html into native React (TSX)
page modules for the PFaaS prop-admin dashboard.

Pipeline:
  1. classification (tools/stitch_classify.json) maps every stitch folder to a
     spec view-id, splitting prop-admin / super-admin (skipped) / hand-converted.
  2. For each prop-admin view-id: extract <main> content from the primary base
     screen, extract overlay roots (sheets / dialogs / drawers) from each
     attached state screen, match triggers in the base markup, and emit a
     self-contained "use client" page module.
  3. Emit src/modules/stitch/index.ts exporting `stitchViews` for the router.

Run:  python3 tools/stitch2tsx.py
      python3 tools/stitch2tsx.py --check <path>...   # exit 1 if secret-like strings found
      python3 tools/stitch2tsx.py --scrub <path>...   # replace them with EXAMPLE_KEY_NOT_REAL
"""

import json
import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREENS = os.path.join(ROOT, "stitch_screens")
OUT_DIR = os.path.join(ROOT, "src", "modules", "stitch", "pages")

# ── secret scrubbing (docs/secret-scan.md) ──────────────────────────────────
# The pattern deliberately uses [_] character classes so this file itself
# never matches a raw secret scan (git grep -E '(sk|pk|rk)[_]live[_]|whsec[_]').
SECRET_PATTERN = re.compile(
    r"(?:sk|pk|rk)[_]live[_][A-Za-z0-9_.•*-]*|whsec[_][A-Za-z0-9_.•*-]*"
)
SECRET_REPLACEMENT = "EXAMPLE_KEY_NOT_REAL"
SKIP_DIRS = {".git", "node_modules", ".vscode", ".next", ".turbo", "dist", "coverage"}


def scrub_text(text):
    """Replace every secret-like string. Returns (new_text, count)."""
    return SECRET_PATTERN.subn(SECRET_REPLACEMENT, text)


def _iter_files(paths):
    for p in paths:
        if os.path.isfile(p):
            yield p
        elif os.path.isdir(p):
            for base, dirs, files in os.walk(p):
                dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
                for f in files:
                    yield os.path.join(base, f)


def scan_paths(paths, scrub=False):
    """Find secret-like strings under paths. Returns [(path, count), ...].

    Never prints the matched text itself — only path and occurrence count.
    """
    hits = []
    for path in _iter_files(paths):
        try:
            with open(path, encoding="utf8", errors="surrogateescape") as fh:
                src = fh.read()
        except OSError:
            continue
        n = len(SECRET_PATTERN.findall(src))
        if not n:
            continue
        if scrub:
            out, n = scrub_text(src)
            with open(path, "w", encoding="utf8", errors="surrogateescape") as fh:
                fh.write(out)
        hits.append((path, n))
    return hits


def _cli(argv):
    """--check: report and exit 1 on hits.  --scrub: replace, exit 0."""
    mode, paths = argv[0], argv[1:]
    if not paths:
        print(f"usage: stitch2tsx.py {mode} <path>...", file=sys.stderr)
        return 2
    hits = scan_paths(paths, scrub=(mode == "--scrub"))
    verb = "scrubbed" if mode == "--scrub" else "found"
    for path, n in hits:
        print(f"{path}: {n} secret-like match(es) {verb}")
    total = sum(n for _, n in hits)
    print(f"{mode}: {total} match(es) in {len(hits)} file(s)")
    if mode == "--check":
        return 1 if hits else 0
    return 0

# ═══════════════════════════════════════════════════════════════════════════
# Tree model
# ═══════════════════════════════════════════════════════════════════════════


class Node:
    __slots__ = ("tag", "attrs", "children", "parent")

    def __init__(self, tag, attrs=None, parent=None):
        self.tag = tag
        self.attrs = attrs or []  # list of (name, value|None)
        self.children = []  # Node | str
        self.parent = parent

    def get(self, name):
        for k, v in self.attrs:
            if k == name:
                return v
        return None

    def set(self, name, value):
        for i, (k, _) in enumerate(self.attrs):
            if k == name:
                self.attrs[i] = (k, value)
                return
        self.attrs.append((name, value))

    def text(self):
        out = []
        for c in self.children:
            out.append(c.text() if isinstance(c, Node) else c)
        return "".join(out)


VOID = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}
SKIP_CONTENT = {"script", "style", "template", "noscript"}


class TreeParser(HTMLParser):
    """Builds a forgiving Node tree; ignores comments and script/style content."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#root")
        self.stack = [self.root]
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if self.skip:
            if tag in SKIP_CONTENT:
                self.skip += 1
            return
        if tag in SKIP_CONTENT:
            self.skip = 1
            return
        node = Node(tag, [(k, v) for k, v in attrs], parent=self.stack[-1])
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        if self.skip or tag in SKIP_CONTENT:
            return
        node = Node(tag, [(k, v) for k, v in attrs], parent=self.stack[-1])
        self.stack[-1].children.append(node)

    def handle_endtag(self, tag):
        if self.skip:
            if tag in SKIP_CONTENT:
                self.skip = max(0, self.skip - 1)
            return
        if tag in VOID:
            return
        # pop until match (tolerant of implied closes)
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return
        # unmatched close tag — ignore

    def handle_data(self, data):
        if self.skip or not data:
            return
        self.stack[-1].children.append(data)

    def handle_comment(self, data):
        pass


def parse_html(fragment):
    p = TreeParser()
    p.feed(fragment)
    p.close()
    return p.root


# ═══════════════════════════════════════════════════════════════════════════
# Attributes
# ═══════════════════════════════════════════════════════════════════════════

ATTR_RENAMES = {
    "class": "className",
    "for": "htmlFor",
    "readonly": "readOnly",
    "tabindex": "tabIndex",
    "maxlength": "maxLength",
    "minlength": "minLength",
    "autocomplete": "autoComplete",
    "autofocus": "autoFocus",
    "novalidate": "noValidate",
    "contenteditable": "contentEditable",
    "spellcheck": "spellCheck",
    "crossorigin": "crossOrigin",
    "srcset": "srcSet",
    "enctype": "encType",
    "datetime": "dateTime",
    "accesskey": "accessKey",
    "fetchpriority": "fetchPriority",
    "playsinline": "playsInline",
    "cellpadding": "cellPadding",
    "cellspacing": "cellSpacing",
    "usemap": "useMap",
    "frameborder": "frameBorder",
    "ismap": "isMap",
    "colspan": "colSpan",
    "rowspan": "rowSpan",
    "viewbox": "viewBox",
    "preserveaspectratio": "preserveAspectRatio",
    "gradientunits": "gradientUnits",
    "gradienttransform": "gradientTransform",
    "spreadmethod": "spreadMethod",
    "patternunits": "patternUnits",
    "filterunits": "filterUnits",
    "basefrequency": "baseFrequency",
    "stddeviation": "stdDeviation",
    "calcmode": "calcMode",
    "keypoints": "keyPoints",
    "keytimes": "keyTimes",
    "keysplines": "keySplines",
    "repeatcount": "repeatCount",
    "repeatdur": "repeatDur",
    "attributename": "attributeName",
    "attributetype": "attributeType",
    "patterntransform": "patternTransform",
    "textlength": "textLength",
    "lengthadjust": "lengthAdjust",
    "pathlength": "pathLength",
    "markerheight": "markerHeight",
    "markerwidth": "markerWidth",
    "markerunits": "markerUnits",
    "refx": "refX",
    "refy": "refY",
    "primitiveunits": "primitiveUnits",
    "clippathunits": "clipPathUnits",
    "maskunits": "maskUnits",
    "maskcontentunits": "maskContentUnits",
    "xchannelselector": "xChannelSelector",
    "ychannelselector": "yChannelSelector",
    "specularexponent": "specularExponent",
    "specularconstant": "specularConstant",
    "limitingconeangle": "limitingConeAngle",
    "tablevalues": "tableValues",
    "clip-path": "clipPath",
    "xmlns:xlink": "xmlnsXlink",
}

# boolean-ish attributes → emit bare JSX boolean (true)
BOOL_ATTRS = {
    "disabled", "required", "hidden", "multiple", "open", "checked",
    "selected", "autofocus", "defer", "async", "controls", "autoplay",
    "novalidate", "ismap", "itemscope", "reversed", "default", "readonly",
}
# attrs that become defaultValue-style props
DEFAULT_VALUE_ATTRS = {"value"}
DEFAULT_CHECKED_ATTRS = {"checked", "selected"}

STYLE_NUM = re.compile(r"^(-?\d+(\.\d+)?)(px|rem|em|%|vh|vw|s|ms|deg|fr)?$")
STYLE_PROP = re.compile(r"^-?[a-zA-Z][a-zA-Z0-9-]*$")


def camel(name):
    parts = name.split("-")
    return parts[0] + "".join(p[:1].upper() + p[1:] for p in parts[1:])


def jsx_attr_name(raw, tag):
    """Map an HTML/SVG attribute name to its JSX equivalent (None → drop)."""
    n = raw.lower()
    if n.startswith("on") and n not in {"onload"}:
        # inline event handlers — drop (React would reject them anyway)
        if n in ("onclick", "oninput", "onchange", "onsubmit", "onmouseover",
                 "onmouseout", "onmouseenter", "onmouseleave", "onfocus",
                 "onblur", "onkeydown", "onkeyup", "onkeypress", "ondblclick",
                 "onscroll", "ondrag", "ondrop", "onresize", "ontoggle",
                 "onwheel", "onanimationend", "ontransitionend", "oninvalid"):
            return None
    if n in ATTR_RENAMES:
        return ATTR_RENAMES[n]
    if n.startswith("aria-") or n.startswith("data-") or n.startswith("xmlns"):
        return n
    if "-" in n:
        return camel(n)
    if n in ("viewbox", "preserveaspectratio", "gradientunits", "gradienttransform",
             "spreadmethod", "patternunits", "filterunits", "basefrequency"):
        return ATTR_RENAMES[n]
    return n


def escape_attr(v):
    if v is None:
        return "true"  # bare boolean attr — emitted separately anyway
    v = v.replace("\r\n", " ").replace("\n", " ").replace("\r", " ")
    v = v.replace('"', "&quot;")
    return v


def parse_style(css):
    """'a: b; c: d' → {'a': 'b', ...} with camelCased keys."""
    out = {}
    for decl in css.split(";"):
        if ":" not in decl:
            continue
        k, _, v = decl.partition(":")
        k, v = k.strip(), v.strip().replace("!important", "").strip()
        if not k or not v:
            continue
        if not STYLE_PROP.match(k):
            continue
        key = camel(k) if "-" in k else k
        if k == "font-variation-settings":
            v = v.replace("'", '"')
            out[key] = v
        elif STYLE_NUM.match(v):
            out[key] = v
        else:
            out[key] = v
    return out


# ═══════════════════════════════════════════════════════════════════════════
# Class remapping — stitch `secondary` (#6b6358) collides with the shadcn
# `secondary` token (cream). The app's `tsc` token is the exact stitch value.
# ═══════════════════════════════════════════════════════════════════════════

COLOR_PREFIXES = (
    "bg", "text", "border", "fill", "stroke", "ring", "from", "to", "via",
    "divide", "placeholder", "decoration", "outline", "shadow", "accent",
    "caret",
)
_SECONDARY_RE = re.compile(
    r"(?<![\w-])(" + "|".join(COLOR_PREFIXES) + r")-secondary(?![\w-])"
)


def remap_classes(cls):
    if not cls:
        return cls
    cls = _SECONDARY_RE.sub(r"\1-tsc", cls)
    return cls


def esc_text(t):
    """Escape JSX text so braces/angle brackets survive parsing + lint.
    Text containing // or /* is emitted as a JS string expression so
    react/jsx-no-comment-textnodes stays happy."""
    if "//" in t or "/*" in t:
        s = t.replace("\\", "\\\\").replace('"', '\\"').replace("\r", " ").replace("\n", " ")
        return '{"' + s + '"}'
    t = t.replace("&", "&amp;")
    t = t.replace("<", "&lt;")
    t = t.replace(">", "&gt;")
    t = t.replace("{", "&#123;").replace("}", "&#125;")
    return t


# ═══════════════════════════════════════════════════════════════════════════
# JSX serializer
# ═══════════════════════════════════════════════════════════════════════════

CLOSE_SYN = {
    "cancel", "close", "not now", "dismiss", "go back", "never mind",
    "no thanks", "abort", "discard", "back", "keep editing", "maybe later",
    "skip", "skip for now", "not right now", "undo", "return",
}
CONFIRM_SYN = {
    "confirm", "ok", "okay", "done", "save", "submit", "apply", "send",
    "create", "add", "approve", "reject", "delete", "remove", "block",
    "reset", "rotate", "revoke", "suspend", "merge", "unlink", "schedule",
    "export", "proceed", "archive", "publish", "verify", "re-initiate",
    "retry", "link", "update", "edit", "finish", "continue", "resolve",
    "escalate", "reactivate", "unblock", "activate", "disable", "enable",
    "mark verified", "mark all approved", "reopen", "revert", "delete permanently",
    "begin session", "log out", "purge", "execute", "run", "start", "pay",
    "place order", "download", "copy", "rotate password", "save changes",
}

def norm_text(s):
    return re.sub(r"\s+", " ", s or "").strip()


def is_sig(tok):
    return len(tok) >= 4 and tok not in {
        "with", "that", "this", "from", "have", "will", "your", "for",
        "are", "was", "the", "and", "button", "click", "label",
    }


def tokens_of(s):
    return set(t for t in re.findall(r"[a-z0-9]+", (s or "").lower()) if is_sig(t))


def stem(t):
    for suf in ("ing", "ed", "es", "s"):
        if len(t) > 5 and t.endswith(suf):
            return t[: -len(suf)]
    return t


class Serializer:
    def __init__(self, nav_map=None, cur_vid=None):
        self.nav_map = nav_map or {}
        self.cur_vid = cur_vid
        self.used_msicon = False
        self.used_nav = False

    # ── public ──────────────────────────────────────────────────────────
    def render_children(self, parent, indent):
        parts = self._split(parent)
        if not parts:
            return ""
        inline = self._inline_mode(parts)
        return self._emit(parts, indent, inline)

    def _split(self, parent):
        parts = []
        for c in parent.children:
            if isinstance(c, Node):
                parts.append(("e", c))
            else:
                if c:
                    parts.append(("t", c))
        return parts

    def _inline_mode(self, parts):
        # Source whitespace decides: any text gap without a newline must stay
        # on one line to preserve exact rendering; all-newline gaps → multiline.
        for kind, val in parts:
            if kind == "t" and "\n" not in val:
                return True
        return False

    def _emit(self, parts, indent, inline):
        pad = "  " * indent
        if inline:
            buf = []
            for kind, val in parts:
                if kind == "t":
                    buf.append(esc_text(val))
                else:
                    buf.append(self.render_node(val, indent, inline=True))
            return "".join(buf)
        out = []
        for kind, val in parts:
            if kind == "t":
                txt = esc_text(val)
                if txt.strip():
                    out.append(pad + txt.strip() if "\n" in val else pad + txt)
                # whitespace-only newline gaps are dropped by JSX (matches source)
            else:
                out.append(self.render_node(val, indent, inline=False))
        return "\n".join(out)

    def render_node(self, node, indent, inline=False):
        pad = "  " * indent
        tag = SVG_TAGS.get(node.tag, node.tag)

        # Material Symbols icon → MsIcon
        cls = node.get("class") or ""
        if tag == "span" and "material-symbols" in cls:
            self.used_msicon = True
            glyph = norm_text(node.text())
            rest = [c for c in cls.split() if "material-symbols" not in c]
            fill = "FILL\' 1" in cls or "font-variation-settings" in (node.get("style") or "")
            # some screens put FILL in style attr
            style_v = node.get("style") or ""
            if "FILL" in style_v and "1" in style_v:
                fill = True
            a = [f'name="{glyph}"']
            if rest:
                a.append(f'className="{remap_classes(" ".join(rest))}"')
            if fill:
                a.append("fill")
            return f'<MsIcon {" ".join(a)} />'

        select_dv = None
        if node.tag == "select":
            for opt in node.children:
                if isinstance(opt, Node) and opt.tag == "option" and opt.get("selected") is not None:
                    select_dv = opt.get("value") if opt.get("value") is not None else norm_text(opt.text())
                    opt.attrs = [(k, v) for k, v in opt.attrs if k != "selected"]

        attrs_jsx = self._attrs(node)
        if select_dv is not None:
            attrs_jsx += f' defaultValue="{escape_attr(select_dv)}"'
        children = [c for c in node.children if not (isinstance(c, str) and not c)]

        # <form> → <div> so stray submit buttons never reload the SPA
        out_tag = "div" if tag == "form" else tag

        # accessible images — stitch markup ships decorative imgs without alt
        if node.tag == "img" and node.get("alt") is None:
            attrs_jsx += ' alt=""'

        if tag in VOID or not children:
            if tag in VOID:
                return f"<{out_tag}{attrs_jsx} />"
            if inline:
                return f"<{out_tag}{attrs_jsx}></{out_tag}>"
            return f"{pad}<{out_tag}{attrs_jsx}></{out_tag}>"

        # textarea content → defaultValue
        if tag == "textarea":
            val = norm_text(node.text()).replace('"', "&quot;")
            a = attrs_jsx
            if val:
                a += f' defaultValue="{val}"'
            return f"<{out_tag}{a} />"

        body = self.render_children(node, indent + 1)
        if inline:
            return f"<{out_tag}{attrs_jsx}>{body}</{out_tag}>"
        if "\n" in body:
            return f"{pad}<{out_tag}{attrs_jsx}>\n{body}\n{pad}</{out_tag}>"
        return f"{pad}<{out_tag}{attrs_jsx}>{body}</{out_tag}>"

    def _attrs(self, node):
        out = []
        for raw, val in node.attrs:
            name = raw
            if raw == "data-stitch-open":
                out.append(f"onClick={{() => setSo{val}(true)}}")
                continue
            if raw == "data-stitch-close":
                out.append(f"onClick={{() => setSo{val}(false)}}")
                continue
            if raw == "data-stitch-noop":
                out.append('href="#"')
                out.append("onClick={(e) => e.preventDefault()}")
                continue
            if raw == "data-stitch-nav":
                self.used_nav = True
                out.append('href="#"')
                out.append(f"onClick={{(e) => {{ e.preventDefault(); navigate(\"{val}\"); }}}}")
                continue
            if raw == "class":
                out.append(f'className="{remap_classes(val or "")}"')
                continue
            if raw.startswith("on"):
                continue  # any remaining inline handler
            key = jsx_attr_name(raw, node.tag)
            if key is None:
                continue
            if raw in DEFAULT_CHECKED_ATTRS:
                out.append("defaultChecked" if raw == "checked" else "defaultSelected")
                continue
            if raw == "value" and node.tag in ("input", "textarea"):
                out.append(f'defaultValue="{escape_attr(val)}"')
                continue
            if raw == "style":
                st = parse_style(val or "")
                if st:
                    def _q(v):
                        return v.replace("\\", "\\\\").replace("'", "\\'")
                    body = ", ".join(f"{k}: '{_q(v)}'" for k, v in st.items())
                    out.append(f"style={{{{ {body} }}}}")
                continue
            if raw in BOOL_ATTRS or val in (None, "") and raw not in ("placeholder", "title", "aria-label"):
                # bare boolean attribute
                if val in (None, "") and raw in BOOL_ATTRS:
                    out.append(key)
                    continue
                if val in (None, ""):
                    out.append(f'{key}=""')
                    continue
            # plain string attr
            if key in ("rows", "cols", "width", "height", "tabIndex", "maxLength",
                       "minLength", "colSpan", "rowSpan", "strokeWidth", "offset",
                       "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "x2", "y1", "y2",
                       "opacity", "order", "start", "step", "min", "max", "pattern",
                       "fontSize", "fontWeight", "letterSpacing", "stopOpacity"):
                # numeric-looking → bare number when it parses as one
                if val is not None and re.fullmatch(r"-?\d+(\.\d+)?", val.strip()):
                    out.append(f"{key}={{{val.strip()}}}")
                    continue
            if val is None:
                out.append(key)
            else:
                out.append(f'{key}="{escape_attr(val)}"')
        # dedupe emitted attributes (e.g. duplicate href from nav wiring)
        deduped = []
        seen = set()
        for a in out:
            m = re.match(r"([A-Za-z][A-Za-z0-9_]*)=", a)
            name = m.group(1) if m else a.split(" ")[0]
            if name in seen:
                continue
            seen.add(name)
            deduped.append(a)
        out = deduped
        return (" " + " ".join(out)) if out else ""


# ═══════════════════════════════════════════════════════════════════════════
# Extraction helpers
# ═══════════════════════════════════════════════════════════════════════════


def extract_main(html):
    i = html.find("<main")
    if i == -1:
        return ""
    j = html.find(">", i) + 1
    k = html.find("</main>")
    return html[j:k] if k != -1 else html[j:]


def extract_overlay_region(html):
    """Content after </footer> (fallback </main>) up to </body> — where the
    stitched state screens append their overlay roots."""
    f = html.find("</footer>")
    m = html.find("</main>")
    start = -1
    if f != -1 and m != -1:
        start = max(f, m)
    elif f != -1:
        start = f
    elif m != -1:
        start = m
    if start == -1:
        return ""
    end = html.find("</body>")
    region = html[start + (7 if f != -1 and html[start:start + 7] == "</footer>" else 0):end]
    # simpler: cut right after the closing tag we anchored on
    anchor = "</footer>" if f != -1 else "</main>"
    a = html.find(anchor)
    b = end
    region = html[a + len(anchor):b] if a != -1 and b != -1 else ""
    region = re.sub(r"<script\b.*?</script>", "", region, flags=re.S | re.I)
    return region.strip()


def overlay_roots(fragment):
    """Top-level nodes inside the overlay region that are fixed-position roots."""
    if not fragment.strip():
        return []
    root = parse_html(fragment)
    roots = []
    for c in root.children:
        if not isinstance(c, Node):
            continue
        cls = c.get("class") or ""
        if "fixed" in cls.split() or c.get("style") and "fixed" in (c.get("style") or ""):
            roots.append(c)
    if not roots:
        # sometimes a single wrapper (non-fixed) holds the fixed dialog
        nodes = [c for c in root.children if isinstance(c, Node)]
        if len(nodes) == 1:
            roots = [nodes[0]]
    return roots


def first_heading(nodes):
    for n in nodes:
        for t in ("h1", "h2", "h3", "h4", "p", "span", "div"):
            for el in walk(n):
                if el.tag == t:
                    txt = norm_text(el.text())
                    if txt and len(txt) < 90:
                        return txt
    return ""


def walk(n):
    for c in n.children:
        if isinstance(c, Node):
            yield c
            yield from walk(c)


def state_desc(base_folder, state_folder):
    """'breaches' + 'breaches_bulk_resolve_confirmation_alertdialog_state'
    → 'bulk resolve confirmation alertdialog'"""
    d = state_folder
    if d.startswith(base_folder + "_"):
        d = d[len(base_folder) + 1:]
    d = re.sub(r"_state(_\d+)?$", "", d)
    d = d.replace("_", " ")
    return d.strip()


# ═══════════════════════════════════════════════════════════════════════════
# Trigger matching — find the base-screen control that opens an overlay
# ═══════════════════════════════════════════════════════════════════════════

CLICKABLE = {"button", "a", "summary"}


def candidates(root):
    out = []
    for n in walk(root):
        cls = n.get("class") or ""
        has_on = any(k.startswith("on") for k, _ in n.attrs)
        clickable = (
            n.tag in CLICKABLE
            or has_on
            or "cursor-pointer" in cls
            or "group" in cls.split()
        )
        if not clickable:
            continue
        txt = norm_text(n.text())
        if not txt or len(txt) > 160:
            continue
        bonus = 2 if (n.tag in CLICKABLE or has_on) else 0
        out.append((n, txt, bonus))
    return out


def find_trigger(base_root, desc, title):
    """Score base controls against the state description + overlay title.
    Returns (node, score, matched_text) or (None, best_score, best_text)."""
    want = tokens_of(desc) | tokens_of(title)
    if not want:
        return None, 0, ""
    best = (None, 0, "")
    for node, txt, bonus in candidates(base_root):
        have = set(t for t in re.findall(r"[a-z0-9]+", txt.lower()) if is_sig(t))
        have |= set(stem(t) for t in have)
        score = 0
        for w in want:
            if w in have or stem(w) in have:
                score += 3
            elif any(len(stem(w)) > 4 and stem(w).startswith(stem(h)[:6]) for h in have):                score += 1
            if score == 0:
                continue
            score += bonus
        # prefer tighter (shorter) labels when scores tie
        score -= min(2, len(have) // 6)
        if score > best[1]:
            best = (node, score, txt)
    if best[0] is not None and best[1] >= 3:
        return best
    return (None, best[1], best[2])


def wire_overlay_close(roots, idx):
    """Mark Cancel/Confirm buttons inside an overlay so it closes on click."""
    n_marked = 0
    for r in roots:
        for n in walk(r):
            if n.tag not in CLICKABLE:
                # icon-only X close buttons live inside <button>s — skip non-buttons
                continue
            txt = norm_text(n.text()).lower()
            cls = n.get("class") or ""
            has_on = any(k.startswith("on") for k, _ in n.attrs)
            if not (txt or has_on or "cursor-pointer" in cls):
                continue
            plain = re.sub(r"[^a-z0-9 -]", "", txt).strip().lower()
            words = set(plain.split())
            aria = (n.get("aria-label") or "").lower()
            if (words & CLOSE_WORDS or words & CONFIRM_WORDS
                    or "close" in aria or "dismiss" in aria or "cancel" in aria):
                n.set("data-stitch-close", str(idx))
                n_marked += 1
            elif plain and all(p in CLOSE_WORDS | CONFIRM_WORDS for p in words):
                n.set("data-stitch-close", str(idx))
                n_marked += 1
    return n_marked


CLOSE_WORDS = {w for p in CLOSE_SYN for w in p.split()}
CONFIRM_WORDS = {w for p in CONFIRM_SYN for w in p.split()}


# ═══════════════════════════════════════════════════════════════════════════
# Navigation wiring — <a data-path="…"> inside content → navigate(viewId)
# ═══════════════════════════════════════════════════════════════════════════

PATH_ALIASES = {
    "challenge-configuration": "challenge-config",
    "configuration": "challenge-config",
    "trading-overview": "trading",
    "overview": "overview",
    "traders": "trading-traders",
    "accounts": "trading-accounts",
    "open-positions": "trading-positions",
    "bulk-operations": "bulk-account-operations",
    "challenge-types": "challenge-types",
    "phase-management": "phase-management",
    "phase-migration-tool": "phase-migration-tool",
}


def norm_key(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def build_nav_map(all_vids):
    m = {}
    for v in all_vids:
        m[norm_key(v)] = v
        m[v] = v
    for k, v in PATH_ALIASES.items():
        m[norm_key(k)] = v
    return m


def wire_nav(root, nav_map, cur_vid):
    n = 0
    for node in walk(root):
        if node.tag != "a":
            continue
        path = node.get("data-path")
        href = node.get("href")
        if path:
            key = norm_key(path)
            vid = nav_map.get(key) or nav_map.get(path)
            if vid and vid != cur_vid:
                node.set("data-stitch-nav", vid)
                node.attrs = [(k, v) for k, v in node.attrs if k != "data-path"]
                n += 1
                continue
            node.attrs = [(k, v) for k, v in node.attrs if k != "data-path"]
        if href in ("#", "", None):
            node.set("data-stitch-noop", "1")
    return n


# ═══════════════════════════════════════════════════════════════════════════
# Page generation
# ═══════════════════════════════════════════════════════════════════════════


SVG_TAGS = {
    "lineargradient": "linearGradient",
    "radialgradient": "radialGradient",
    "clippath": "clipPath",
    "textpath": "textPath",
    "fedropshadow": "feDropShadow",
    "fegaussianblur": "feGaussianBlur",
    "fecolormatrix": "feColorMatrix",
    "fecomponenttransfer": "feComponentTransfer",
    "fecomposite": "feComposite",
    "feconvolvematrix": "feConvolveMatrix",
    "fedisplacementmap": "feDisplacementMap",
    "fedistantlight": "feDistantLight",
    "feflood": "feFlood",
    "fefunca": "feFuncA",
    "fefuncb": "feFuncB",
    "fefuncg": "feFuncG",
    "fefuncr": "feFuncR",
    "feimage": "feImage",
    "femerge": "feMerge",
    "femergenode": "feMergeNode",
    "femorphology": "feMorphology",
    "feoffset": "feOffset",
    "fepointlight": "fePointLight",
    "fespecularlighting": "feSpecularLighting",
    "fespotlight": "feSpotLight",
    "fetile": "feTile",
    "feturbulence": "feTurbulence",
    "feblend": "feBlend",
}


def pascal(vid):
    name = "".join(p[:1].upper() + p[1:] for p in re.split(r"[^a-zA-Z0-9]+", vid) if p)
    if name and name[0].isdigit():
        name = "Screen" + name
    return name


def read(path):
    with open(path, encoding="utf8", errors="replace") as f:
        return f.read()


def convert_view(vid, spec_entry, primary, base_folder, state_folders, nav_map, report):
    base_html_path = os.path.join(SCREENS, base_folder, "code.html")
    main_html = extract_main(read(base_html_path))
    if not main_html.strip():
        report["errors"].append(f"{vid}: empty <main> in {base_folder}")
        return None

    base_root = parse_html(main_html)

    # ── overlays from state screens ────────────────────────────────────
    overlays = []  # {folder, desc, roots, title, trigger_node, wired}
    for sf in state_folders:
        sp = os.path.join(SCREENS, sf, "code.html")
        if not os.path.exists(sp):
            continue
        sh = read(sp)
        region = extract_overlay_region(sh)
        roots = overlay_roots(region)
        desc = state_desc(base_folder, sf)
        if not roots:
            # maybe the overlay lives inside <main> of the state screen
            smain = extract_main(sh)
            sroot = parse_html(smain)
            found = []
            for n in walk(sroot):
                cls = (n.get("class") or "").split()
                if "fixed" in cls and any(c.startswith("z-50") or c.startswith("z-[") for c in cls):
                    # top-level fixed root only (skip nested panels)
                    p = n.parent
                    nested = False
                    while p is not None:
                        if getattr(p, "tag", None) not in (None, "#root"):
                            pcl = (p.get("class") or "").split()
                            if "fixed" in pcl:
                                nested = True
                                break
                        p = getattr(p, "parent", None)
                    if not nested:
                        found.append(n)
            if found:
                roots = found
        if not roots:
            report["variants"].append(f"{vid} :: {sf}")
            continue
        title = first_heading(roots)
        node, score, matched = find_trigger(base_root, desc, title)
        idx = len(overlays)
        wired = node is not None
        if wired:
            node.set("data-stitch-open", str(idx))
        wire_overlay_close(roots, idx)
        overlays.append({
            "folder": sf, "desc": desc, "title": title, "roots": roots,
            "wired": wired, "score": score, "matched": matched,
        })

    wired_n = sum(1 for o in overlays if o["wired"])
    if overlays and wired_n == 0:
        # no triggers found → do not embed unreachable overlays
        pass

    # ── navigation wiring ──────────────────────────────────────────────
    wire_nav(base_root, nav_map, vid)

    # ── serialize ──────────────────────────────────────────────────────
    ser = Serializer()
    base_body = ser.render_children(base_root, 3)

    overlay_blocks = []
    for i, o in enumerate(overlays):
        if not o["wired"]:
            continue
        oser = Serializer()
        parts = []
        for r in o["roots"]:
            parts.append(oser.render_node(r, 4))
        body = "\n".join(parts)
        overlay_blocks.append((i, body))
        ser.used_msicon = ser.used_msicon or oser.used_msicon
        ser.used_nav = ser.used_nav or oser.used_nav

    hooks = "\n".join(
        f"  const [so{i}, setSo{i}] = React.useState(false);"
        for i, _ in overlay_blocks
    )

    imports = ['import * as React from "react";'] if hooks else []
    if ser.used_msicon:
        imports.append('import { MsIcon } from "@/components/stitch/stitch";')
    if ser.used_nav:
        imports.append('import { usePlatform } from "@/lib/platform/platform-context";')

    nav_line = "  const { navigate } = usePlatform();\n" if ser.used_nav else ""

    conds = []
    for i, body in overlay_blocks:
        conds.append("      {so%d && (\n        <>\n%s\n        </>\n      )}" % (i, body))

    _unused = None  # (kept for clarity)
    title = spec_entry["title"]
    tag = spec_entry["tag"]
    wired_desc = ", ".join(
        f"{o['folder']}{'✓' if o['wired'] else '✗'}" for o in overlays
    ) or "none"
    header = (
        f'/**\n'
        f' * {title} — Stitch conversion (view-id: `{vid}`)\n'
        f' *\n'
        f' * Source: stitch_screens/{primary}\n'
        f' * Spec: [{tag}] · overlay states: {wired_n}/{len(overlays)} wired\n'
        f' * States: {wired_desc}\n'
        f' *\n'
        f' * Generated by tools/stitch2tsx.py — regenerate with the pipeline\n'
        f' * instead of hand-editing generated markup.\n'
        f' */'
    )

    name = pascal(vid) + "StitchPage"
    parts_jsx = [base_body] + conds
    body_jsx = "\n".join(p for p in parts_jsx if p)

    src = (
        '"use client";\n\n'
        + header + "\n\n"
        + "\n".join(imports) + "\n\n"
        + f"export function {name}() {{\n"
        + (hooks + "\n") if hooks else ""
    )
    # (assembled below — keep f-string construction explicit)
    src = '"use client";\n\n' + header + "\n\n" + "\n".join(imports) + "\n\n"
    src += f"export function {name}() {{\n"
    if hooks:
        src += hooks + "\n"
    if nav_line:
        src += nav_line + "\n"
    src += "  return (\n    <>\n"
    # indent body by 4 (render already pads most lines)
    src += body_jsx + "\n"
    src += "    </>\n  );\n}\n"

    os.makedirs(OUT_DIR, exist_ok=True)
    fpath = os.path.join(OUT_DIR, f"{vid}.tsx")
    with open(fpath, "w", encoding="utf8") as f:
        f.write(src)

    report["ok"].append(vid)
    report["wiring"][vid] = {
        "folder": primary,
        "file": f"src/modules/stitch/pages/{vid}.tsx",
        "export": name,
        "overlays": [
            {"state": o["folder"], "wired": o["wired"], "score": o["score"],
             "matched": o["matched"], "title": o["title"][:60]}
            for o in overlays
        ],
        "variants": [o["folder"] for o in []],
    }
    return name


def main():
    work = json.load(open(os.path.join(ROOT, "tools", "stitch_classify.json")))
    screens_meta = work["screens"]
    prop_vids = work["prop"]
    primary = work["primary"]
    vid_states = work["vid_states"]
    all_vids = list(screens_meta)
    nav_map = build_nav_map(all_vids)

    report = {"ok": [], "errors": [], "variants": [], "unwired": [], "wiring": {}}
    exports = []
    for vid in prop_vids:
        pf = primary.get(vid)
        if not pf:
            report["errors"].append(f"{vid}: no primary folder")
            continue
        try:
            name = convert_view(
                vid, screens_meta.get(vid, {"title": vid, "tag": "?"}), pf, pf,
                vid_states.get(vid, []), nav_map, report,
            )
        except Exception as e:  # noqa: BLE001 — record and continue
            import traceback
            report["errors"].append(f"{vid}: {type(e).__name__}: {e}")
            traceback.print_exc()
            continue
        if name:
            exports.append((vid, name))

    # unwired overlays
    for vid, w in report["wiring"].items():
        for o in w["overlays"]:
            if not o["wired"]:
                report["unwired"].append(f"{vid} :: {o['state']} (score {o['score']}, '{o['matched'][:40]}')")

    # index.ts
    idx_path = os.path.join(ROOT, "src", "modules", "stitch", "index.ts")
    lines = [
        '/* eslint-disable @typescript-eslint/no-explicit-any */',
        "/**",
        " * PFaaS — generated Stitch page registry (prop-admin design system).",
        " * Every entry converted from stitch_screens/** by tools/stitch2tsx.py.",
        " */",
        'import type { ComponentType } from "react";',
        "",
    ]
    for vid, name in sorted(exports):
        lines.append(f'import {{ {name} }} from "./pages/{vid}";')
    lines.append("")
    lines.append("export type StitchView = ComponentType<{ params: Record<string, string> }>;")
    lines.append("")
    lines.append("export const stitchViews: Record<string, StitchView> = {")
    for vid, name in sorted(exports):
        lines.append(f'  "{vid}": {name},')
    lines.append("};")
    lines.append("")
    with open(idx_path, "w", encoding="utf8") as f:
        f.write("\n".join(lines))

    with open("/tmp/an/report.json", "w") as f:
        json.dump(report, f, indent=1)

    print(f"converted: {len(report['ok'])}")
    print(f"errors:    {len(report['errors'])}")
    for e in report["errors"]:
        print("   ", e)
    print(f"variant states (not overlay): {len(report['variants'])}")
    print(f"unwired overlays: {len(report['unwired'])}")
    for u in report["unwired"][:40]:
        print("   ", u)
    return 0 if not report["errors"] else 1


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ("--check", "--scrub"):
        sys.exit(_cli(sys.argv[1:]))
    sys.exit(main())
