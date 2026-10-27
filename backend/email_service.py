import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

try:
    import win32com.client
    import pythoncom
    OUTLOOK_AVAILABLE = True
except ImportError:
    OUTLOOK_AVAILABLE = False

def parse_email_list(email_str):
    """
    Parses comma- or semicolon-separated email strings into a clean list of unique emails.
    """
    if not email_str:
        return []
    # Replace semicolons with commas
    normalized = str(email_str).replace(";", ",")
    raw_list = [e.strip() for e in normalized.split(",") if e.strip()]
    unique_list = []
    for e in raw_list:
        if e and e not in unique_list:
            unique_list.append(e)
    return unique_list

def send_smtp_email(smtp_config, to_email, cc_email, subject, body, attachments):
    """
    Sends an email using standard SMTP.
    smtp_config: dict with server, port, user, password, etc.
    attachments: list of file paths
    """
    server_addr = smtp_config.get("email_smtp_server", "").strip()
    try:
        port = int(smtp_config.get("email_smtp_port", 587))
    except (ValueError, TypeError):
        port = 587
        
    user = smtp_config.get("email_smtp_user", "").strip()
    password = smtp_config.get("email_smtp_pass", "").strip()
    
    if not server_addr:
        raise ValueError("SMTP Server Address is not configured in Settings.")
        
    to_recipients = parse_email_list(to_email)
    if not to_recipients:
        raise ValueError("Recipient Email address is missing or invalid.")
        
    cc_recipients = parse_email_list(cc_email)
    all_recipients = to_recipients + [c for c in cc_recipients if c not in to_recipients]
    
    msg = MIMEMultipart()
    msg['From'] = user if user else "billing@company.com"
    msg['To'] = ", ".join(to_recipients)
    if cc_recipients:
        msg['Cc'] = ", ".join(cc_recipients)
    msg['Subject'] = subject
    
    msg.attach(MIMEText(body, 'plain', 'utf-8'))
    
    # Attach files
    for filepath in attachments:
        if not filepath or not os.path.exists(filepath):
            continue
        filename = os.path.basename(filepath)
        with open(filepath, "rb") as attachment:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(attachment.read())
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f"attachment; filename= {filename}",
            )
            msg.attach(part)
            
    # Send with timeout (30 seconds)
    if port == 465:
        # Implicit SSL
        smtp = smtplib.SMTP_SSL(server_addr, port, timeout=30)
        smtp.ehlo()
    else:
        # Standard STARTTLS
        smtp = smtplib.SMTP(server_addr, port, timeout=30)
        smtp.ehlo()
        try:
            smtp.starttls()
            smtp.ehlo()
        except Exception as tls_err:
            print(f"STARTTLS negotiation note: {tls_err}")
            
    if user and password:
        smtp.login(user, password)
        
    smtp.sendmail(msg['From'], all_recipients, msg.as_string())
    smtp.quit()
    return True

def send_outlook_email(to_email, cc_email, subject, body, attachments, display=False):
    """
    Sends an email using local Microsoft Outlook installation via COM.
    display: if True, opens the Outlook compose window for the user to review.
    """
    if not OUTLOOK_AVAILABLE:
        raise RuntimeError("Microsoft Outlook COM is not available on this system (requires Windows and pywin32).")
        
    to_recipients = parse_email_list(to_email)
    if not to_recipients:
        raise ValueError("Recipient Email address is missing or invalid.")
    cc_recipients = parse_email_list(cc_email)

    pythoncom.CoInitialize()
    try:
        outlook = win32com.client.Dispatch("Outlook.Application")
        mail = outlook.CreateItem(0)  # 0 = olMailItem
        
        mail.To = "; ".join(to_recipients)
        if cc_recipients:
            mail.CC = "; ".join(cc_recipients)
        mail.Subject = subject
        mail.Body = body
        
        for filepath in attachments:
            if filepath and os.path.exists(filepath):
                # Outlook requires absolute paths
                mail.Attachments.Add(os.path.abspath(filepath))
                
        if display:
            mail.Display()
        else:
            mail.Send()
            
        return True
    except Exception as e:
        print(f"Outlook sending error: {e}")
        raise e
    finally:
        pythoncom.CoUninitialize()

def send_client_email(smtp_config, client_info, subject_template, body_template, invoice_details, attachments, display_outlook=False):
    """
    Constructs the subject and body using templates and sends the email via the chosen method.
    """
    to_email = client_info.get("email", "")
    cc_email = client_info.get("cc_email", "")
    
    if not to_email:
        raise ValueError("Client email address is missing.")
        
    try:
        val_num = float(invoice_details.get("valuation", 0.0) or 0.0)
    except (ValueError, TypeError):
        val_num = 0.0
        
    try:
        fee_num = float(invoice_details.get("fee_amount", 0.0) or 0.0)
    except (ValueError, TypeError):
        fee_num = 0.0
        
    try:
        total_num = float(invoice_details.get("total_amount", 0.0) or 0.0)
    except (ValueError, TypeError):
        total_num = 0.0

    # Format template fields safely
    context = {
        "ClientName": str(client_info.get("client_name", "")),
        "InvoiceNumber": str(invoice_details.get("invoice_number", "")),
        "Valuation": val_num,
        "FeeAmount": fee_num,
        "TotalAmount": total_num,
        "CustomMessage": str(invoice_details.get("custom_message", "") or "")
    }
    
    try:
        subject = subject_template.format(**context)
        body = body_template.format(**context)
        
        # If custom message is not already formatted in body, append it before Best Regards or at the end
        custom_msg = context["CustomMessage"]
        if custom_msg and "{CustomMessage}" not in body_template:
            if "Best Regards" in body:
                body = body.replace("Best Regards", f"{custom_msg}\n\nBest Regards")
            else:
                body = f"{body}\n\n{custom_msg}"
    except Exception as e:
        print(f"Template formatting fallback: {e}")
        subject = subject_template
        body = body_template

    use_outlook = smtp_config.get("email_use_outlook", "0") == "1"
    
    if use_outlook:
        return send_outlook_email(to_email, cc_email, subject, body, attachments, display=display_outlook)
    else:
        return send_smtp_email(smtp_config, to_email, cc_email, subject, body, attachments)
