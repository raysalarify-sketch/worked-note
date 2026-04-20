from django.contrib import admin
from .models import Memo, Contact, RoutineAlert, ExtractedInfo, DailyCheck


@admin.register(Memo)
class MemoAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'color', 'pinned', 'created_at', 'updated_at']
    list_filter = ['pinned', 'created_at']
    search_fields = ['title', 'content']
    list_editable = ['pinned', 'color']


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ['name', 'user', 'email', 'phone', 'group']
    list_filter = ['group']
    search_fields = ['name', 'email', 'phone']


@admin.register(RoutineAlert)
class RoutineAlertAdmin(admin.ModelAdmin):
    list_display = ['task', 'time', 'user', 'is_active', 'created_at']
    list_filter = ['is_active', 'time']


@admin.register(ExtractedInfo)
class ExtractedInfoAdmin(admin.ModelAdmin):
    list_display = ['info_type', 'user', 'memo', 'created_at']
    list_filter = ['info_type']


@admin.register(DailyCheck)
class DailyCheckAdmin(admin.ModelAdmin):
    list_display = ['routine', 'user', 'checked_at']
