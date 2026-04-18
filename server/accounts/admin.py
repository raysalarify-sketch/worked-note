from django.contrib import admin
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import Profile

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'phone', 'created_at']

# User 모델 어드민 커스텀
admin.site.unregister(User)

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    actions = ['reset_password_to_default']

    @admin.action(description='선택한 유저의 비밀번호를 1234로 초기화')
    def reset_password_to_default(self, request, queryset):
        for user in queryset:
            user.set_password('1234')
            user.save()
        self.message_user(request, f"{queryset.count()}명의 비밀번호가 '1234'로 초기화되었습니다.")
