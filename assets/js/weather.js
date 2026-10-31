const WEATHER_CODES = {
  0: { name: 'Açık', kind: 'clear' },
  1: { name: 'Az bulutlu', kind: 'partly' },
  2: { name: 'Parçalı bulutlu', kind: 'partly' },
  3: { name: 'Kapalı', kind: 'cloudy' },
  45: { name: 'Sisli', kind: 'fog' },
  48: { name: 'Kırağılı sis', kind: 'fog' },
  51: { name: 'Hafif çisenti', kind: 'drizzle' },
  53: { name: 'Çisenti', kind: 'drizzle' },
  55: { name: 'Yoğun çisenti', kind: 'drizzle' },
  56: { name: 'Dondurucu çisenti', kind: 'drizzle' },
  57: { name: 'Yoğun dondurucu çisenti', kind: 'drizzle' },
  61: { name: 'Hafif yağmur', kind: 'rain' },
  63: { name: 'Yağmurlu', kind: 'rain' },
  65: { name: 'Şiddetli yağmur', kind: 'rain' },
  66: { name: 'Dondurucu yağmur', kind: 'rain' },
  67: { name: 'Şiddetli dondurucu yağmur', kind: 'rain' },
  71: { name: 'Hafif kar', kind: 'snow' },
  73: { name: 'Kar yağışlı', kind: 'snow' },
  75: { name: 'Yoğun kar', kind: 'snow' },
  77: { name: 'Kar taneleri', kind: 'snow' },
  80: { name: 'Hafif sağanak', kind: 'rain' },
  81: { name: 'Sağanak', kind: 'rain' },
  82: { name: 'Şiddetli sağanak', kind: 'rain' },
  85: { name: 'Kar sağanağı', kind: 'snow' },
  86: { name: 'Yoğun kar sağanağı', kind: 'snow' },
  95: { name: 'Gök gürültülü', kind: 'storm' },
  96: { name: 'Dolulu fırtına', kind: 'storm' },
  99: { name: 'Şiddetli fırtına', kind: 'storm' },
};

export function weatherInfo(code, isDay = true) {
  const info = WEATHER_CODES[code] || { name: 'Bilinmiyor', kind: 'cloudy' };
  return { ...info, isDay: Boolean(isDay) };
}

export function weatherKey(lat, lon) {
  return `${Number(lat).toFixed(3)},${Number(lon).toFixed(3)}`;
}

function withTimeout(promise, ms = 14000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    done: promise(controller.signal).finally(() => clearTimeout(timer)),
  };
}

export async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: Number(lat).toFixed(4),
    longitude: Number(lon).toFixed(4),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,weather_code,precipitation_probability,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
    timezone: 'auto',
    forecast_days: '7',
    wind_speed_unit: 'kmh',
  });

  const request = withTimeout(
    (signal) => fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { signal, cache: 'no-store' }),
    16000,
  );

  const response = await request.done;
  if (!response.ok) throw new Error(`Hava durumu servisi ${response.status} döndürdü.`);
  const data = await response.json();
  if (!data?.current || !data?.daily?.time) throw new Error('Hava durumu verisi eksik.');

  return {
    ...data,
    fetchedAt: Date.now(),
    key: weatherKey(lat, lon),
  };
}

export function currentWeather(data) {
  if (!data?.current) return null;
  const info = weatherInfo(data.current.weather_code, data.current.is_day);
  return {
    ...data.current,
    ...info,
    temperature: Math.round(data.current.temperature_2m),
    apparent: Math.round(data.current.apparent_temperature),
    wind: Math.round(data.current.wind_speed_10m),
    humidity: Math.round(data.current.relative_humidity_2m),
  };
}

export function dailyForecast(data, count = 7) {
  if (!data?.daily?.time) return [];
  return data.daily.time.slice(0, count).map((time, index) => {
    const info = weatherInfo(data.daily.weather_code[index], true);
    return {
      date: new Date(`${time}T12:00:00`),
      time,
      ...info,
      high: Math.round(data.daily.temperature_2m_max[index]),
      low: Math.round(data.daily.temperature_2m_min[index]),
      rain: Math.round(data.daily.precipitation_probability_max?.[index] ?? 0),
      sunrise: data.daily.sunrise?.[index],
      sunset: data.daily.sunset?.[index],
    };
  });
}

export function hourlyForecast(data, count = 12) {
  if (!data?.hourly?.time) return [];
  const now = new Date();
  let start = data.hourly.time.findIndex((time) => new Date(time).getTime() >= now.getTime() - 30 * 60000);
  if (start < 0) start = 0;
  return data.hourly.time.slice(start, start + count).map((time, offset) => {
    const index = start + offset;
    const info = weatherInfo(data.hourly.weather_code[index], data.hourly.is_day?.[index] ?? true);
    return {
      date: new Date(time),
      time,
      ...info,
      temperature: Math.round(data.hourly.temperature_2m[index]),
      rain: Math.round(data.hourly.precipitation_probability?.[index] ?? 0),
    };
  });
}

export async function reverseGeocode(lat, lon) {
  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=tr`,
      { cache: 'no-store' },
    );
    if (!response.ok) throw new Error('reverse geocode failed');
    const data = await response.json();
    const name = data.locality || data.city || data.principalSubdivision || '';
    const detail = [data.principalSubdivision, data.countryName]
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index)
      .join(', ');
    return {
      name: name || 'Konumun',
      detail: detail || 'Canlı konum',
    };
  } catch {
    return {
      name: 'Konumun',
      detail: `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
    };
  }
}

export function weatherMood(current) {
  if (!current) return 'Gökyüzü seni bekliyor.';
  if (!current.isDay) {
    if (current.kind === 'clear') return 'Yıldızlar için güzel bir gece.';
    if (current.kind === 'partly') return 'Ay, bulutların arasından görünüyor.';
    if (current.kind === 'rain' || current.kind === 'drizzle' || current.kind === 'storm') {
      return 'Yağmurlu bir gece; içeride kahve iyi gider.';
    }
    if (current.kind === 'snow') return 'Kar altında sakin bir gece.';
    if (current.kind === 'fog') return 'Sisli bir gece.';
    return 'Bulutlu bir gece.';
  }
  if (current.kind === 'clear') return 'Gökyüzü bugün çok net.';
  if (current.kind === 'rain' || current.kind === 'drizzle' || current.kind === 'storm') {
    return 'Yağmur var; içeride kahve iyi gider.';
  }
  if (current.kind === 'snow') return 'Dışarısı kar altında.';
  if (current.kind === 'fog') return 'Hafif sisli bir hava.';
  return 'Bulutların arkasında güneş var.';
}
