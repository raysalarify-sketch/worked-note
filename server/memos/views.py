import re
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q
from django.utils import timezone
from .models import Memo, Contact, RoutineAlert, ExtractedInfo, DailyCheck
from .serializers import (
    MemoSerializer, MemoListSerializer, ContactSerializer, 
    RoutineAlertSerializer, ExtractedInfoSerializer
)

class AIAnalyzer:
    """메모 본문을 분석하여 카테고리 분류 및 정보 추출을 수행하는 엔진"""
    
    CATEGORIES = {
        'routine': ['매일', '매주', '아침마다', '저녁마다', '루틴', '습관', '반복'],
        'health': ['약', '병원', '진료', '운동', '비타민', '영양제', '혈압', '체중'],
        'schedule': ['회의', '미팅', '약속', '마감', '발표', '면접', '시', '분'],
        'person': ['님', '씨', '팀장', '대표', '전화', '이메일'],
        'finance': ['원', '만원', '결제', '입금', '급여', '보험', '카드', '이체'],
        'work': ['프로젝트', '업무', '보고', '개발', '배포', 'API', '이슈'],
    }

    @staticmethod
    def classify(content):
        tags = []
        for cat, keywords in AIAnalyzer.CATEGORIES.items():
            if any(kw in content for kw in keywords):
                tags.append(cat)
        return tags if tags else ['idea']

    @staticmethod
    def extract_all(user, memo):
        content = memo.content
        # 1. 루틴 추출
        routine_patterns = [
            (r'매일 아침\s+(.+)', '08:00'),
            (r'매일 저녁\s+(.+)', '20:00'),
            (r'점심 후\s+(.+)', '13:00'),
            (r'자기 전\s+(.+)', '22:00'),
            (r'(\d{1,2})시\s+(.+)', None), # 시간 직접 언급
        ]
        RoutineAlert.objects.filter(memo=memo).delete()
        for pattern, default_time in routine_patterns:
            matches = re.finditer(pattern, content)
            for m in matches:
                task = m.group(1 if default_time else 2)
                time = default_time or f"{m.group(1).zfill(2)}:00"
                RoutineAlert.objects.create(user=user, memo=memo, task=task.strip(), time=time)

        # 2. 일정 추출 (간단)
        ExtractedInfo.objects.filter(memo=memo).delete()
        date_pattern = r'(\d{1,2}/\d{1,2})\s+(.+)'
        for m in re.finditer(date_pattern, content):
            ExtractedInfo.objects.create(
                user=user, memo=memo, info_type='schedule',
                data={'date': m.group(1), 'task': m.group(2).strip()}
            )

        # 3. 연락처 추출
        phone_pattern = r'([가-힣]{2,4})\s+(010-\d{4}-\d{4})'
        for m in re.finditer(phone_pattern, content):
            ExtractedInfo.objects.create(
                user=user, memo=memo, info_type='person',
                data={'name': m.group(1), 'phone': m.group(2)}
            )

        # 4. 재정 추출
        money_pattern = r'(.+)\s+(\d+)(?:만원|원)'
        for m in re.finditer(money_pattern, content):
            ExtractedInfo.objects.create(
                user=user, memo=memo, info_type='finance',
                data={'item': m.group(1).strip(), 'amount': m.group(2)}
            )


class MemoViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return MemoListSerializer
        return MemoSerializer

    def get_queryset(self):
        # 내가 주인이거나, 협업자로 등록된 메모 조회
        return Memo.objects.filter(
            Q(user=self.request.user) | Q(collaborators__email=self.request.user.email)
        ).distinct()

    def perform_create(self, serializer):
        memo = serializer.save(user=self.request.user)
        self._analyze(memo)

    def perform_update(self, serializer):
        memo = serializer.save()
        self._analyze(memo)

    def _analyze(self, memo):
        memo.categories = AIAnalyzer.classify(memo.content)
        memo.save()
        AIAnalyzer.extract_all(memo.user, memo)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        password = request.query_params.get('password')
        
        # 비밀번호가 걸려있는데 맞지 않는 경우 (심지어 주인이라도 본문을 가림)
        if instance.password and password != instance.password:
            data = self.get_serializer(instance).data
            data['content'] = "🔒 이 메모는 비밀번호로 잠겨 있습니다."
            data['extracted_infos'] = []
            data['routines'] = []
            data['is_locked'] = True
            return Response(data)
        return super().retrieve(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def toggle_lock(self, request, pk=None):
        memo = self.get_object()
        if memo.user != request.user:
            return Response({'error': '권한이 없습니다.'}, status=403)
        password = request.data.get('password')
        memo.password = password if password else None # 비밀번호가 없으면 해제
        memo.save()
        return Response({'is_locked': bool(memo.password)})

    @action(detail=True, methods=['post'])
    def toggle_public(self, request, pk=None):
        memo = self.get_object()
        if memo.user != request.user:
            return Response({'error': '권한이 없습니다.'}, status=status.HTTP_403_FORBIDDEN)
        memo.is_public = not memo.is_public
        memo.save()
        return Response({'is_public': memo.is_public, 'share_slug': memo.share_slug})

    @action(detail=True, methods=['post'])
    def add_comment(self, request, pk=None):
        memo = self.get_object() # 여기서 get_object는 queryset에 기반함 (주인이거나 협업자)
        content = request.data.get('content')
        if not content: return Response({'error': '내용을 입력하세요.'}, status=400)
        
        from .models import MemoComment
        name = request.user.first_name or request.user.username
        comment = MemoComment.objects.create(
            memo=memo, user=request.user, 
            author_name=name, content=content
        )
        return Response(MemoCommentSerializer(comment, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def add_collaborator(self, request, pk=None):
        memo = self.get_object()
        if memo.user != request.user:
            return Response({'error': '주인만 초대할 수 있습니다.'}, status=403)
        email = request.data.get('email')
        if not email: return Response({'error': '이메일을 입력하세요.'}, status=400)
        
        from .models import Collaborator
        collab, created = Collaborator.objects.get_or_create(memo=memo, email=email)
        return Response(CollaboratorSerializer(collab).data)

    @action(detail=False, methods=['get'])
    def search(self, request):
        query = request.query_params.get('q', '').strip()
        if not query: return Response([])
        qs = self.get_queryset().filter(Q(title__icontains=query) | Q(content__icontains=query))
        return Response(MemoListSerializer(qs, many=True).data)


class SharedMemoView(APIView):
    """퍼블릭 공유 페이지 전용 뷰"""
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        try:
            memo = Memo.objects.get(share_slug=slug, is_public=True)
            password = request.query_params.get('password')
            
            if memo.password and password != memo.password:
                data = MemoSerializer(memo, context={'request': request}).data
                data['content'] = "🔒 이 메모는 비밀번호로 잠겨 있습니다."
                data['extracted_infos'] = []
                data['routines'] = []
                data['is_locked'] = True
                return Response(data)
                
            return Response(MemoSerializer(memo, context={'request': request}).data)
        except Memo.DoesNotExist:
            return Response({'error': '존재하지 않거나 비공개된 메모입니다.'}, status=404)

    def post(self, request, slug):
        """익명 댓글 작성"""
        try:
            memo = Memo.objects.get(share_slug=slug, is_public=True)
            content = request.data.get('content')
            author_name = request.data.get('author_name', '익명 방문자')
            
            if not content: return Response({'error': '내용을 입력하세요.'}, status=400)
            
            from .models import MemoComment
            user = request.user if request.user.is_authenticated else None
            if user: author_name = user.first_name or user.username

            comment = MemoComment.objects.create(
                memo=memo, user=user, 
                author_name=author_name, content=content
            )
            return Response(MemoCommentSerializer(comment, context={'request': request}).data)
        except Memo.DoesNotExist:
            return Response({'error': '작성할 수 없는 메모입니다.'}, status=404)


class ImportSharedMemoView(APIView):
    """공유받은 메모를 내 보관함으로 복사 및 알람 동기화"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        try:
            original = Memo.objects.get(share_slug=slug, is_public=True)
            # 메모 복사
            new_memo = Memo.objects.create(
                user=request.user,
                title=f"[가져옴] {original.title}",
                content=original.content,
                color=original.color
            )
            # AI 재분석 (알람 자동 생성 포함)
            new_memo.categories = AIAnalyzer.classify(new_memo.content)
            new_memo.save()
            AIAnalyzer.extract_all(request.user, new_memo)
            
            return Response({'message': '보관함에 저장되었습니다. 이제 똑같은 루틴 알람을 받을 수 있습니다!', 'id': new_memo.id})
        except Memo.DoesNotExist:
            return Response({'error': '가져올 수 없는 메모입니다.'}, status=404)


class BriefingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.now()
        hour = now.hour
        
        if hour < 6: greet = "고요한 새벽이네요"
        elif hour < 12: greet = "기분 좋은 아침입니다"
        elif hour < 18: greet = "활기찬 오후 보내고 계신가요?"
        else: greet = "오늘 하루도 수고 많으셨어요"

        routines = RoutineAlert.objects.filter(user=user, is_active=True).order_by('time')
        schedules = ExtractedInfo.objects.filter(user=user, info_type='schedule').order_by('-created_at')[:5]
        health_memos = Memo.objects.filter(user=user, categories__contains='health')[:3]

        return Response({
            'greeting': f"{greet}, {user.first_name or user.username}님!",
            'routines': RoutineAlertSerializer(routines, many=True).data,
            'schedules': ExtractedInfoSerializer(schedules, many=True).data,
            'health_tips': MemoListSerializer(health_memos, many=True).data
        })

    @action(detail=False, methods=['post'])
    def check_routine(self, request, pk=None):
        routine = RoutineAlert.objects.get(pk=pk, user=request.user)
        DailyCheck.objects.get_or_create(user=request.user, routine=routine, checked_at=timezone.now().date())
        return Response({'status': 'checked'})


class LifeCardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        memos = Memo.objects.filter(user=user)
        
        cards = []
        for cat in AIAnalyzer.CATEGORIES.keys():
            cat_memos = memos.filter(categories__contains=cat)
            if cat_memos.exists():
                cards.append({
                    'category': cat,
                    'count': cat_memos.count(),
                    'recent': MemoListSerializer(cat_memos[:3], many=True).data
                })
        
        # 특수 카드: 연락처 및 재정 요약
        people = ExtractedInfo.objects.filter(user=user, info_type='person')[:5]
        finance = ExtractedInfo.objects.filter(user=user, info_type='finance')[:5]
        
        return Response({
            'cards': cards,
            'extracted': {
                'people': ExtractedInfoSerializer(people, many=True).data,
                'finance': ExtractedInfoSerializer(finance, many=True).data
            }
        })


class ContactViewSet(viewsets.ModelViewSet):
    serializer_class = ContactSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_queryset(self): return Contact.objects.filter(user=self.request.user)
    def perform_create(self, serializer): serializer.save(user=self.request.user)
