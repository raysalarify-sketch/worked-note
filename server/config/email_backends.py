import json
import requests
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail.message import EmailMessage

class NHNCloudEmailBackend(BaseEmailBackend):
    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently)
        self.app_key = getattr(settings, 'NHN_EMAIL_APPKEY', '')
        self.secret_key = getattr(settings, 'NHN_EMAIL_SECRET', '')
        self.sender_address = getattr(settings, 'NHN_EMAIL_SENDER', '')
        self.api_url = f"https://email.api.nhncloudexternal.com/email/v2.0/appKeys/{self.app_key}/sender/mail"

    def send_messages(self, email_messages):
        if not email_messages:
            return 0
        
        count = 0
        for message in email_messages:
            if self._send(message):
                count += 1
        return count

    def _send(self, message):
        if not self.app_key or not self.secret_key or not self.sender_address:
            if not self.fail_silently:
                raise Exception("NHN Cloud Email configuration is missing.")
            return False

        headers = {
            "Content-Type": "application/json;charset=UTF-8",
            "X-Secret-Key": self.secret_key
        }

        payload = {
            "senderAddress": self.sender_address,
            "title": message.subject,
            "body": message.body,
            "receiverList": [{"receiveMailAddr": addr} for addr in message.to]
        }

        try:
            response = requests.post(self.api_url, headers=headers, data=json.dumps(payload))
            if response.status_code == 200:
                return True
            else:
                if not self.fail_silently:
                    raise Exception(f"NHN Cloud Email API failed: {response.text}")
                return False
        except Exception as e:
            if not self.fail_silently:
                raise e
            return False
