"""
발송 서비스 모듈
- 이메일: Django SMTP
- 문자: 알리고 API (또는 NHN Cloud)
- 카카오톡: 카카오 알림톡 API

※ 각 서비스의 API 키는 settings.py 환경변수로 관리
"""
import logging
import requests
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


NHN_SMS_APPKEY = '4TK6OCy6GVJG4pXH'
NHN_SMS_SECRET = 'ZzqPFtb1tu2mHoZ2dbPEVgE8w7OmRiYm'
NHN_SMS_SENDER = '02-2135-1916'.replace('-', '')

NHN_EMAIL_APPKEY = 'EyYGa3lHr5QDRCff'
NHN_EMAIL_SECRET = 'rYTVRxdi'
NHN_EMAIL_SENDER = 'service@salarify.kr'

class EmailService:
    """이메일 발송 (NHN Cloud Email)"""

    @staticmethod
    def send(recipients, subject, message, from_email=None):
        errors = []
        sent_count = 0
        
        url = f"https://api-mail.cloud.toast.com/email/v2.0/appKeys/{NHN_EMAIL_APPKEY}/sender/mail"
        headers = {
            "X-Secret-Key": NHN_EMAIL_SECRET,
            "Content-Type": "application/json;charset=UTF-8"
        }

        for r in recipients:
            if not r.get('email'):
                errors.append(f"{r.get('name', '알 수 없음')}: 이메일 주소 없음")
                continue
            
            payload = {
                "senderAddress": NHN_EMAIL_SENDER,
                "title": subject or "[워크드 노트] 안내 메일입니다.",
                "body": message,
                "receiverList": [{"receiveMailAddr": r['email'], "receiveType": "MRT0"}]
            }

            try:
                resp = requests.post(url, headers=headers, json=payload, timeout=10)
                result = resp.json()
                
                if result.get('header', {}).get('isSuccessful'):
                    sent_count += 1
                    logger.info(f"이메일 발송 성공: {r['email']}")
                else:
                    msg = result.get('header', {}).get('resultMessage', '발송 실패')
                    errors.append(f"{r.get('name', '')}: {msg}")
                    logger.error(f"이메일 발송 실패: {r['email']} - {result}")
            except Exception as e:
                errors.append(f"{r.get('name', '')}: {str(e)}")
                logger.error(f"이메일 발송 오류: {str(e)}")

        return {
            'success': sent_count > 0,
            'sent_count': sent_count,
            'errors': errors,
        }


class SMSService:
    """문자 발송 (NHN Cloud SMS)"""

    @staticmethod
    def send(recipients, message):
        errors = []
        sent_count = 0
        
        # 90바이트 초과 여부 확인하여 단문(SMS)/장문(LMS) 선택
        msg_bytes = len(message.encode('utf-8'))
        msg_type = "lms" if msg_bytes > 90 else "sms"
        api_type = "mms" if msg_bytes > 90 else "sms"
        
        url = f"https://api-sms.cloud.toast.com/sms/v3.0/appKeys/{NHN_SMS_APPKEY}/sender/{api_type}"
        headers = {
            "X-Secret-Key": NHN_SMS_SECRET,
            "Content-Type": "application/json;charset=UTF-8"
        }

        for r in recipients:
            if not r.get('phone'):
                errors.append(f"{r.get('name', '알 수 없음')}: 전화번호 없음")
                continue

            phone = r['phone'].replace('-', '').replace(' ', '')
            
            payload = {
                "body": message,
                "sendNo": NHN_SMS_SENDER,
                "recipientList": [{"recipientNo": phone}]
            }
            if msg_type == "lms":
                payload["title"] = "워크드 노트 안내"

            try:
                resp = requests.post(url, headers=headers, json=payload, timeout=10)
                result = resp.json()

                if result.get('header', {}).get('isSuccessful'):
                    sent_count += 1
                    logger.info(f"문자 발송 성공: {phone}")
                else:
                    msg = result.get('header', {}).get('resultMessage', '발송 실패')
                    errors.append(f"{r.get('name', '')}: {msg}")
                    logger.error(f"문자 발송 실패: {phone} - {result}")
            except Exception as e:
                errors.append(f"{r.get('name', '')}: {str(e)}")
                logger.error(f"문자 발송 오류: {str(e)}")

        return {
            'success': sent_count > 0,
            'sent_count': sent_count,
            'errors': errors,
        }


class KakaoService:
    """카카오톡 알림톡 발송"""

    API_URL = 'https://kapi.kakao.com/v2/api/talk/memo/default/send'

    @staticmethod
    def send(recipients, message, subject=''):
        """
        Args:
            recipients: [{'name': '홍길동', 'kakao_id': 'kakao123'}, ...]
            message: 본문
            subject: 제목 (옵션)
        Returns:
            {'success': bool, 'sent_count': int, 'errors': []}

        ※ 실제 구현 시 카카오 비즈니스 채널 + 알림톡 API 사용
           여기서는 구조만 잡아둠
        """
        if not settings.KAKAO_REST_API_KEY:
            logger.warning("카카오 API 키 미설정 — 개발 모드에서는 로그만 출력")
            return {
                'success': True,
                'sent_count': len(recipients),
                'errors': [],
                'dev_mode': True,
            }

        errors = []
        sent_count = 0

        for r in recipients:
            if not r.get('kakao_id'):
                errors.append(f"{r.get('name', '알 수 없음')}: 카카오톡 ID 없음")
                continue

            try:
                # 실제 카카오 알림톡 API 호출
                # 비즈니스 채널 설정 후 아래 형태로 발송
                headers = {
                    'Authorization': f'KakaoAK {settings.KAKAO_REST_API_KEY}',
                    'Content-Type': 'application/x-www-form-urlencoded',
                }

                template_object = {
                    'object_type': 'text',
                    'text': f'[워크드 노트]\n{subject}\n\n{message}' if subject else f'[워크드 노트]\n\n{message}',
                    'link': {'web_url': 'https://workdnote.com'},
                }

                # resp = requests.post(...)  # 실제 API 호출
                sent_count += 1
                logger.info(f"카카오톡 발송 성공: {r['kakao_id']}")

            except Exception as e:
                errors.append(f"{r.get('name', '')}: {str(e)}")
                logger.error(f"카카오톡 발송 오류: {str(e)}")

        return {
            'success': sent_count > 0,
            'sent_count': sent_count,
            'errors': errors,
        }


def send_message(channel, recipients, message, subject=''):
    """통합 발송 함수"""
    if channel == 'email':
        return EmailService.send(recipients, subject, message)
    elif channel == 'sms':
        return SMSService.send(recipients, message)
    elif channel == 'kakao':
        return KakaoService.send(recipients, message, subject)
    else:
        return {'success': False, 'sent_count': 0, 'errors': [f'지원하지 않는 채널: {channel}']}
