from pathlib import Path
import re

root = Path(r'e:\ROBIN\lost_and_found')
files = list(root.glob('app/**/*.tsx'))
pattern = re.compile(r'(<(?:button|a)([^>]*?)className=")([^"]*)(")', re.DOTALL)

for path in files:
    text = path.read_text(encoding='utf-8')
    def repl(m):
        prefix, attrs, classes, suffix = m.group(1), m.group(2), m.group(3), m.group(4)
        cls_list = classes.split()
        if 'cursor-pointer' not in cls_list:
            cls_list.append('cursor-pointer')
        return prefix + ' '.join(cls_list) + suffix
    new_text = pattern.sub(repl, text)
    if new_text != text:
        path.write_text(new_text, encoding='utf-8')
        print(f'Updated {path}')
