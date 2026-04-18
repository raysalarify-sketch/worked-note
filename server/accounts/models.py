from django.db import models
from django.contrib.auth.models import User


class Profile(models.Model):
    """유저 추가 정보"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone = models.CharField(max_length=20, blank=True, verbose_name='전화번호')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '프로필'
        verbose_name_plural = '프로필'

    def __str__(self):
        return f'{self.user.username} 프로필'
