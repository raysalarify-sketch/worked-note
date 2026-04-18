from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MemoViewSet, ContactViewSet, SharedMemoView

router = DefaultRouter()
router.register(r'memos', MemoViewSet, basename='memo')
router.register(r'contacts', ContactViewSet, basename='contact')

urlpatterns = [
    path('', include(router.urls)),
    path('share/<str:token>/', SharedMemoView.as_view(), name='shared_memo'),
]
