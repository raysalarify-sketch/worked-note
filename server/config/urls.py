from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/', include('memos.urls')),
    path('api/messaging/', include('messaging.urls')),
    # React 앱 - 위 API 경로 외 모든 URL은 React가 처리
    re_path(r'^(?!api/|admin/).*', TemplateView.as_view(template_name='index.html')),
]
