from django.db import models
from django.contrib.auth.models import User


class Memo(models.Model):
    """메모"""
    COLOR_CHOICES = [
        (0, '기본'), (1, '업무'), (2, '개인'), (3, '중요'), (4, '아이디어'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='memos')
    title = models.CharField(max_length=200, blank=True, default='', verbose_name='제목')
    content = models.TextField(blank=True, default='', verbose_name='내용')
    color = models.IntegerField(choices=COLOR_CHOICES, default=0, verbose_name='카테고리')
    pinned = models.BooleanField(default=False, verbose_name='고정')
    is_shared = models.BooleanField(default=False, verbose_name='공유 여부')
    share_token = models.CharField(max_length=50, blank=True, unique=True, null=True, verbose_name='공유 토큰')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성일')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정일')

    class Meta:
        ordering = ['-pinned', '-updated_at']
        verbose_name = '메모'
        verbose_name_plural = '메모'

    def save(self, *args, **kwargs):
        if not self.share_token:
            import uuid
            self.share_token = str(uuid.uuid4())[:12]
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title or '제목 없음'


class Reminder(models.Model):
    """일정 알림 주기적 발송"""
    memo = models.ForeignKey(Memo, on_delete=models.CASCADE, related_name='reminders')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    remind_at = models.DateTimeField(verbose_name='알림 일시')
    channel = models.CharField(max_length=20, default='email', verbose_name='알림 채널') # sms, email, kakao
    is_recurring = models.BooleanField(default=False, verbose_name='반복 여부')
    is_sent = models.BooleanField(default=False, verbose_name='발송 여부')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '알림 예약'
        verbose_name_plural = '알림 예약'


class Contact(models.Model):
    """연락처"""
    GROUP_CHOICES = [
        ('일반', '일반'), ('팀원', '팀원'), ('거래처', '거래처'),
        ('외부', '외부'), ('VIP', 'VIP'), ('회사', '회사'), ('개인', '개인'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='contacts')
    name = models.CharField(max_length=50, verbose_name='이름')
    email = models.EmailField(blank=True, default='', verbose_name='이메일')
    phone = models.CharField(max_length=20, blank=True, default='', verbose_name='전화번호')
    kakao_id = models.CharField(max_length=50, blank=True, default='', verbose_name='카카오톡 ID')
    group = models.CharField(max_length=20, choices=GROUP_CHOICES, default='일반', verbose_name='그룹')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = '연락처'
        verbose_name_plural = '연락처'

    def __str__(self):
        return f'{self.name} ({self.group})'
