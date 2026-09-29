"""Cell-level CSV edits that keep each row's original quoting, so diffs stay reviewable."""
import sys

def split_line(line):
    fields, quoted, cur, q, i = [], [], '', False, 0
    was_quoted = False
    while i < len(line):
        c = line[i]
        if q:
            if c == '"' and i + 1 < len(line) and line[i + 1] == '"': cur += '"'; i += 1
            elif c == '"': q = False
            else: cur += c
        elif c == '"': q = True; was_quoted = True
        elif c == ',': fields.append(cur); quoted.append(was_quoted); cur, was_quoted = '', False
        else: cur += c
        i += 1
    fields.append(cur); quoted.append(was_quoted)
    return fields, quoted

def join_line(fields, quoted):
    out = []
    for f, qd in zip(fields, quoted):
        need = qd or any(ch in f for ch in ',"\n')
        out.append('"' + f.replace('"', '""') + '"' if need else f)
    return ','.join(out)

def edit(path, changes):
    """changes: {row_id: {column: value}}; returns number of cells changed."""
    raw = open(path, newline='').read()
    term = '\r\n' if '\r\n' in raw else '\n'
    lines = raw.split(term)
    header, _ = split_line(lines[0])
    col = {h: i for i, h in enumerate(header)}
    done, n = set(), 0
    for k in range(1, len(lines)):
        if not lines[k] or lines[k].startswith('#'): continue
        f, qd = split_line(lines[k])
        if f[0] not in changes: continue
        for c, v in changes[f[0]].items():
            if f[col[c]] != v: f[col[c]] = v; n += 1
        lines[k] = join_line(f, qd)
        done.add(f[0])
    missing = set(changes) - done
    if missing: sys.exit(f'unknown ids: {sorted(missing)}')
    open(path, 'w', newline='').write(term.join(lines))
    return n
