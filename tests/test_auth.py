import pytest
from fastapi.testclient import TestClient
import os
import sys

# Ensure project root is in sys.path
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from server.main import app
from server.database import get_db_connection, verify_password_reset_otp, verify_password_reset_token, mongo_db

client = TestClient(app)

def test_auth_full_flow():
    # 1. Register a test user
    test_user = {
        "username": "cardiotester_unit",
        "email": "cardiotester_unit@example.com",
        "password": "StrongPassword123!",
        "full_name": "Cardio Tester"
    }

    # Clean up any existing record with same username/email if present
    if mongo_db is not None:
        try:
            mongo_db.users.delete_many({"$or": [{"username": test_user["username"]}, {"email": test_user["email"]}]})
            mongo_db.password_resets.delete_many({"email": test_user["email"]})
        except Exception:
            pass

    conn = get_db_connection()
    if conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE username = ? OR email = ?", (test_user["username"], test_user["email"]))
        cursor.execute("DELETE FROM password_resets WHERE email = ?", (test_user["email"],))
        conn.commit()
        conn.close()

    reg_res = client.post("/api/auth/register", json=test_user)
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["username"] == "cardiotester_unit"
    assert reg_data["user"]["email"] == "cardiotester_unit@example.com"

    # 2. Prevent duplicate registration
    dup_res = client.post("/api/auth/register", json=test_user)
    assert dup_res.status_code == 400

    # 3. Login with username
    login_user_res = client.post("/api/auth/login", json={
        "username": "cardiotester_unit",
        "password": "StrongPassword123!"
    })
    assert login_user_res.status_code == 200
    token = login_user_res.json()["access_token"]

    # 4. Login with email
    login_email_res = client.post("/api/auth/login", json={
        "identifier": "cardiotester_unit@example.com",
        "password": "StrongPassword123!"
    })
    assert login_email_res.status_code == 200

    # 5. Get current user profile
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["username"] == "cardiotester_unit"

    # 6. Forgot Password (OTP / Token generation)
    # Mock / direct test of password reset generation in DB
    from server.database import create_password_reset
    otp = "654321"
    reset_token = "mock_secret_reset_token_xyz"
    create_password_reset(email="cardiotester_unit@example.com", otp=otp, token=reset_token, expires_minutes=15)

    # 7. Verify OTP endpoint
    verify_otp_res = client.post("/api/auth/verify-otp", json={
        "email": "cardiotester_unit@example.com",
        "otp": "654321"
    })
    assert verify_otp_res.status_code == 200
    assert verify_otp_res.json()["valid"] is True
    assert verify_otp_res.json()["token"] == reset_token

    # 8. Reset password using OTP
    new_pwd = "NewSecurePassword456!"
    reset_res = client.post("/api/auth/reset-password", json={
        "email": "cardiotester_unit@example.com",
        "otp": "654321",
        "new_password": new_pwd
    })
    assert reset_res.status_code == 200

    # 9. Verify old password fails
    old_login_res = client.post("/api/auth/login", json={
        "username": "cardiotester_unit",
        "password": "StrongPassword123!"
    })
    assert old_login_res.status_code == 401

    # 10. Verify new password succeeds
    new_login_res = client.post("/api/auth/login", json={
        "username": "cardiotester_unit",
        "password": new_pwd
    })
    assert new_login_res.status_code == 200

    # 11. Test Reset password using Token Link
    token_link = "token_flow_test_999"
    create_password_reset(email="cardiotester_unit@example.com", otp="999888", token=token_link, expires_minutes=15)
    
    token_reset_res = client.post("/api/auth/reset-password", json={
        "token": token_link,
        "new_password": "AnotherNewPassword789!"
    })
    assert token_reset_res.status_code == 200

    # Reusing token must fail
    reused_res = client.post("/api/auth/reset-password", json={
        "token": token_link,
        "new_password": "YetAnotherPassword111!"
    })
    assert reused_res.status_code == 400

    # 12. Test Update Profile
    update_login = client.post("/api/auth/login", json={
        "username": "cardiotester_unit",
        "password": "AnotherNewPassword789!"
    })
    auth_token = update_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {auth_token}"}

    # Successful update of full_name and email
    update_res = client.put("/api/auth/profile", json={
        "full_name": "Updated Cardio Tester",
        "email": "updated_cardiotester@example.com"
    }, headers=headers)
    assert update_res.status_code == 200
    assert update_res.json()["user"]["full_name"] == "Updated Cardio Tester"
    assert update_res.json()["user"]["email"] == "updated_cardiotester@example.com"

    # Verify profile via get_current_user_profile
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["full_name"] == "Updated Cardio Tester"
    assert me_res.json()["email"] == "updated_cardiotester@example.com"
