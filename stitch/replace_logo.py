import os
import glob
import re

DIR = '/Users/teenu/Downloads/Raen new website 3/stitch'

def get_relative_prefix(file_path):
    # Calculate how deep the file is relative to DIR
    rel_path = os.path.relpath(file_path, DIR)
    depth = rel_path.count(os.sep)
    if depth == 0:
        return ""
    else:
        return "../" * depth

def update_logos():
    # Find all html files in the directory recursively
    html_files = []
    for root, _, files in os.walk(DIR):
        for file in files:
            if file.endswith('.html'):
                html_files.append(os.path.join(root, file))
                
    # Regex to find >R A E N< inside an a tag
    # It might be spread with spaces or newlines, but grep showed it's just >R A E N<
    pattern = re.compile(r'(<a[^>]*?>)\s*R A E N\s*(</a>)')
    
    for fp in html_files:
        with open(fp, 'r') as f:
            content = f.read()
            
        if not pattern.search(content):
            continue
            
        prefix = get_relative_prefix(fp)
        img_src = f"{prefix}public/images/logo.png"
        
        # We use style="height: 1.2em; width: auto; display: inline-block;" so the logo scales with the text size class (text-2xl, text-3xl) of the a tag
        replacement = r'\1<img src="' + img_src + r'" alt="RAEN Logo" class="inline-block" style="height: 1.2em; width: auto;" />\2'
        
        new_content = pattern.sub(replacement, content)
        
        with open(fp, 'w') as f:
            f.write(new_content)
        print(f"Updated logo in {os.path.relpath(fp, DIR)}")

if __name__ == '__main__':
    update_logos()
