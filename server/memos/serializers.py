from rest_framework import serializers
from .models import Memo, Contact, RoutineAlert, ExtractedInfo, DailyCheck, MemoComment, Collaborator


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


class MemoCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(read_only=True)
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = MemoComment
        fields = ['id', 'author_name', 'content', 'created_at', 'is_owner']

    def get_is_owner(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.user == request.user
        return False


class CollaboratorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Collaborator
        fields = ['id', 'email', 'can_edit']


class MemoSerializer(serializers.ModelSerializer):
    extracted_infos = ExtractedInfoSerializer(many=True, read_only=True)
    routines = RoutineAlertSerializer(many=True, read_only=True)
    comments = MemoCommentSerializer(many=True, read_only=True)
    collaborators = CollaboratorSerializer(many=True, read_only=True)
    is_locked = serializers.SerializerMethodField()

    class Meta:
        model = Memo
        fields = [
            'id', 'title', 'content', 'categories', 'color', 'pinned', 
            'share_slug', 'is_public', 'password', 'is_locked', 'extracted_infos', 'routines', 
            'comments', 'collaborators', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'share_slug', 'created_at', 'updated_at']
        extra_kwargs = {'password': {'write_only': True}}

    def get_is_locked(self, obj):
        return bool(obj.password)


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
