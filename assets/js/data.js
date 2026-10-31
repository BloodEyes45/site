export const DAYS = [
  { id: 1, short: 'Pzt', name: 'Pazartesi' },
  { id: 2, short: 'Sal', name: 'Salı' },
  { id: 3, short: 'Çar', name: 'Çarşamba' },
  { id: 4, short: 'Per', name: 'Perşembe' },
  { id: 5, short: 'Cum', name: 'Cuma' },
  { id: 6, short: 'Cmt', name: 'Cumartesi' },
  { id: 7, short: 'Paz', name: 'Pazar' },
];

export const COURSE_COLORS = [
  { from: '#ff8fa3', to: '#ffb38a', soft: '244, 128, 146' },
  { from: '#8b7cf6', to: '#b49bff', soft: '130, 115, 235' },
  { from: '#4cc9b0', to: '#8fe3c9', soft: '65, 179, 154' },
  { from: '#64a7ff', to: '#91c7ff', soft: '86, 145, 225' },
  { from: '#f0a03d', to: '#ffd08a', soft: '224, 148, 45' },
  { from: '#e978b6', to: '#ffa7d1', soft: '211, 101, 160' },
];

const SEED_LESSONS = [
  // Pazartesi
  ['1', '09:00', '12:30', 'Yaşlıda Akut ve Kronik Hastalıklar', 'Derslik 7'],
  ['1', '13:30', '15:10', 'Sağlık Sosyolojisi', 'Derslik 3'],
  // Salı
  ['2', '09:00', '10:40', 'Yaşlıda Beslenme', 'Derslik 3'],
  ['2', '10:50', '12:30', 'Fiziksel Rehabilitasyon', 'Derslik 6'],
  ['2', '13:30', '15:10', 'Geriatrik Psikiyatri', 'Derslik 6'],
  ['2', '15:20', '17:00', 'Sağlık İşletmelerinde Yönetim', 'Amfi C'],
  // Çarşamba
  ['3', '09:00', '10:40', 'Çevre Koruma', 'Amfi C'],
  ['3', '10:50', '12:30', 'Yaşlıda Akut ve Kronik Hastalıklar', 'Amfi C'],
];

export function seedLessons() {
  return SEED_LESSONS.map(([day, start, end, title, place], index) => ({
    id: `seed-${index + 1}`,
    day: Number(day),
    start,
    end,
    title,
    place,
  }));
}

export const NOTE_MOODS = [
  { id: 'love', emoji: '💗', label: 'Kalp' },
  { id: 'smile', emoji: '🌤️', label: 'Gülümseme' },
  { id: 'hug', emoji: '🫂', label: 'Sarılma' },
  { id: 'star', emoji: '✨', label: 'Yıldız' },
  { id: 'coffee', emoji: '☕', label: 'Kahve' },
];

export const GARDEN_STAGES = [
  { at: 0, label: 'İlk filiz', caption: 'Her şey küçük bir fikirle başlar.' },
  { at: 3, label: 'Filizleniyor', caption: 'İlk damlalar toprağa değdi.' },
  { at: 8, label: 'Büyüyor', caption: 'Birlikte güzel büyüyorsunuz.' },
  { at: 16, label: 'Çiçek açtı', caption: 'Bahçeniz renklenmeye başladı.' },
  { at: 28, label: 'Küçük bir bahçe', caption: 'Sevgi, sabırla büyüyen bir şey.' },
  { at: 44, label: 'Gürül gürül', caption: 'Bu bahçe ikinizin eseri.' },
];
