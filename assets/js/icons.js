const ICON_PATHS = {
  today: `
    <path d="M4 10.5 12 4l8 6.5" />
    <path d="M6.5 9.5V20h11V9.5" />
    <path d="M10 20v-5.5h4V20" />`,
  calendar: `
    <rect x="3.5" y="5.5" width="17" height="15" rx="4" />
    <path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17" />
    <path d="M8 14h2M14 14h2M8 17.5h2" />`,
  heart: `
    <path d="M20.4 5.9a5.1 5.1 0 0 0-7.2 0L12 7.1l-1.2-1.2a5.1 5.1 0 0 0-7.2 7.2L12 21l8.4-7.9a5.1 5.1 0 0 0 0-7.2Z" />`,
  heartFilled: `
    <path fill="currentColor" stroke="none" d="M20.4 5.9a5.1 5.1 0 0 0-7.2 0L12 7.1l-1.2-1.2a5.1 5.1 0 0 0-7.2 7.2L12 21l8.4-7.9a5.1 5.1 0 0 0 0-7.2Z" />`,
  settings: `
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2.2" />
    <circle cx="8" cy="17" r="2.2" />`,
  plus: `<path d="M12 5v14M5 12h14" />`,
  minus: `<path d="M5 12h14" />`,
  map: `
    <path d="m3.5 6.5 5-2.5 7 2.5 5-2.5v13.5l-5 2.5-7-2.5-5 2.5V6.5Z" />
    <path d="M8.5 4v13.5M15.5 6.5V20" />`,
  x: `<path d="m6 6 12 12M18 6 6 18" />`,
  chevronRight: `<path d="m9 5 7 7-7 7" />`,
  chevronLeft: `<path d="m15 5-7 7 7 7" />`,
  chevronDown: `<path d="m5 9 7 7 7-7" />`,
  clock: `
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />`,
  pin: `
    <path d="M20 10.3c0 5.1-8 11-8 11s-8-5.9-8-11a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10" r="2.7" />`,
  locate: `
    <circle cx="12" cy="12" r="3.2" />
    <circle cx="12" cy="12" r="7.5" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />`,
  search: `
    <circle cx="10.8" cy="10.8" r="6.3" />
    <path d="m15.5 15.5 4.2 4.2" />`,
  wind: `
    <path d="M3 8h10.5a2.5 2.5 0 1 0-2.4-3.2" />
    <path d="M3 12h15.5a2.5 2.5 0 1 1-2.4 3.2" />
    <path d="M3 16h6" />`,
  droplet: `
    <path d="M12 3.5S6.5 9.6 6.5 14a5.5 5.5 0 0 0 11 0c0-4.4-5.5-10.5-5.5-10.5Z" />`,
  sunrise: `
    <path d="M4 18h16M7 18a5 5 0 0 1 10 0" />
    <path d="M12 3v4M4.9 7.9l2.2 2.2M19.1 7.9l-2.2 2.2M2.5 14H5M19 14h2.5" />`,
  sunset: `
    <path d="M4 18h16M7 18a5 5 0 0 1 10 0" />
    <path d="M12 7V3M4.9 12.1l2.2-2.2M19.1 12.1l-2.2-2.2M2.5 14H5M19 14h2.5" />`,
  trash: `
    <path d="M4.5 7h15M9 7V4.5h6V7M7 7l1 13h8l1-13M10 10.5v6M14 10.5v6" />`,
  check: `<path d="m5 12.5 4.3 4.2L19 6.8" />`,
  share: `
    <path d="M12 15V3.5M8.5 7 12 3.5 15.5 7" />
    <path d="M6 11.5v7A2.5 2.5 0 0 0 8.5 21h7a2.5 2.5 0 0 0 2.5-2.5v-7" />`,
  link: `
    <path d="m9.2 14.8 5.6-5.6" />
    <path d="M7.4 17.4 6 18.8a3.7 3.7 0 0 1-5.2-5.2l3-3a3.7 3.7 0 0 1 5.2 0" transform="translate(2.5 0)" />
    <path d="m16.6 6.6 1.4-1.4a3.7 3.7 0 0 1 5.2 5.2l-3 3a3.7 3.7 0 0 1-5.2 0" transform="translate(-2.5 0)" />`,
  cloud: `
    <path d="M7.3 18.5h10a3.8 3.8 0 0 0 .4-7.6A5.7 5.7 0 0 0 6.6 12a3.4 3.4 0 0 0 .7 6.5Z" />`,
  refresh: `
    <path d="M20 11a8 8 0 1 0 .2 3.3M20 4v7h-7" />`,
  install: `
    <path d="M12 3v11M8 10l4 4 4-4" />
    <path d="M5 15v3.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V15" />`,
  sun: `
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7" />`,
  moon: `
    <path d="M20.2 14.3A8.4 8.4 0 0 1 9.7 3.8a8.5 8.5 0 1 0 10.5 10.5Z" />`,
  sparkles: `
    <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" />
    <path d="m18.5 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />`,
  send: `
    <path d="m21 3-7.2 18-3.4-7.4L3 10.2 21 3Z" />
    <path d="m10.4 13.6 4.4-4.4" />`,
  edit: `
    <path d="M13.5 5.5 18.5 10.5M4 20l1-5L16.5 3.5a2.8 2.8 0 0 1 4 4L9 19l-5 1Z" />`,
  copy: `
    <rect x="8" y="8" width="11" height="12" rx="2.5" />
    <path d="M15.5 5.5V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h.5" />`,
  lock: `
    <rect x="4.5" y="10" width="15" height="10.5" rx="3" />
    <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />`,
  offline: `
    <path d="M3 3l18 18" />
    <path d="M8.5 8.7A8.5 8.5 0 0 0 3.5 10M20.5 10a13.8 13.8 0 0 0-4.4-2.2M6 13a8.5 8.5 0 0 1 4-1.6M18 13a8.5 8.5 0 0 0-2.2-1.3M9 16.2a5 5 0 0 1 6 0M12 20h.01" />`,
  arrowUpRight: `
    <path d="M7 17 17 7M8 7h9v9" />`,
  arrowRight: `<path d="M4 12h16M14 6l6 6-6 6" />`,
  leaf: `
    <path d="M20.5 3.5C13 3.5 5 7.2 5 14.2a5.3 5.3 0 0 0 5.3 5.3c7 0 10.2-8 10.2-16Z" />
    <path d="M4 21c1.6-5.3 5-8.7 10.2-10.6" />`,
  user: `
    <circle cx="12" cy="8" r="3.7" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />`,
  users: `
    <circle cx="9" cy="8.5" r="3.3" />
    <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" />
    <path d="M16 5.5a3.3 3.3 0 0 1 0 6.2M17.4 14.4a6.2 6.2 0 0 1 3.8 5.6" />`,
  bell: `
    <path d="M18 9a6 6 0 0 0-12 0c0 7-2.5 7-2.5 8.5h17C20.5 16 18 16 18 9Z" />
    <path d="M9.5 20.5a2.8 2.8 0 0 0 5 0" />`,
  info: `
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5h.01" />`,
  coffee: `
    <path d="M4 8h13v5.5A5.5 5.5 0 0 1 11.5 19h-2A5.5 5.5 0 0 1 4 13.5V8Z" />
    <path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17M6 3.5v2M10 3.5v2M14 3.5v2M3 22h16" />`,
};

export function icon(name, className = '', strokeWidth = 1.8) {
  const path = ICON_PATHS[name];
  if (!path) return '';
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

const WEATHER_ART = {
  clear: (day) => `
    <svg class="wx-svg" viewBox="0 0 96 96" aria-hidden="true">
      <circle class="wx-halo" cx="48" cy="48" r="31" />
      <circle class="wx-sun" cx="48" cy="48" r="17" />
      <circle class="wx-sun-highlight" cx="42" cy="42" r="7" />
      ${day
        ? `<g class="wx-rays"><path d="M48 8v8M48 80v8M8 48h8M80 48h8M19.7 19.7l5.7 5.7M70.6 70.6l5.7 5.7M76.3 19.7l-5.7 5.7M25.4 70.6l-5.7 5.7"/></g>`
        : `<g class="wx-stars"><circle cx="75" cy="23" r="2"/><circle cx="80" cy="38" r="1.3"/><circle cx="18" cy="28" r="1.5"/></g>`}
    </svg>`,
  'clear-night': () => `
    <svg class="wx-svg" viewBox="0 0 96 96" aria-hidden="true">
      <circle class="wx-halo" cx="50" cy="47" r="30" />
      <path class="wx-moon" d="M68 60.5A26 26 0 0 1 36.5 29a26 26 0 1 0 31.5 31.5Z" />
      <g class="wx-stars"><circle cx="73" cy="25" r="2.2"/><circle cx="82" cy="39" r="1.4"/><circle cx="20" cy="27" r="1.8"/><path d="m68 14 .8 2.2 2.2.8-2.2.8L68 20l-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/></g>
    </svg>`,
  'partly-night': () => `
    <svg class="wx-svg" viewBox="0 0 96 96" aria-hidden="true">
      <circle class="wx-halo" cx="38" cy="35" r="23" />
      <path class="wx-moon" d="M54 48a18 18 0 0 1-21.5-21.5A18 18 0 1 0 54 48Z" />
      <g class="wx-stars"><circle cx="63" cy="20" r="1.8"/><circle cx="72" cy="34" r="1.2"/><circle cx="17" cy="23" r="1.4"/></g>
      <g class="wx-cloud-group">
        <path class="wx-cloud-shadow" d="M27 74h39.5a13.5 13.5 0 0 0 1.2-26.9A20 20 0 0 0 30 50.6 12 12 0 0 0 27 74Z" />
        <path class="wx-cloud" d="M27 71.5h39.5a13.5 13.5 0 0 0 1.2-26.9A20 20 0 0 0 30 48.1 12 12 0 0 0 27 71.5Z" />
      </g>
    </svg>`,
  partly: (day) => `
    <svg class="wx-svg" viewBox="0 0 96 96" aria-hidden="true">
      <circle class="wx-halo" cx="38" cy="36" r="24" />
      <circle class="wx-sun" cx="38" cy="36" r="14" />
      <g class="wx-rays"><path d="M38 8v6M38 58v6M10 36h6M60 36h6M18.2 16.2l4.2 4.2M53.6 51.6l4.2 4.2M57.8 16.2l-4.2 4.2M22.4 51.6l-4.2 4.2"/></g>
      <g class="wx-cloud-group">
        <path class="wx-cloud-shadow" d="M27 74h39.5a13.5 13.5 0 0 0 1.2-26.9A20 20 0 0 0 30 50.6 12 12 0 0 0 27 74Z" />
        <path class="wx-cloud" d="M27 71.5h39.5a13.5 13.5 0 0 0 1.2-26.9A20 20 0 0 0 30 48.1 12 12 0 0 0 27 71.5Z" />
      </g>
    </svg>`,
  cloudy: () => `
    <svg class="wx-svg" viewBox="0 0 96 96" aria-hidden="true">
      <g class="wx-cloud-back"><path d="M22 57h34a10 10 0 0 0 1-20 15 15 0 0 0-28 2 9 9 0 0 0-7 18Z"/></g>
      <g class="wx-cloud-group">
        <path class="wx-cloud-shadow" d="M31 78h42a13 13 0 0 0 .8-26 19 19 0 0 0-36.2 2.5A11.5 11.5 0 0 0 31 78Z"/>
        <path class="wx-cloud" d="M31 75h42a13 13 0 0 0 .8-26 19 19 0 0 0-36.2 2.5A11.5 11.5 0 0 0 31 75Z"/>
      </g>
    </svg>`,
  fog: () => `
    <svg class="wx-svg" viewBox="0 0 96 96" aria-hidden="true">
      <g class="wx-cloud-group"><path class="wx-cloud" d="M26 58h44a13 13 0 0 0 .7-26 20 20 0 0 0-37.3 2.7A11.5 11.5 0 0 0 26 58Z"/></g>
      <g class="wx-fog-lines"><path d="M18 67h60M26 75h48M16 83h44"/></g>
    </svg>`,
  drizzle: () => `
    <svg class="wx-svg" viewBox="0 0 96 96" aria-hidden="true">
      <g class="wx-cloud-group"><path class="wx-cloud" d="M25 57h46a13 13 0 0 0 .7-26 20 20 0 0 0-37.3 2.7A11.5 11.5 0 0 0 25 57Z"/></g>
      <g class="wx-rain"><path d="M34 66v7M48 66v7M62 66v7"/></g>
    </svg>`,
  rain: () => `
    <svg class="wx-svg" viewBox="0 0 96 96" aria-hidden="true">
      <g class="wx-cloud-group"><path class="wx-cloud" d="M25 55h46a13 13 0 0 0 .7-26 20 20 0 0 0-37.3 2.7A11.5 11.5 0 0 0 25 55Z"/></g>
      <g class="wx-rain"><path d="m32 63-3 10M48 63l-3 10M64 63l-3 10"/><path d="m43 78-2 6M59 78l-2 6"/></g>
    </svg>`,
  snow: () => `
    <svg class="wx-svg" viewBox="0 0 96 96" aria-hidden="true">
      <g class="wx-cloud-group"><path class="wx-cloud" d="M25 55h46a13 13 0 0 0 .7-26 20 20 0 0 0-37.3 2.7A11.5 11.5 0 0 0 25 55Z"/></g>
      <g class="wx-snow"><path d="M33 65v10M28.5 68l9 4M28.5 72l9-4M55 68v10M50.5 71l9 4M50.5 75l9-4M67 78v6M64 80l6 3M64 83l6-3"/></g>
    </svg>`,
  storm: () => `
    <svg class="wx-svg" viewBox="0 0 96 96" aria-hidden="true">
      <g class="wx-cloud-group"><path class="wx-cloud" d="M25 54h46a13 13 0 0 0 .7-26 20 20 0 0 0-37.3 2.7A11.5 11.5 0 0 0 25 54Z"/></g>
      <path class="wx-bolt" d="M51 58 38 78h10l-4 13 17-22H51l6-11Z" />
    </svg>`,
};

export function weatherArt(kind = 'cloudy', day = true, className = '') {
  const nightKind = !day && ['clear', 'partly'].includes(kind) ? `${kind}-night` : kind;
  const render = WEATHER_ART[nightKind] || WEATHER_ART.cloudy;
  return `<span class="wx ${className}" data-kind="${kind}" data-day="${day ? '1' : '0'}">${render(day)}</span>`;
}
