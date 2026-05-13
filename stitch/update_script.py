import os
import glob
import re

DIR = '/Users/teenu/Downloads/Raen new website 3/stitch'

# The size selection script to append just before </body>
SIZE_SELECTION_SCRIPT = """
<script>
    // Size selection logic
    document.addEventListener('DOMContentLoaded', () => {
        const sizeButtonsContainer = document.querySelector('.space-y-4 .flex.gap-4');
        if (sizeButtonsContainer) {
            const sizeButtons = sizeButtonsContainer.querySelectorAll('button');
            sizeButtons.forEach(btn => {
                btn.addEventListener('click', function() {
                    // Remove active classes from all siblings
                    sizeButtons.forEach(b => {
                        b.classList.remove('bg-primary', 'text-on-primary', 'border-primary');
                        b.classList.add('border-outline-variant', 'hover:border-primary');
                    });
                    // Add active classes to clicked button
                    this.classList.add('bg-primary', 'text-on-primary', 'border-primary');
                    this.classList.remove('border-outline-variant', 'hover:border-primary');
                });
            });
        }
    });
</script>
"""

# The add to cart logic regex
OLD_CART_LOGIC = r"id: title\.toLowerCase\(\)\.replace\(/ /g, '-'\),\s*title: title,\s*price: price,\s*image: imgSrc,\s*category: category,\s*quantity: 1"

def update_files():
    html_files = glob.glob(os.path.join(DIR, '*.html'))
    lightbox_str = ""
    
    # Grab the lightbox code from bare-obsession.html
    with open(os.path.join(DIR, 'bare-obsession.html'), 'r') as f:
        bare_html = f.read()
        match = re.search(r'(<!-- Enhanced Lightbox Carousel \+ Zoom -->.*?</script>)\s*<script>\s*document\.querySelectorAll\(\'\.tove-details-btn\'\)', bare_html, re.DOTALL)
        if match:
            lightbox_str = match.group(1)

    for fp in html_files:
        with open(fp, 'r') as f:
            content = f.read()
            
        # Skip files that aren't product pages (checking for AddToCart script)
        if 'a.satin-cta' not in content or 'localStorage.setItem(\'raen_cart\'' not in content:
            continue

        changed = False
        
        # 1. Update Cart Logic to include selected size
        if 'size: selectedSize' not in content:
            # We need to extract the size before the product object definition
            find_str = "const product = {"
            replace_str = "const sizeBtn = document.querySelector('.space-y-4 .flex.gap-4 button.bg-primary');\n                let selectedSize = sizeBtn ? sizeBtn.innerText.trim() : 'S';\n                \n                // Create product object\n                const product = {"
            if find_str in content and "let selectedSize = sizeBtn" not in content:
                content = content.replace(find_str, replace_str)
            
            # Replace the product object literal
            new_cart_logic = "id: title.toLowerCase().replace(/ /g, '-') + '-' + selectedSize.toLowerCase(),\n                    title: title,\n                    price: price,\n                    image: imgSrc,\n                    category: category,\n                    size: selectedSize,\n                    quantity: 1"
            if "size: selectedSize," not in content:
                content = re.sub(OLD_CART_LOGIC, new_cart_logic, content)
            changed = True

        # 2. Append Size Selection Script
        if 'Size selection logic' not in content:
            content = content.replace('</body>', SIZE_SELECTION_SCRIPT + '\n</body>')
            changed = True
            
        # 3. Handle product-detail.html missing lightbox
        if 'product-detail.html' in fp:
            if 'raen-lightbox' not in content and lightbox_str:
                # Insert the lightbox before the sizing script or before </body>
                content = content.replace('</body>', lightbox_str + '\n</body>')
                changed = True
                
            # Extra detail: ensure product-detail.html's main gallery images have pointing cursors too.
            # Lightbox script targets "main img". So they will automatically have cursor:zoom-in if lightbox is there.

        # 4. Check 'shopping bag' logic for size? Actually, we're not touching shopping bag yet, only product pages.
        # But wait, checking for duplicate products in the cart array: 
        # The existing code has `const existingIndex = cart.findIndex(item => item.id === product.id);`
        # Because we updated the product.id to include the size, this will correctly treat different sizes as different items.

        if changed:
            with open(fp, 'w') as f:
                f.write(content)
            print(f"Updated {os.path.basename(fp)}")

if __name__ == '__main__':
    update_files()
