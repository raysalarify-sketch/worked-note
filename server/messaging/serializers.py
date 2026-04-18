from rest_framework import serializers
from .models import SendLog
from memos.serializers import ContactSerializer


class SendRequestSerializer(serializers.Serializer):
    """발송 요청"""
    channel = serializers.ChoiceField(choices=['email', 'sms', 'kakao'])
    subject = serializers.CharField(required=False, default='', allow_blank=True)
    message = serializers.CharField()
    recipient_ids = serializers.ListField(child=serializers.IntegerField(), min_length=1)
    memo_id = serializers.IntegerField(required=False, allow_null=True)


class SendLogSerializer(serializers.ModelSerializer):
    """발송 기록 조회"""
    recipients = ContactSerializer(many=True, read_only=True)
    channel_display = serializers.CharField(source='get_channel_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    memo_title = serializers.SerializerMethodField()

    class Meta:
        model = SendLog
        fields = [
            'id', 'channel', 'channel_display', 'subject', 'message',
            'recipients', 'status', 'status_display', 'memo_title',
            'error_message', 'sent_at',
        ]

    def get_memo_title(self, obj):
        return obj.memo.title if obj.memo else None
