import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGE_DIR = os.path.join(ROOT, "web", "images")

# Import Grids from process_grids
import sys
sys.path.append(os.path.join(ROOT, "tools"))
from process_grids import GRIDS

def erase_text_from_images(grids_to_process, height_percentage=0.22):
    count = 0
    for grid_num in grids_to_process:
        if grid_num not in GRIDS:
            continue
        words_info = GRIDS[grid_num]
        for level, word in words_info:
            filename = f"{level.lower()}-{word.replace(' ', '_')}.jpg"
            filepath = os.path.join(IMAGE_DIR, filename)
            
            if not os.path.exists(filepath):
                print(f"File not found: {filename}")
                continue
                
            try:
                img = Image.open(filepath)
                w, h = img.size
                
                # Draw a white rectangle over the top portion of the image
                draw = ImageDraw.Draw(img)
                erase_height = int(h * height_percentage)
                draw.rectangle([(0, 0), (w, erase_height)], fill=(255, 255, 255))
                
                img.save(filepath, "JPEG", quality=90)
                print(f"Erased text from: {filename}")
                count += 1
            except Exception as e:
                print(f"Error processing {filename}: {e}")
                
    print(f"Successfully processed {count} images.")

if __name__ == "__main__":
    # Process Grids 1 to 10
    erase_text_from_images([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
