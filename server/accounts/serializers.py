from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.db.models import Q


class SignupSerializer(serializers.ModelSerializer):
    """회원가입"""
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    name = serializers.CharField(source='first_name')

    class Meta:
        model = User
        fields = ['email', 'name', 'password', 'password_confirm']

    def validate_email(self, value):
        # 소문자로 변환하여 중복 체크
        email_clean = value.lower().strip()
        if User.objects.filter(Q(email__iexact=email_clean) | Q(username__iexact=email_clean)).exists():
            raise serializers.ValidationError('이미 가입된 이메일입니다.')
        return email_clean

    def validate(self, data):
        if data['password'] != data.pop('password_confirm'):
            raise serializers.ValidationError({'password_confirm': '비밀번호가 일치하지 않습니다.'})
        return data

    def create(self, validated_data):
        email = validated_data['email'].lower().strip()
        user = User.objects.create_user(
            username=email,
            email=email,
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    """유저 정보 조회"""
    name = serializers.CharField(source='first_name')

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'date_joined']
        read_only_fields = fields


class ChangePasswordSerializer(serializers.Serializer):
    """비밀번호 변경"""
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True)

    def validate(self, data):
        if data['new_password'] != data['new_password_confirm']:
            raise serializers.ValidationError({"new_password_confirm": "새 비밀번호가 일치하지 않습니다."})
        return data
