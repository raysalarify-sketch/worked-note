from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    SignupView, LoginView, LogoutView, UserInfoView, 
    ChangePasswordView, PasswordResetRequestView, PasswordResetConfirmView
)

urlpatterns = [
    path('signup/', SignupView.as_view(), name='signup'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', UserInfoView.as_view(), name='me'),
    path('change_password/', ChangePasswordView.as_view(), name='change_password'),
    path('password_reset/', PasswordResetRequestView.as_view(), name='password_reset'),
    path('password_reset_confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
]
