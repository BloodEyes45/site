// Firebase web uygulama yapılandırması.
// Bu değerler tarayıcıda görünür; Firebase'de gizli anahtar değildir.
export const firebaseConfig = {
  apiKey: 'AIzaSyDQR3SoBD0fygIJT3PRudDQ-2XjuphOHKE',
  authDomain: 'semaasistan-9dca3.firebaseapp.com',
  databaseURL: 'https://semaasistan-9dca3-default-rtdb.firebaseio.com',
  projectId: 'semaasistan-9dca3',
  storageBucket: 'semaasistan-9dca3.firebasestorage.app',
  messagingSenderId: '132361761020',
  appId: '1:132361761020:web:f41854b563182ca44ce779',
  measurementId: 'G-E8NYQYPCNR',
};

// İki cihazın da kullandığı sabit ortak alan.
// Eşleşme kodu veya URL girişi yok.
export const sharedSpacePath = 'spaces/semaasistan';

// Web Push için VAPID açık anahtarı (gizli değildir).
// Özel eşi .secrets/vapid.json içinde durur ve yayınlanmaz.
export const vapidPublicKey =
  'BLzaYn2SKqngKRmNCATBpIiBMFi5zseO4OHVhDzYVJZ7pKo3vxp7fpG8RM8xOmJm00o4H-S653-m0tHNgd0ACSg';
