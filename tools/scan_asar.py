import json, sys

ASAR = r"D:\Program Files\DSHarness\resources\app.asar"
NEEDLE = sys.argv[1].encode()
LIMIT = int(sys.argv[2]) if len(sys.argv) > 2 else 10

with open(ASAR, 'rb') as f:
    head = f.read(16)
    f.seek(16)
    raw = f.read(64 * 1024 * 1024)
    text = raw.decode('utf-8', 'ignore')
    dec = json.JSONDecoder()
    tree, end = dec.raw_decode(text)
    base = 16 + end
    if base % 4:
        base += 4 - base % 4

    found = 0
    stack = [('', tree)]
    files = []
    while stack:
        prefix, node = stack.pop()
        for name, val in node.get('files', {}).items():
            p = prefix + '/' + name
            if 'files' in val:
                stack.append((p, val))
            else:
                files.append((p, val))
    files.sort(key=lambda x: x[1].get('size', 0))
    for p, val in files:
        size = val.get('size', 0)
        if val.get('unpacked') or size > 32 * 1024 * 1024:
            continue
        f.seek(base + int(val.get('offset', 0)))
        data = f.read(size)
        if NEEDLE in data:
            i = data.index(NEEDLE)
            print('===', p, size, 'at', i)
            print(data[max(0, i - 300):i + 500].decode('utf-8', 'replace'))
            found += 1
            if found >= LIMIT:
                break
