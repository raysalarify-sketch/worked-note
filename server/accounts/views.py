from django.contrib.auth import authenticate
from django.db.models import Q
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import SignupSerializer, UserSerializer, ChangePasswordSerializer


class SignupView(APIView):
    """회원가입"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """로그인 (JWT 발급)"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get('username', '').lower().strip()
        password = request.data.get('password')
        
        user = authenticate(username=username, password=password)
        if user:
            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': UserSerializer(user).data
            })
        return Response({'message': '이메일 또는 비밀번호가 올바르지 않습니다.'}, status=status.HTTP_401_UNAUTHORIZED)


class LogoutView(APIView):
    """로그아웃 (토큰 무효화)"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception:
            return Response(status=status.HTTP_400_BAD_REQUEST)


class UserInfoView(APIView):
    """내 정보 조회"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    """비밀번호 변경"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            if not user.check_password(serializer.validated_data['old_password']):
                return Response({'old_password': '현재 비밀번호가 틀립니다.'}, status=status.HTTP_400_BAD_REQUEST)
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            return Response({'message': '비밀번호가 변경되었습니다.'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetRequestView(APIView):
    """비밀번호 초기화 요청 (이메일 발송)"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '')
        from django.contrib.auth.models import User
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes
        from django.db.models import Q

        # 입력값 정규화
        email_clean = email.lower().strip()

        try:
            # 1차 검색: 정확한 이메일 매칭 (대소문자 무시)
            user = User.objects.filter(email__iexact=email_clean).first()
            
            # 2차 검색: 사용자명(Username)이 이메일 형식으로 저장된 경우 대응
            if not user:
                user = User.objects.filter(username__iexact=email_clean).first()
                
            # 3차 검색: 혹시 모를 필드 불일치 대응 (이메일 필드에 사용자명이 있는 등)
            if not user:
                user = User.objects.filter(Q(email__icontains=email_clean) | Q(username__icontains=email_clean)).first()

            if not user:
                return Response({'message': f'계정({email_clean})을 찾을 수 없습니다. 다시 시도해 주세요.'}, status=status.HTTP_404_NOT_FOUND)
            
            try:
                token = default_token_generator.make_token(user)
                uid = urlsafe_base64_encode(force_bytes(user.pk))
            except Exception as e:
                return Response({'message': f'토큰 생성 실패: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            return Response({
                'message': '인증 메일 형식이 생성되었습니다. (데모 사이트의 경우 화면에 표시됩니다)',
                'uid': uid,
                'token': token
            })
        except Exception as e:
            return Response({'message': f'처리 중 오류: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DebugLookupView(APIView):
    """라이브 서버 DB 직접 조회 (진단용 - 최종 버전)"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from django.contrib.auth.models import User
        from django.db.models import Q
        q = request.GET.get('q', '')
        u = User.objects.filter(Q(username__icontains=q) | Q(email__icontains=q)).first()
        if u:
            return Response({
                'exists': True,
                'username': u.username,
                'email': u.email,
                'is_active': u.is_active,
                'id': u.id
            })
        return Response({'exists': False, 'total_count': User.objects.count()})


class PasswordResetConfirmView(APIView):
    """비밀번호 재설정 확인"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from django.contrib.auth.models import User
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_decode
        
        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('new_password')
        
        try:
            uid = urlsafe_base64_decode(uidb64).decode()
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({'message': '유효하지 않은 링크입니다.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if default_token_generator.check_token(user, token):
            user.set_password(new_password)
            user.save()
            return Response({'message': '비밀번호가 성공적으로 재설정되었습니다.'})
        return Response({'message': '유효하지 않거나 만료된 토큰입니다.'}, status=status.HTTP_400_BAD_REQUEST)
