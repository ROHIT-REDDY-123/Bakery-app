import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv(override=True)

logger = logging.getLogger("BakeryMailer")

def send_order_placed_email(order_data):
    """
    Sends an email to the admin notifying that a new bakery order has been placed.
    Uses Gmail SMTP (smtp.gmail.com:465 / 587) with credentials from .env.
    If credentials are missing or invalid, logs the email details gracefully.
    """
    admin_email = os.getenv("ADMIN_EMAIL", "reddirohitabc@gmail.com").strip()
    gmail_user = os.getenv("GMAIL_USER", "").strip()
    gmail_pass = os.getenv("GMAIL_APP_PASS", "").replace(" ", "").strip()

    order_id = order_data.get("order_id", "N/A")
    customer = order_data.get("shipping_address", {})
    full_name = customer.get("fullName", "Customer")
    phone = customer.get("phone", "N/A")
    street = customer.get("street", "N/A")
    city = customer.get("city", "N/A")
    pincode = customer.get("pincode", "N/A")
    total_amount = order_data.get("total_amount", 0.0)
    items = order_data.get("items", [])

    items_html_rows = ""
    for item in items:
        name = item.get("name", "Item")
        qty = item.get("quantity", 1)
        price = item.get("price", 0.0)
        subtotal = qty * price
        items_html_rows += f"""
        <tr style="border-bottom: 1px solid #2a201c;">
            <td style="padding: 10px 0; color: #fff;">{name}</td>
            <td style="padding: 10px 0; text-align: center; color: #d1c7c2;">x{qty}</td>
            <td style="padding: 10px 0; text-align: right; color: #f59e0b; font-weight: bold;">₹{subtotal:.2f}</td>
        </tr>
        """

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>New Bakery Order - {order_id}</title>
    </head>
    <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0d0d0d; color: #eeeeee;">
        <div style="max-width: 580px; margin: 0 auto; background: #161616; border-radius: 14px; border: 1px solid #2a2a2a; overflow: hidden;">
            <!-- Adidas/Bakery Bold Header -->
            <div style="background: #000000; padding: 28px 24px; border-bottom: 2px solid #d97706; text-align: left;">
                <p style="margin: 0; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #d97706; font-weight: 800;">FRESH OVEN DISPATCH</p>
                <h1 style="margin: 6px 0 0 0; font-size: 26px; letter-spacing: -0.5px; text-transform: uppercase; color: #ffffff; font-weight: 900;">NEW ORDER RECEIVED</h1>
            </div>

            <div style="padding: 24px;">
                <!-- Unique Order ID Banner -->
                <div style="background: #202020; border: 1px dashed #d97706; border-radius: 8px; padding: 14px 18px; margin-bottom: 22px;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #999;">Unique Order ID</div>
                    <div style="font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: 1px; margin-top: 4px;">{order_id}</div>
                </div>

                <!-- Customer & Mandatory Address Info -->
                <h3 style="margin: 0 0 10px 0; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; color: #d97706;">Mandatory Delivery Address</h3>
                <div style="background: #1c1c1c; border-radius: 8px; padding: 16px; margin-bottom: 22px; font-size: 14px; line-height: 1.6; color: #dddddd;">
                    <div><strong style="color: #ffffff;">Name:</strong> {full_name}</div>
                    <div><strong style="color: #ffffff;">Phone:</strong> {phone}</div>
                    <div><strong style="color: #ffffff;">Street Address:</strong> {street}</div>
                    <div><strong style="color: #ffffff;">City:</strong> {city}</div>
                    <div><strong style="color: #ffffff;">Pincode/ZIP:</strong> {pincode}</div>
                </div>

                <!-- Items Ordered -->
                <h3 style="margin: 0 0 10px 0; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; color: #d97706;">Items in Hot Bag</h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
                    <thead>
                        <tr style="border-bottom: 1px solid #333; color: #888; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;">
                            <th style="padding: 8px 0; text-align: left;">Item</th>
                            <th style="padding: 8px 0; text-align: center;">Qty</th>
                            <th style="padding: 8px 0; text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items_html_rows}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2" style="padding: 14px 0 0 0; font-size: 16px; font-weight: 800; text-transform: uppercase; color: #ffffff;">Total Order Value</td>
                            <td style="padding: 14px 0 0 0; font-size: 18px; font-weight: 800; text-align: right; color: #10b981;">₹{total_amount:.2f}</td>
                        </tr>
                    </tfoot>
                </table>

                <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #282828; text-align: center; font-size: 12px; color: #777;">
                    Payment status: <strong>Pay on Delivery / Fresh Bake Confirmed</strong> (No Online Payment)
                </div>
            </div>
        </div>
    </body>
    </html>
    """

    # If credentials are not set in .env, log cleanly and return simulated success
    if not gmail_user or not gmail_pass:
        logger.info(f"[SIMULATED GMAIL NOTIFICATION] Admin email notification generated for Order {order_id} to {admin_email}.")
        logger.info(f"[ORDER DETAILS] Customer: {full_name} | Phone: {phone} | Address: {street}, {city} - {pincode} | Total: ₹{total_amount:.2f}")
        return {
            "status": "simulated",
            "message": "Email logged in console. Provide GMAIL_USER and GMAIL_APP_PASS in .env to dispatch live emails.",
            "recipient": admin_email
        }

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"🔥 New Bakery Order #{order_id} Received!"
        msg["From"] = f"Artisan Bakery <{gmail_user}>"
        msg["To"] = admin_email

        part = MIMEText(html_content, "html")
        msg.attach(part)

        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as server:
            server.login(gmail_user, gmail_pass)
            server.sendmail(gmail_user, [admin_email], msg.as_string())

        logger.info(f"Successfully sent live Gmail order alert to {admin_email} for order {order_id}")
        return {"status": "sent", "recipient": admin_email}
    except Exception as e:
        logger.error(f"Failed to send live Gmail alert: {e}")
        return {"status": "failed", "error": str(e), "recipient": admin_email}


def send_otp_email(to_email, otp_code, user_name="Customer"):
    """
    Sends a 6-digit verification OTP email to a new user registering an account.
    Uses Gmail SMTP credentials configured in .env.
    """
    to_email = (to_email or "").strip().lower()
    if not to_email:
        return {"status": "failed", "error": "Recipient email is missing"}

    gmail_user = os.getenv("GMAIL_USER", "").strip()
    gmail_pass = os.getenv("GMAIL_APP_PASS", "").replace(" ", "").strip()

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Artisan Bakery - Verification Code</title>
    </head>
    <body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0b0a; color: #ece6e2;">
        <div style="max-width: 520px; margin: 0 auto; background: #141312; border-radius: 14px; border: 1px solid #2b2622; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <!-- Header -->
            <div style="background: #000000; padding: 26px 24px; border-bottom: 2px solid #d97706; text-align: center;">
                <p style="margin: 0; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #d97706; font-weight: 800;">FARM FRESH BAKERY & INGREDIENTS</p>
                <h1 style="margin: 6px 0 0 0; font-size: 22px; letter-spacing: 0.5px; text-transform: uppercase; color: #ffffff; font-weight: 900;">SECURITY VERIFICATION</h1>
            </div>

            <!-- Body -->
            <div style="padding: 28px 24px; text-align: center;">
                <p style="font-size: 15px; color: #d1c7c2; margin: 0 0 16px 0;">
                    Hello <strong style="color: #ffffff;">{user_name}</strong>,
                </p>
                <p style="font-size: 14px; line-height: 1.6; color: #a89f99; margin: 0 0 24px 0;">
                    Thank you for signing up with <strong style="color: #ffffff;">The Artisan Drop</strong>. Use the 6-digit verification code below to verify your email and activate your account:
                </p>

                <!-- OTP Code Display Card -->
                <div style="background: #1c1815; border: 2px dashed #d97706; border-radius: 12px; padding: 20px 10px; margin: 0 auto 24px auto; max-width: 320px;">
                    <div style="font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #d97706; margin-bottom: 8px; font-weight: 700;">ONE-TIME PASSCODE (OTP)</div>
                    <div style="font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #ffffff; font-family: 'Courier New', Courier, monospace;">
                        {otp_code}
                    </div>
                </div>

                <p style="font-size: 13px; color: #8a827d; margin: 0 0 16px 0;">
                    ⏱️ This verification code will expire in <strong style="color: #f59e0b;">10 minutes</strong>.
                </p>
                <p style="font-size: 12px; color: #6b635f; line-height: 1.5; margin: 0;">
                    If you did not request this verification code, please ignore this email. Do not share this OTP with anyone.
                </p>
            </div>

            <!-- Footer -->
            <div style="background: #0d0c0b; padding: 16px 24px; text-align: center; border-top: 1px solid #221e1a; font-size: 11px; color: #6b635f;">
                THE ARTISAN DROP &bull; Artisanal Sourdough & Farm-Fresh Bakery &bull; Bengaluru
            </div>
        </div>
    </body>
    </html>
    """

    if not gmail_user or not gmail_pass:
        logger.info(f"[SIMULATED EMAIL OTP] Sent OTP {otp_code} to {to_email}")
        return {
            "status": "simulated",
            "message": "Email logged to console. Configure GMAIL_USER and GMAIL_APP_PASS in .env for live dispatch.",
            "recipient": to_email,
            "otp": otp_code
        }

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"🔐 Your Artisan Bakery Verification Code: {otp_code}"
        msg["From"] = f"The Artisan Drop <{gmail_user}>"
        msg["To"] = to_email

        part = MIMEText(html_content, "html")
        msg.attach(part)

        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as server:
            server.login(gmail_user, gmail_pass)
            server.sendmail(gmail_user, [to_email], msg.as_string())

        logger.info(f"[LIVE EMAIL OTP SENT] Dispatched OTP {otp_code} to {to_email}")
        return {"status": "sent", "recipient": to_email}
    except Exception as e:
        logger.error(f"[LIVE EMAIL OTP FAILED] Could not send OTP to {to_email}: {e}")
        return {"status": "failed", "error": str(e), "recipient": to_email}

