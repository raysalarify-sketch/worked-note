from django.conf import settings
from django.core.mail import send_mail
from rest_framework import status, generics, permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .serializers import SignupSerializer, UserSerializer


class CustomTokenSerializer(TokenObtainPairSerializer):
    """로그인 시 유저 정보도 함께 반환"""
    email = serializers.CharField(required=False)

    def validate(self, attrs):
        # attrs에 email만 올 경우 username으로 복사 (SimpleJWT 호환성)
        from django.contrib.auth.models import User
        email = attrs.get('email')
        password = attrs.get('password')

        if email and not attrs.get('username'):
            try:
                user_obj = User.objects.get(email=email)
                attrs['username'] = user_obj.username
            except User.DoesNotExist:
                attrs['username'] = email # 가입 시 email을 username으로 썼을 수 있음

        # 부모 클래스의 validate 호출 (여기서 실제 인증 수행)
        try:
            data = super().validate(attrs)
        except Exception:
            raise serializers.ValidationError('이메일 또는 비밀번호가 올바르지 않습니다.')

        data['user'] = UserSerializer(self.user).data
        return data


class LoginView(TokenObtainPairView):
    """로그인 → JWT 토큰 + 유저 정보 반환"""
    serializer_class = CustomTokenSerializer
    permission_classes = [permissions.AllowAny]


class SignupView(generics.CreateAPIView):
    """회원가입"""
    serializer_class = SignupSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # 가입 즉시 토큰 발급
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }, status=status.HTTP_201_CREATED)


class LogoutView(APIView):
    """로그아웃 → Refresh 토큰 블랙리스트"""
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response({'message': '로그아웃 완료'}, status=status.HTTP_200_OK)
        except Exception:
            return Response({'message': '로그아웃 완료'}, status=status.HTTP_200_OK)


class MeView(generics.RetrieveAPIView):
    """현재 로그인 유저 정보"""
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class PasswordChangeView(generics.UpdateAPIView):
    """로그인한 유저의 비밀번호 변경"""
    serializer_class = SignupSerializer # Dummy

    def update(self, request, *args, **kwargs):
        from .serializers import ChangePasswordSerializer
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.check_password(serializer.validated_data.get('old_password')):
            return Response({'old_password': ['기존 비밀번호가 틀렸습니다.']}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(serializer.validated_data.get('new_password'))
        user.save()
        return Response({'message': '비밀번호가 성공적으로 변경되었습니다.'}, status=status.HTTP_200_OK)


class PasswordResetRequestView(APIView):
    """비밀번호 초기화 요청 (이메일 발송)"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        from django.contrib.auth.models import User
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes

        try:
            user = User.objects.get(email=email)
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            
            # 실제 서비스라면 프론트엔드 링크를 보냄
            domain = request.build_absolute_uri('/')[:-1]
            if "localhost" not in domain and "127.0.0.1" not in domain:
                domain = "https://worked-note.onrender.com" # 고정 도메인 사용 (Render)
            
            reset_link = f"{domain}/reset-password/{uid}/{token}/"
            
            # 프리미엄 반응형 HTML 메타데이터 및 템플릿
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>비밀번호 재설정</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
                    <tr>
                        <td align="center" style="padding: 40px 10px;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.05);">
                                <!-- Top Accent -->
                                <tr>
                                    <td style="background: linear-gradient(135deg, #4f46e5 0%, #0ea5e9 100%); padding: 40px 20px; text-align: center;">
                                        <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 18px; margin: 0 auto 16px; display: inline-flex; align-items: center; justify-content: center;">
                                            <span style="font-size: 32px;">🔒</span>
                                        </div>
                                        <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -1px;">Password Reset</h1>
                                    </td>
                                </tr>
                                <!-- Main Content -->
                                <tr>
                                    <td style="padding: 40px 32px; text-align: center;">
                                        <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 12px 0;">계정 보안 확인</h2>
                                        <p style="font-size: 15px; color: #4b5563; line-height: 1.7; margin: 0 0 32px 0;">
                                            비밀번호 재설정 요청을 받았습니다.<br>아래 버튼을 눌러 새로운 비밀번호를 설정하시면 즉시 로그인이 가능합니다.
                                        </p>
                                        <a href="{reset_link}" style="display: block; background-color: #4f46e5; color: #ffffff; padding: 18px; border-radius: 12px; text-decoration: none; font-size: 16px; font-weight: 700; box-shadow: 0 8px 20px rgba(79, 70, 229, 0.25);">새 비밀번호 설정하기</a>
                                        <p style="font-size: 13px; color: #9ca3af; margin: 24px 0 0 0;">
                                            보안을 위해 본인 외에는 이 링크를 공유하지 마세요.
                                        </p>
                                    </td>
                                </tr>
                                <!-- Footer -->
                                <tr>
                                    <td style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #f3f4f6;">
                                        <p style="font-size: 12px; color: #9ca3af; margin: 0; line-height: 1.6;">
                                            문의사항이 있으시면 고객 지원팀으로 연락주세요.<br>
                                            &copy; 2026 Smart Note Team. All rights reserved.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            """
            
            try:
                send_mail(
                    '[Smart Note] 보안 인증 완료를 위한 확인 링크입니다.',
                    f'비밀번호를 초기화하려면 아래 링크를 클릭하세요:\n\n{reset_link}',
                    settings.DEFAULT_FROM_EMAIL,
                    [email],
                    fail_silently=False,
                    html_message=html_content
                )
                print(f"DEBUG: Ultra premium responsive HTML Email sent to {email}")
            except Exception as e:
                print(f"CRITICAL ERROR: Failed to send email to {email}. Error: {str(e)}")
                return Response({'message': '이메일 발송 중 서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            return Response({'message': '이메일이 발송되었습니다. 가입하신 이메일의 편함함을 확인해주세요.'}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({'message': '해당 이메일로 가입된 사용자가 없습니다.'}, status=status.HTTP_404_NOT_FOUND)


class PasswordResetConfirmView(APIView):
    """비밀번호 초기화 완료"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('new_password')
        
        from django.contrib.auth.models import User
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_decode

        try:
            uid = urlsafe_base64_decode(uidb64).decode()
            user = User.objects.get(pk=uid)
            
            if default_token_generator.check_token(user, token):
                user.set_password(new_password)
                user.save()
                return Response({'message': '비밀번호가 성공적으로 초기화되었습니다.'}, status=status.HTTP_200_OK)
            else:
                return Response({'message': '유효하지 않거나 만료된 토큰입니다.'}, status=status.HTTP_400_BAD_REQUEST)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({'message': '잘못된 요청입니다.'}, status=status.HTTP_400_BAD_REQUEST)
