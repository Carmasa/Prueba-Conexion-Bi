document.addEventListener('DOMContentLoaded', function () {
    const clinica = localStorage.getItem('usuario');
    const gestor = localStorage.getItem('gestor');

    if (!clinica || !gestor) {
        window.location.href = 'login.html';
        return;
    }

    if (gestor === 'gesden' || gestor === 'odontonet') {
        // Importar y ejecutar el script específico para gesden
        const script = document.createElement('script');
        script.src = 'calculosGesden.js';
        document.head.appendChild(script);
        script.onload = () => {
            inicializarCalculosGesden();
        }
    } else if (gestor === 'klinikale') {
        // Importar y ejecutar el script específico para klinikale
        const script = document.createElement('script');
        script.src = 'calculosKlinikale.js';
        document.head.appendChild(script);
        script.onload = () => {
            inicializarCalculosKlinikale();
        }
    }
});