from django.contrib.auth.hashers import make_password
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from api.models import Utilisateur, Departement, Specialite

class AuthViewTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = Utilisateur.objects.create(
            login='testuser',
            passwd=make_password('testpass123'),
            role='ADMIN'
        )
    
    def test_sms_login_success(self):
        response = self.client.post('/api/auth/sms-login/', {
            'login': 'testuser',
            'password': 'testpass123'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
    
    def test_sms_login_failure(self):
        response = self.client.post('/api/auth/sms-login/', {
            'login': 'testuser',
            'password': 'wrongpassword'
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class SpecialiteViewTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dep = Departement.objects.create(
            code_dep='GIT',
            lib_dep='Génie Industriel et Technique'
        )
        self.sp1 = Specialite.objects.create(
            code_sp='GC',
            lib_sp='Génie Civil',
            code_dep=self.dep
        )
        self.sp2 = Specialite.objects.create(
            code_sp='GM',
            lib_sp='Génie Mécanique',
            code_dep=self.dep
        )
    
    def test_list_specialites(self):
        response = self.client.get('/api/specialites/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)