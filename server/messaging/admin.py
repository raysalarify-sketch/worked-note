from django.contrib import admin
from .models import SendLog


@admin.register(SendLog)
class SendLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'channel', 'subject', 'status', 'sent_at']
    list_filter = ['channel', 'status', 'sent_at']
    search_fields = ['subject', 'message']
    filter_horizontal = ['recipients']
    readonly_fields = ['sent_at']
