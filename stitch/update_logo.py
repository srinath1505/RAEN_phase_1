import os
import re

DIR = '/Users/teenu/Downloads/Raen new website 3/stitch'

def get_relative_prefix(file_path):
    rel_path = os.path.relpath(file_path, DIR)
    depth = rel_path.count(os.sep)
    if depth == 0: return ""
    return "../" * depth

def update_logos():
    html_files = []
    for root, _, files in os.walk(DIR):
        for file in files:
            if file.endswith('.html'):
                html_files.append(os.path.join(root, file))

    pattern_text = re.compile(r'(<[a-zA-Z0-9]+[^>]*?tracking-\[[0-9\.]+em\][^>]*?>)\s*(?:RAEN|R A E N|Raen)\s*(</[a-zA-Z0-9]+>)')
    
    for fp in html_files:
        with open(fp, 'r') as f:
            content = f.read()

        prefix = get_relative_prefix(fp)
        img_src = f"{prefix}public/images/logo.png"
        
        updated = False

        # 1. Update text logos to bigger image
        if pattern_text.search(content):
            replacement = r'\1<img src="' + img_src + r'" alt="RAEN Logo" class="inline-block" style="height: 3em; width: auto;" />\2'
            content = pattern_text.sub(replacement, content)
            updated = True
            
        # 2. Update existing image logos from 1.2em to bigger size
        # We also might find "height: 1.2em; width: auto;"
        if 'style="height: 1.2em; width: auto;"' in content:
            content = content.replace('style="height: 1.2em; width: auto;"', 'style="height: 3em; width: auto;"')
            updated = True
            
        if updated:
            with open(fp, 'w') as f:
                f.write(content)
            print(f"Updated logo in {os.path.relpath(fp, DIR)}")

if __name__ == '__main__':
    update_logos()
