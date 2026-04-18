from django.db import models
from django.contrib.auth.models import User
from memos.models import Memo, Contact


class SendLog(models.Model):
    """발송 기록"""
    CHANNEL_CHOICES = [
        ('email', '이메일'),
        ('sms', '문자'),
        ('kakao', '카카오톡'),
    ]
    STATUS_CHOICES = [
        ('pending', '대기'),
        ('sent', '발송완료'),
        ('failed', '실패'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='send_logs')
    memo = models.ForeignKey(Memo, on_delete=models.SET_NULL, null=True, blank=True, related_name='send_logs')
    channel = models.CharField(max_length=10, choices=CHANNEL_CHOICES, verbose_name='채널')
    subject = models.CharField(max_length=200, blank=True, default='', verbose_name='제목')
    message = models.TextField(verbose_name='메시지')
    recipients = models.ManyToManyField(Contact, related_name='received_messages', verbose_name='수신자')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending', verbose_name='상태')
    error_message = models.TextField(blank=True, default='', verbose_name='에러 메시지')
    sent_at = models.DateTimeField(auto_now_add=True, verbose_name='발송일')

    class Meta:
        ordering = ['-sent_at']
        verbose_name = '발송 기록'
        verbose_name_plural = '발송 기록'

    def __str__(self):
        return f'[{self.get_channel_display()}] {self.subject or self.message[:30]} ({self.get_status_display()})'
