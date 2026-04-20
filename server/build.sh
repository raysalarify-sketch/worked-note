#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

# Django 관리자 CSS/JS/이미지 수집
python manage.py collectstatic --noinput

# 데이터베이스 테이블 생성/업데이트
python manage.py migrate

# 슈퍼유저 자동 생성 (없을 경우에만)
cat <<EOF | python manage.py shell
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(is_superuser=True).exists():
    User.objects.create_superuser('admin@work.com', 'admin@work.com', 'adminpassword123')
    print('Superuser created: admin@work.com / adminpassword123')
else:
    print('Superuser already exists.')
EOF
