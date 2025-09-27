import axios from 'axios';

const isServer = typeof window === 'undefined';
const getToken = () => !isServer ? localStorage.getItem('authToken') : null;

const apiClient = axios.create({
  timeout: 15000, // 15 s
  headers: { 'Content-Type': 'application/json' },
});

/* ------- request ------- */
apiClient.interceptors.request.use(cfg => {
  const token = getToken();
  if (token) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }

  // Préfixe l'URL de la requête avec /api pour s'assurer qu'elle est correctement routée par le proxy.
  // Ceci corrige l'erreur "Invalid URL" causée par la gestion des baseURLs relatives.
  if (cfg.url && !cfg.url.startsWith('/api')) {
      cfg.url = `/api${cfg.url}`;
  }

  return cfg;
});

/* ------- response ------- */
apiClient.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;

    // Si le token a expiré (401) et qu'on n'a pas déjà réessayé
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true; // Marquer comme "réessayé" pour éviter les boucles

      try {
        // Tenter de rafraîchir le token
        const { data } = await axios.post('/api/auth/refresh');
        if (!isServer) {
            // Ajustement : le backend renvoie { accessToken: '...' }
            localStorage.setItem('authToken', data.accessToken);
        }
        // Réessayer la requête originale avec le nouveau token
        return apiClient(original);
      } catch {
        // Si le refresh échoue, c'est une vraie déconnexion
        if (!isServer) {
          localStorage.removeItem('authToken');
          // Envoyer un événement propre pour que l'UI puisse réagir
          window.dispatchEvent(new CustomEvent('logoutEvent'));
        }
        return Promise.reject(err);
      }
    }
    return Promise.reject(err);
  }
);

export default apiClient;
