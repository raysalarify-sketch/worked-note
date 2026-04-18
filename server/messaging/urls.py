from django.urls import path
from .views import SendMessageView, SendLogListView, SendLogDetailView

urlpatterns = [
    path('send/', SendMessageView.as_view(), name='send_message'),
    path('history/', SendLogListView.as_view(), name='send_history'),
    path('history/<int:pk>/', SendLogDetailView.as_view(), name='send_detail'),
]
