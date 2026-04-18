from django.contrib import admin
from .models import Memo, Contact


@admin.register(Memo)
class MemoAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'color', 'pinned', 'created_at', 'updated_at']
    list_filter = ['color', 'pinned', 'created_at']
    search_fields = ['title', 'content']
    list_editable = ['pinned', 'color']


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ['name', 'user', 'email', 'phone', 'kakao_id', 'group']
    list_filter = ['group']
    search_fields = ['name', 'email', 'phone']
