from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MemoViewSet, ContactViewSet, BriefingView, LifeCardView, SharedMemoView, ImportSharedMemoView

router = DefaultRouter()
router.register(r'memos', MemoViewSet, basename='memo')
router.register(r'contacts', ContactViewSet, basename='contact')

urlpatterns = [
    path('', include(router.urls)),
    path('briefing/today/', BriefingView.as_view(), name='today_briefing'),
    path('briefing/check/<int:pk>/', BriefingView.as_view(), name='check_routine'),
    path('lifecards/', LifeCardView.as_view(), name='life_cards'),
    path('memos/shared/<uuid:slug>/', SharedMemoView.as_view(), name='shared_memo'),
    path('memos/import/<uuid:slug>/', ImportSharedMemoView.as_view(), name='import_memo'),
]
