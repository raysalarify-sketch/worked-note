from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from .models import Memo, Contact
from .serializers import MemoSerializer, MemoListSerializer, ContactSerializer


class MemoViewSet(viewsets.ModelViewSet):
    """
    메모 CRUD + 검색 + AI 분석
    
    GET    /api/memos/          → 목록
    POST   /api/memos/          → 생성
    GET    /api/memos/{id}/     → 상세
    PUT    /api/memos/{id}/     → 수정
    DELETE /api/memos/{id}/     → 삭제
    GET    /api/memos/search/?q=키워드  → AI 검색
    GET    /api/memos/stats/    → 통계
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return MemoListSerializer
        return MemoSerializer

    def get_queryset(self):
        return Memo.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def search(self, request):
        """AI 검색 — 제목 + 본문 통합 검색"""
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response([])

        # 키워드 분리 후 OR 검색
        keywords = query.split()
        q_filter = Q()
        for kw in keywords:
            q_filter |= Q(title__icontains=kw) | Q(content__icontains=kw)

        memos = self.get_queryset().filter(q_filter).distinct()
        serializer = MemoListSerializer(memos, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """메모 통계"""
        from django.utils import timezone
        today = timezone.now().date()
        qs = self.get_queryset()
        return Response({
            'total': qs.count(),
            'today': qs.filter(created_at__date=today).count(),
            'pinned': qs.filter(pinned=True).count(),
            'by_color': {
                str(i): qs.filter(color=i).count()
                for i in range(5)
            }
        })

    @action(detail=True, methods=['post'])
    def toggle_share(self, request, pk=None):
        memo = self.get_object()
        memo.is_shared = not memo.is_shared
        memo.save()
        return Response({'is_shared': memo.is_shared, 'share_token': memo.share_token})


class ContactViewSet(viewsets.ModelViewSet):
    """
    연락처 CRUD
    
    GET    /api/contacts/              → 목록
    POST   /api/contacts/              → 생성
    PUT    /api/contacts/{id}/         → 수정
    DELETE /api/contacts/{id}/         → 삭제
    GET    /api/contacts/by_group/     → 그룹별 조회
    """
    serializer_class = ContactSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Contact.objects.filter(user=self.request.user)
        # 검색
        search = self.request.query_params.get('search', '')
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search)
            )
        # 그룹 필터
        group = self.request.query_params.get('group', '')
        if group:
            qs = qs.filter(group=group)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def by_group(self, request):
        """그룹별 연락처"""
        groups = {}
        for contact in self.get_queryset():
            if contact.group not in groups:
                groups[contact.group] = []
            groups[contact.group].append(ContactSerializer(contact).data)
        return Response(groups)


from rest_framework.views import APIView
class SharedMemoView(APIView):
    """외부 공유용 메모 조회 (로그인 불필요)"""
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        try:
            memo = Memo.objects.get(share_token=token, is_shared=True)
            return Response({
                'title': memo.title,
                'content': memo.content,
                'color': memo.color,
                'updated_at': memo.updated_at,
                'user_name': memo.user.first_name
            })
        except Memo.DoesNotExist:
            return Response({'error': 'Memo not found or not shared'}, status=status.HTTP_404_NOT_FOUND)
