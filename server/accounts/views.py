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
        from django.core.mail import send_mail

        try:
            user = User.objects.get(email=email)
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            
            # 실제 서비스라면 프론트엔드 링크를 보냄
            domain = request.build_absolute_uri('/')[:-1]
            if "localhost" not in domain and "127.0.0.1" not in domain:
                domain = "https://worked-note.onrender.com" # 고정 도메인 사용 (Render)
            
            reset_link = f"{domain}/reset-password/{uid}/{token}/"
            
            send_mail(
                '워크드 노트 비밀번호 초기화',
                f'비밀번호를 초기화하려면 아래 링크를 클릭하세요:\n\n{reset_link}',
                'noreply@workdnote.com',
                [email],
                fail_silently=False,
            )
            return Response({'message': '이메일이 발송되었습니다. 터미널(콘솔)을 확인해주세요.'}, status=status.HTTP_200_OK)
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
