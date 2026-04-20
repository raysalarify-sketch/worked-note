from rest_framework import serializers
from .models import Memo, Contact, RoutineAlert, ExtractedInfo, DailyCheck


class ExtractedInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExtractedInfo
        fields = ['id', 'info_type', 'data', 'created_at']


class RoutineAlertSerializer(serializers.ModelSerializer):
    is_checked = serializers.SerializerMethodField()

    class Meta:
        model = RoutineAlert
        fields = ['id', 'task', 'time', 'is_active', 'is_checked']

    def get_is_checked(self, obj):
        from django.utils import timezone
        return DailyCheck.objects.filter(routine=obj, checked_at=timezone.now().date()).exists()


class MemoSerializer(serializers.ModelSerializer):
    extracted_infos = ExtractedInfoSerializer(many=True, read_only=True)
    routines = RoutineAlertSerializer(many=True, read_only=True)

    class Meta:
        model = Memo
        fields = ['id', 'title', 'content', 'categories', 'color', 'pinned', 'extracted_infos', 'routines', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class MemoListSerializer(serializers.ModelSerializer):
    preview = serializers.SerializerMethodField()

    class Meta:
        model = Memo
        fields = ['id', 'title', 'preview', 'categories', 'color', 'pinned', 'updated_at']

    def get_preview(self, obj):
        return obj.content[:80] if obj.content else ''


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ['id', 'name', 'email', 'phone', 'group', 'created_at']
        read_only_fields = ['id', 'created_at']


class DailyCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyCheck
        fields = ['id', 'routine', 'checked_at']
