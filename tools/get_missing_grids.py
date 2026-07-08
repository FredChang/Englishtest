import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKUP_DIR = os.path.join(ROOT, "backup data")

def main():
    missing = []
    for num in range(21, 65):
        filename = f"grid_{num}.png"
        filepath = os.path.join(BACKUP_DIR, filename)
        if not os.path.exists(filepath):
            missing.append(num)
    print("Missing grids count:", len(missing))
    print("Missing grids:", missing)

if __name__ == "__main__":
    main()
