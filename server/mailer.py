import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("mailer")

EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USER = os.getenv("EMAIL_USER", "")
EMAIL_PASS = os.getenv("EMAIL_PASS", "")

def send_password_reset_email(to_email: str, username: str, otp_code: str, reset_link: str) -> bool:
    """
    Sends a beautifully formatted HTML password reset email containing
    both a 6-digit OTP and a direct 1-click reset link.
    """
    if not EMAIL_USER or not EMAIL_PASS:
        logger.error("[Mailer] EMAIL_USER or EMAIL_PASS is not configured in .env")
        raise ValueError("Email service is not configured on the server. Please check SMTP settings.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"CardioMind AI — Password Reset Code: {otp_code}"
    msg["From"] = f"CardioMind AI <{EMAIL_USER}>"
    msg["To"] = to_email

    # Plain-text version for older email clients
    text_content = f"""
Hello {username},

We received a request to reset the password for your CardioMind AI account.

Your 6-digit Verification Code (OTP) is:
{otp_code}

This code will expire in 15 minutes.

Alternatively, you can reset your password directly by visiting this link:
{reset_link}

If you did not request this password reset, please ignore this email or contact support.

Best regards,
The CardioMind AI Team
"""

    # Rich responsive HTML template matching the CardioMind theme
    html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password — CardioMind AI</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f6fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f6fc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px -4px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header Bar (Brand Dark Navy) -->
          <tr>
            <td style="background-color: #0c1527; padding: 28px 32px; text-align: center;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td style="vertical-align: middle; padding-right: 12px;">
                    <div style="width: 38px; height: 38px; background-color: #3b82f6; border-radius: 10px; display: inline-block; line-height: 38px; text-align: center; color: #ffffff; font-weight: bold; font-size: 20px;">
                      &#10084;
                    </div>
                  </td>
                  <td style="vertical-align: middle; text-align: left;">
                    <div style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">CardioMind AI</div>
                    <div style="font-size: 11px; color: #94a3b8; font-weight: 500;">Smarter Insights, Healthier Hearts.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">
                Password Reset Request
              </h2>
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                Hello <strong>{username}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                We received a request to reset your password. Use the verification code below or click the direct reset button to set a new password.
              </p>

              <!-- OTP Highlight Box -->
              <div style="background-color: #eff6ff; border: 1.5px dashed #3b82f6; border-radius: 12px; padding: 22px; text-align: center; margin-bottom: 28px;">
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb; margin-bottom: 8px;">
                  Your 6-Digit Verification Code (OTP)
                </div>
                <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; font-family: 'Courier New', Courier, monospace; margin: 4px 0 8px 0;">
                  {otp_code}
                </div>
                <div style="font-size: 12px; color: #64748b;">
                  Expires in <strong>15 minutes</strong>
                </div>
              </div>

              <!-- Option 2: Direct Reset Button -->
              <div style="text-align: center; margin-bottom: 28px;">
                <div style="font-size: 13px; color: #64748b; margin-bottom: 12px;">
                  — OR reset directly using this button —
                </div>
                <a href="{reset_link}" target="_blank" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 13px 30px; border-radius: 10px; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);">
                  Reset My Password &rarr;
                </a>
              </div>

              <!-- Direct Link Fallback -->
              <p style="margin: 0 0 24px 0; font-size: 12px; line-height: 1.5; color: #94a3b8; word-break: break-all;">
                If the button above doesn't work, copy and paste this link into your browser:<br>
                <a href="{reset_link}" style="color: #3b82f6; text-decoration: underline;">{reset_link}</a>
              </p>

              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">

              <!-- Security Notice -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px;">
                <div style="font-size: 12px; color: #92400e; line-height: 1.5;">
                  <strong>Security Note:</strong> If you did not request a password reset, please ignore this email or change your password immediately if you suspect unauthorized access.
                </div>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                &copy; {os.getenv("APP_YEAR", "2026")} CardioMind AI Decision Support System.<br>
                Designed for clinical cardiovascular risk evaluation and explainable AI insights.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    part1 = MIMEText(text_content, "plain")
    part2 = MIMEText(html_content, "html")
    msg.attach(part1)
    msg.attach(part2)

    try:
        logger.info(f"[Mailer] Connecting to SMTP server {EMAIL_HOST}:{EMAIL_PORT}...")
        server = smtplib.SMTP(EMAIL_HOST, EMAIL_PORT, timeout=15)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(EMAIL_USER, EMAIL_PASS)
        server.sendmail(EMAIL_USER, [to_email], msg.as_string())
        server.quit()
        logger.info(f"[Mailer] Successfully sent password reset email to {to_email}")
        return True
    except Exception as e:
        logger.error(f"[Mailer] Failed to send email to {to_email}: {e}")
        raise e
