from rest_framework import serializers
from .models import Memo, Contact


class MemoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Memo
        fields = ['id', 'title', 'content', 'color', 'pinned', 'is_shared', 'share_token', 'created_at', 'updated_at']
        read_only_fields = ['id', 'share_token', 'created_at', 'updated_at']


class MemoListSerializer(serializers.ModelSerializer):
    """목록용 (본문 미리보기만)"""
    preview = serializers.SerializerMethodField()

    class Meta:
        model = Memo
        fields = ['id', 'title', 'preview', 'color', 'pinned', 'created_at', 'updated_at']

    def get_preview(self, obj):
        return obj.content[:80] if obj.content else ''


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ['id', 'name', 'email', 'phone', 'kakao_id', 'group', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
