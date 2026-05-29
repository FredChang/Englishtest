import os
from PIL import Image

def split_grid(image_path, output_dir, grid_size=(4, 4), target_size=(128, 128)):
    # 單字列表 (對應網格位置)
    words = [
        "atlas", "campsite", "coastline", "countryside",
        "canal", "carriage", "cliff", "cave",
        "destination", "desert", "achievement", "ambition",
        "anxiety", "confidence", "creativity", "curiosity"
    ]
    
    if not os.path.exists(image_path):
        print(f"Error: Source image not found at {image_path}")
        return

    img = Image.open(image_path)
    w, h = img.size
    
    # 計算每個格子的邊界 (考慮到邊框，我們稍微向內縮一點點以獲得更乾淨的圖)
    cell_w = w / grid_size[1]
    cell_h = h / grid_size[0]
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    for i in range(grid_size[0]):
        for j in range(grid_size[1]):
            idx = i * grid_size[1] + j
            if idx >= len(words): break
            
            # 定義切割區域 (稍微避開邊框線)
            margin = 4 
            left = j * cell_w + margin
            upper = i * cell_h + margin
            right = (j + 1) * cell_w - margin
            lower = (i + 1) * cell_h - margin
            
            cell = img.crop((left, upper, right, lower))
            # 轉為 JPG 並縮放到 128x128
            cell = cell.convert("RGB").resize(target_size, Image.Resampling.LANCZOS)
            output_filename = f"b1-{words[idx]}.jpg"
            cell.save(os.path.join(output_dir, output_filename), "JPEG", quality=90)
            print(f"Successfully generated: {output_filename}")

if __name__ == "__main__":
    src = r"c:\Users\aggyy\source\repos\Englishtest\web\images\grid_source.png"
    out = r"c:\Users\aggyy\source\repos\Englishtest\web\images"
    split_grid(src, out)
