import json, os, sys, struct

ASAR = r"D:\Program Files\DSHarness\resources\app.asar"

def load():
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
    return tree, base

def walk(node, prefix, out):
    for name, val in node.get('files', {}).items():
        p = prefix + '/' + name
        if 'files' in val:
            walk(val, p, out)
        else:
            out.append((p, val.get('size', 0), val.get('unpacked', False)))

def main():
    mode = sys.argv[1]
    tree, base = load()
    if mode == 'list':
        out = []
        walk(tree, '', out)
        needle = sys.argv[2] if len(sys.argv) > 2 else ''
        for p, size, unpacked in out:
            if needle in p:
                print(size, p, '(unpacked)' if unpacked else '')
    elif mode == 'extractdir':
        prefix = sys.argv[2].strip('/')
        dest = sys.argv[3]
        out = []
        walk(tree, '', out)
        for p, size, unpacked in out:
            if not p.startswith('/' + prefix + '/'):
                continue
            rel = p[len(prefix) + 2:]
            node = tree
            for part in p.strip('/').split('/'):
                node = node['files'][part]
            off = int(node.get('offset', 0))
            target = os.path.join(dest, rel)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            if unpacked:
                print('skip unpacked', p)
                continue
            with open(ASAR, 'rb') as f:
                f.seek(base + off)
                data = f.read(size)
            with open(target, 'wb') as f:
                f.write(data)
            print('wrote', target, size)
    elif mode == 'get':
        target = sys.argv[2]
        outfile = sys.argv[3]
        node = tree
        for part in target.strip('/').split('/'):
            node = node['files'][part]
        if 'files' in node:
            raise SystemExit('is a directory: ' + target)
        off = int(node.get('offset', 0))
        size = node['size']
        with open(ASAR, 'rb') as f:
            f.seek(base + off)
            data = f.read(size)
        with open(outfile, 'wb') as f:
            f.write(data)
        print('wrote', outfile, size)

main()
