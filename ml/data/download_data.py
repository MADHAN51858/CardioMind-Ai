import os
import urllib.request
from ml.config import RAW_DATA_DIR, EXTERNAL_DATA_DIR

# URLs for datasets
UCI_URL = "https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data"

NHANES_URLS = {
    "DEMO_J": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/DEMO_J.xpt",
    "MCQ_J": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/MCQ_J.xpt",
    "BPX_J": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/BPX_J.xpt",
    "TCHOL_J": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/TCHOL_J.xpt"
}

def download_file(url, dest_path):
    """Download a file from a URL to a destination path with basic logging."""
    # If file exists and is larger than 10KB, treat as cached. Otherwise, re-download.
    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 10000:
        print(f"[CACHE] Valid file already exists: {dest_path}")
        return
    
    print(f"[DOWNLOAD] Downloading {url} -> {dest_path}...")
    try:
        urllib.request.urlretrieve(url, dest_path)
        print(f"[SUCCESS] Download completed: {dest_path}")
    except Exception as e:
        print(f"[ERROR] Failed to download {url}. Reason: {e}")
        raise

def main():
    # Make sure download directories exist
    os.makedirs(RAW_DATA_DIR, exist_ok=True)
    os.makedirs(EXTERNAL_DATA_DIR, exist_ok=True)

    # 1. Download Cleveland dataset
    cleveland_dest = os.path.join(RAW_DATA_DIR, "processed.cleveland.data")
    download_file(UCI_URL, cleveland_dest)

    # 2. Download NHANES datasets
    for key, url in NHANES_URLS.items():
        dest = os.path.join(EXTERNAL_DATA_DIR, f"{key}.XPT")
        download_file(url, dest)

if __name__ == "__main__":
    main()
