from rest_framework import status, permissions, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import SendLog
from .serializers import SendRequestSerializer, SendLogSerializer
from .services import send_message
from memos.models import Memo, Contact


class SendMessageView(APIView):
    """
    POST /api/messaging/send/
    
    메모를 이메일/문자/카카오톡으로 발송
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = SendRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # 수신자 조회
        contacts = Contact.objects.filter(
            user=request.user,
            id__in=data['recipient_ids']
        )
        if not contacts.exists():
            return Response(
                {'error': '유효한 수신자가 없습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 채널별 연락처 정보 확인
        channel = data['channel']
        recipients = []
        for c in contacts:
            r = {'name': c.name, 'email': c.email, 'phone': c.phone, 'kakao_id': c.kakao_id}
            if channel == 'email' and not c.email:
                continue
            elif channel == 'sms' and not c.phone:
                continue
            elif channel == 'kakao' and not c.kakao_id:
                continue
            recipients.append(r)

        if not recipients:
            channel_names = {'email': '이메일', 'sms': '전화번호', 'kakao': '카카오톡 ID'}
            return Response(
                {'error': f'선택한 수신자 중 {channel_names[channel]} 정보가 있는 사람이 없습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 메모 연결 (선택)
        memo = None
        if data.get('memo_id'):
            memo = Memo.objects.filter(user=request.user, id=data['memo_id']).first()

        # 발송
        result = send_message(
            channel=channel,
            recipients=recipients,
            message=data['message'],
            subject=data.get('subject', ''),
        )

        # 발송 기록 저장
        log = SendLog.objects.create(
            user=request.user,
            memo=memo,
            channel=channel,
            subject=data.get('subject', ''),
            message=data['message'],
            status='sent' if result['success'] else 'failed',
            error_message='\n'.join(result.get('errors', [])),
        )
        log.recipients.set(contacts)

        return Response({
            'success': result['success'],
            'sent_count': result['sent_count'],
            'total_recipients': len(recipients),
            'errors': result.get('errors', []),
            'log_id': log.id,
        }, status=status.HTTP_200_OK if result['success'] else status.HTTP_207_MULTI_STATUS)


class SendLogListView(generics.ListAPIView):
    """
    GET /api/messaging/history/
    
    발송 내역 조회
    """
    serializer_class = SendLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = SendLog.objects.filter(user=self.request.user)
        # 채널 필터
        channel = self.request.query_params.get('channel')
        if channel:
            qs = qs.filter(channel=channel)
        return qs


class SendLogDetailView(generics.RetrieveAPIView):
    """
    GET /api/messaging/history/{id}/
    
    발송 상세 조회
    """
    serializer_class = SendLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SendLog.objects.filter(user=self.request.user)
