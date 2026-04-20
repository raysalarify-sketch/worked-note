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
        qs = Memo.objects.filter(user=self.request.user)
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(categories__contains=category)
        return qs

    def perform_create(self, serializer):
        memo = serializer.save(user=self.request.user)
        self._analyze(memo)

    def perform_update(self, serializer):
        memo = serializer.save()
        self._analyze(memo)

    def _analyze(self, memo):
        memo.categories = AIAnalyzer.classify(memo.content)
        memo.save()
        AIAnalyzer.extract_all(self.request.user, memo)

    @action(detail=False, methods=['get'])
    def search(self, request):
        query = request.query_params.get('q', '').strip()
        if not query: return Response([])
        qs = self.get_queryset().filter(Q(title__icontains=query) | Q(content__icontains=query))
        return Response(MemoListSerializer(qs, many=True).data)


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
