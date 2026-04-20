#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

# Django 관리자 CSS/JS/이미지 수집
python manage.py collectstatic --noinput

# 데이터베이스 테이블 생성/업데이트
python manage.py migrate
