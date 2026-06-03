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

def send_smtp_email(smtp_config, to_email, cc_email, subject, body, attachments):
    """
    Sends an email using standard SMTP.
    smtp_config: dict with server, port, user, password, etc.
    attachments: list of file paths
    """
    server_addr = smtp_config.get("email_smtp_server", "")
    port = int(smtp_config.get("email_smtp_port", 587))
    user = smtp_config.get("email_smtp_user", "")
    password = smtp_config.get("email_smtp_pass", "")
    
    msg = MIMEMultipart()
    msg['From'] = user
    msg['To'] = to_email
    if cc_email:
        msg['Cc'] = cc_email
    msg['Subject'] = subject
    
    msg.attach(MIMEText(body, 'plain'))
    
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
            
    # Send
    smtp = smtplib.SMTP(server_addr, port)
    smtp.ehlo()
    smtp.starttls() # Default to TLS
    smtp.ehlo()
    if user and password:
        smtp.login(user, password)
        
    recipients = [to_email]
    if cc_email:
        recipients.append(cc_email)
        
    smtp.sendmail(user, recipients, msg.as_string())
    smtp.quit()
    return True

def send_outlook_email(to_email, cc_email, subject, body, attachments, display=False):
    """
    Sends an email using local Microsoft Outlook installation via COM.
    display: if True, opens the Outlook compose window for the user to review.
    """
    if not OUTLOOK_AVAILABLE:
        raise RuntimeError("Microsoft Outlook is not installed or pywin32 is not configured.")
        
    pythoncom.CoInitialize()
    try:
        outlook = win32com.client.Dispatch("Outlook.Application")
        mail = outlook.CreateItem(0) # 0 = olMailItem
        
        mail.To = to_email
        if cc_email:
            mail.CC = cc_email
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
        
    # Format template fields
    context = {
        "ClientName": client_info.get("client_name", ""),
        "InvoiceNumber": invoice_details.get("invoice_number", ""),
        "Valuation": invoice_details.get("valuation", 0.0),
        "FeeAmount": invoice_details.get("fee_amount", 0.0),
        "TotalAmount": invoice_details.get("total_amount", 0.0),
    }
    
    try:
        subject = subject_template.format(**context)
        body = body_template.format(**context)
    except Exception as e:
        # Fallback if formatting fails due to mismatched brackets
        print(f"Template formatting error: {e}. Using raw text.")
        subject = subject_template
        body = body_template

    use_outlook = smtp_config.get("email_use_outlook", "0") == "1"
    
    if use_outlook:
        return send_outlook_email(to_email, cc_email, subject, body, attachments, display=display_outlook)
    else:
        return send_smtp_email(smtp_config, to_email, cc_email, subject, body, attachments)
