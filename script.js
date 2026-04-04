// Configuration
const DISCORD_ID = "660842363694088203";
const USERNAME = "BloodEyes1";
const DISCORD_TAG = "thelastdance#4444";

// Initialize All Functions
document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    initCursorAura();
    initTiltEffect();
    initViewCount();
    updateSpotifyOnly();
    setInterval(updateSpotifyOnly, 12000);

    // V4 Overlay Handler (Video ve Ses Burada Başlar)
    const overlay = document.getElementById('overlay');
    const bgVideo = document.getElementById('bg-video');
    const volIcon = document.getElementById('volume-icon');

    overlay.addEventListener('click', () => {
        overlay.classList.add('hide');
        bgVideo.muted = false;
        bgVideo.volume = 1;
        bgVideo.play();
        volIcon.classList.replace('fa-volume-xmark', 'fa-volume-high');

        // İsmin yazılma animasyonunu başlat (Ultra Hızlandırıldı)
        setTimeout(initTypewriter, 10);
    });

    // Manuel Ses Kontrolü
    document.getElementById('volume-control').addEventListener('click', (e) => {
        e.stopPropagation();
        if (bgVideo.muted) {
            bgVideo.muted = false;
            bgVideo.volume = 1;
            volIcon.classList.replace('fa-volume-xmark', 'fa-volume-high');
        } else {
            bgVideo.muted = true;
            volIcon.classList.replace('fa-volume-high', 'fa-volume-xmark');
        }
    });

    // Kopyalama Mantığı (İsim ve ID)
    const nameEl = document.getElementById('typewriter-name');
    const tagEl = document.getElementById('discord-tag');

    nameEl.addEventListener('click', () => copyText(USERNAME));
    tagEl.addEventListener('click', () => copyText(DISCORD_TAG));
});

// Yardımcı Kopyalama Fonksiyonu
function copyText(text) {
    const toast = document.getElementById('copy-toast');
    navigator.clipboard.writeText(text).then(() => {
        toast.innerText = `"${text}" Kopyalandı!`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }).catch(err => {
        console.error('Kopyalama başarısız:', err);
    });
}

// 3D Tilt Effect
function initTiltEffect() {
    const card = document.getElementById('profile-card');
    const maxRotation = 8;

    document.addEventListener('mousemove', (e) => {
        const { clientX, clientY } = e;
        const { innerWidth, innerHeight } = window;
        const xPos = (clientX / innerWidth) - 0.5;
        const yPos = (clientY / innerHeight) - 0.5;
        const rotateY = xPos * maxRotation * 2;
        const rotateX = -yPos * maxRotation * 2;
        card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });
}

// Typewriter Effect (V6 Sürüm: Ultra Hızlandırılmış Sıralı Gelme)
function initTypewriter() {
    const textEl = document.getElementById('typewriter-name');
    const badgeLeft = document.getElementById('badge-left');
    const badgeRight = document.getElementById('badge-right');

    let i = 0;
    textEl.innerHTML = "";

    // 1. Önce sol badge'i göster
    setTimeout(() => {
        badgeLeft.classList.add('show');

        // 2. 200ms sonra ismi yazmaya başla (Ultra Hızlı)
        setTimeout(() => {
            function type() {
                if (i < USERNAME.length) {
                    textEl.innerHTML += USERNAME.charAt(i);
                    i++;
                    setTimeout(type, 80); // Harf hızı 65ms
                } else {
                    // 3. İsim bittiğinde sağ badge'i göster
                    setTimeout(() => {
                        badgeRight.classList.add('show');
                    }, 150);
                }
            }
            type();
        }, 200);
    }, 100);
}

// Cursor Aura (Follower)
function initCursorAura() {
    const aura = document.querySelector('.cursor-aura');
    let mouseX = 0, mouseY = 0, auraX = 0, auraY = 0;
    document.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
    function animate() {
        auraX += (mouseX - auraX) * 0.12;
        auraY += (mouseY - auraY) * 0.12;
        aura.style.left = auraX - 12 + 'px';
        aura.style.top = auraY - 12 + 'px';
        requestAnimationFrame(animate);
    }
    animate();
}

// Lanyard API
async function updateSpotifyOnly() {
    const spotifyEl = document.getElementById('spotify-text');
    try {
        const response = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_ID}`);
        const data = await response.json();
        if (data.success && data.data) {
            const presence = data.data;
            if (presence.listening_to_spotify && presence.spotify) {
                spotifyEl.innerText = `Dinliyor: ${presence.spotify.artist} - ${presence.spotify.track}`;
            } else {
                spotifyEl.innerText = "Şu an müzik dinlemiyor...";
            }
        }
    } catch (e) {
        console.error("Lanyard Hatası", e);
    }
}

// Particles.js
function initParticles() {
    particlesJS("particles-js", {
        "particles": {
            "number": { "value": 80, "density": { "enable": true, "value_area": 800 } },
            "color": { "value": "#ffffff" },
            "shape": { "type": "circle" },
            "opacity": { "value": 0.4, "random": true },
            "size": { "value": 2, "random": true },
            "line_linked": { "enable": false },
            "move": { "enable": true, "speed": 1.2, "direction": "bottom", "random": true, "out_mode": "out" }
        },
        "retina_detect": true
    });
}

// View Count
function initViewCount() {
    let count = parseInt(localStorage.getItem('v3_views') || "3845");
    count++;
    localStorage.setItem('v3_views', count);
    document.getElementById('count').innerText = count;
}
