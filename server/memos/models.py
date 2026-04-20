from django.db import models
from django.contrib.auth.models import User
import uuid


class Memo(models.Model):
    """AI 스마트 메모"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='memos')
    title = models.CharField(max_length=200, blank=True, default='')
    content = models.TextField(blank=True, default='')
    categories = models.JSONField(default=list)  # 예: ["routine", "health", "finance"]
    color = models.IntegerField(default=0)  # 태그별 대표 색상
    pinned = models.BooleanField(default=False)
    share_slug = models.UUIDField(default=uuid.uuid4, unique=False, null=True, blank=True) # 공유용 고유 아이디
    is_public = models.BooleanField(default=False) # 공개 여부
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-pinned', '-updated_at']

    def __str__(self):
        return self.title or '제목 없음'


class MemoComment(models.Model):
    """메모 댓글"""
    memo = models.ForeignKey(Memo, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True) # Null이면 익명
    author_name = models.CharField(max_length=50, default='익명') # 가입 안한 사람용
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)


class Collaborator(models.Model):
    """특정 대상 수정 권한"""
    memo = models.ForeignKey(Memo, on_delete=models.CASCADE, related_name='collaborators')
    email = models.EmailField()
    can_edit = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


class RoutineAlert(models.Model):
    """메모에서 자동 추출된 반복 루틴"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='routines')
    memo = models.ForeignKey(Memo, on_delete=models.CASCADE, related_name='routines')
    task = models.CharField(max_length=100)   # 예: "비타민 먹기"
    time = models.CharField(max_length=10)    # 예: "08:00"
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.time} - {self.task}"


class ExtractedInfo(models.Model):
    """메모에서 추출된 정형 정보 (일정, 연락처, 재정)"""
    TYPE_CHOICES = [
        ('schedule', '일정'),
        ('person', '연락처'),
        ('finance', '재정'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    memo = models.ForeignKey(Memo, on_delete=models.CASCADE, related_name='extracted_infos')
    info_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    data = models.JSONField()  # 예: {"date": "4/21", "task": "디자인 리뷰"}
    created_at = models.DateTimeField(auto_now_add=True)


class DailyCheck(models.Model):
    """당일 루틴 체크 기록"""
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    routine = models.ForeignKey(RoutineAlert, on_delete=models.CASCADE)
    checked_at = models.DateField(auto_now_add=True)

    class Meta:
        unique_together = ('routine', 'checked_at')


class Contact(models.Model):
    """주소록 (수동 관리 및 추출 연동)"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='contacts')
    name = models.CharField(max_length=50)
    email = models.EmailField(blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')
    group = models.CharField(max_length=20, default='일반')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
