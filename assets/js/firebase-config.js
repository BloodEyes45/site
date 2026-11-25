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
  'BI1mJh1v4QEaOXVMUyw9lvo5LOVo5CXevjsKMIjS0xIhmk1Bon-aeV5ss2Y1KC61ou8yYwPTwCWz2aTPDyEhJ_4';
