import os

DIR = '/Users/teenu/Downloads/Raen new website 3/stitch'

def fix_product_detail():
    bare_path = os.path.join(DIR, 'bare-obsession.html')
    target_path = os.path.join(DIR, 'product-detail.html')
    
    with open(bare_path, 'r') as f:
        bare_content = f.read()
        
    # Extract everything after </footer> in bare-obsession.html
    # It contains the cart script, lightbox, and size selection script
    parts = bare_content.split('</footer>')
    if len(parts) > 1:
        scripts = parts[1].replace('</body></html>', '').strip()
        
        with open(target_path, 'r') as f:
            target_content = f.read()
            
        if 'raen-lightbox' not in target_content:
            target_content = target_content.replace('</body>', scripts + '\n</body>')
            
            with open(target_path, 'w') as f:
                f.write(target_content)
            print("Successfully updated product-detail.html")
        else:
            print("product-detail.html already updated.")
            
if __name__ == '__main__':
    fix_product_detail()
