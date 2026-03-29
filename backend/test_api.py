import requests
import os

BASE_URL = "http://localhost:5000"

def check_health():
    print("Step 1: Checking Backend Health...")
    try:
        r = requests.get(f"{BASE_URL}/health")
        if r.status_code == 200:
            print("[OK] Health Check Passed:", r.json())
        else:
            print("[FAIL] Health Check Failed:", r.status_code, r.text)
    except Exception as e:
        print("[FAIL] Server not running. Did you start 'python app.py' in a separate terminal?")
        return False
    return True

def check_gemini_key():
    print("\nStep 2: Checking Gemini API Key...")
    if not os.environ.get("GEMINI_KEY"):
        print("[FAIL] Warning: GEMINI_KEY environment variable is missing!")
        print("Run the following before starting the backend:")
        print("  Windows: $env:GEMINI_KEY='your-key-here'")
        print("  Mac/Linux: export GEMINI_KEY='your-key-here'")
        print("Test will proceed, but AI Agents might fail if key inside backend is invalid.\n")
    else:
        print("[OK] GEMINI_KEY is present in this shell session.\n")

def test_couple_planner():
    print("Step 3: Testing Couple's Planner Endpoint...")
    payload = {
        "husband_age": 30,
        "wife_age": 28,
        "combined_income": 150000,
        "monthly_expenses": 60000,
        "existing_corpus": 500000
    }
    try:
        r = requests.post(f"{BASE_URL}/couple", json=payload)
        if r.status_code == 200:
            print("[OK] Couple Planner Success:")
            # Only print first 200 chars to avoid huge console dumps
            print(str(r.json())[:200] + "...")
        else:
            print("[FAIL] Couple Planner Error:", r.status_code, r.text)
    except Exception as e:
        print("[FAIL] Exception:", e)

def test_analyze():
    print("\nStep 4: Testing PDF Analyze Endpoint...")
    try:
        if not os.path.exists("dummy_statement.pdf"):
            print("[FAIL] Error: dummy_statement.pdf not found. Creating one now...")
            import fitz
            doc = fitz.open()
            page = doc.new_page()
            page.insert_text((50, 50), "CAMS Mutual Fund Statement\nFund: SBI Small Cap Fund\nAmount: 50000\nCategory: Equity")
            doc.save("dummy_statement.pdf")
            print("[OK] dummy_statement.pdf created.")

        with open("dummy_statement.pdf", "rb") as f:
            files = {"pdf": f}
            r = requests.post(f"{BASE_URL}/analyze", files=files)
            if r.status_code == 200:
                print("[OK] Analyze Endpoint Success!")
                print("Audits:", r.json().get("audit_log", []))
            else:
                print("[FAIL] Analyze Error:", r.status_code, r.text)
    except Exception as e:
        print("❌ Exception:", e)

if __name__ == "__main__":
    if check_health():
        check_gemini_key()
        test_couple_planner()
        test_analyze()
